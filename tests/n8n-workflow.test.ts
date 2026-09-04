import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workflow = JSON.parse(readFileSync("gadgetos-master-suite.json", "utf8"));
type Row = Record<string, unknown>;
type WorkflowNode = { name: string; type: string; retryOnFail?: boolean; parameters: { jsCode?: string; text?: string; url?: string } };
const nodes: WorkflowNode[] = workflow.nodes;
function runCode(name: string, rows: Row[]) {
  const code = nodes.find((node) => node.name === name)?.parameters.jsCode;
  if (!code) throw new Error(`Missing code node ${name}`);
  const items = rows.map((json) => ({ json }));
  return new Function("$input", code)({ all: () => items, first: () => items[0] });
}
function render(expression: string, row: Row) {
  return expression.replace(/^=/, "").replace(/\{\{([\s\S]*?)\}\}/g, (_, code) =>
    String(new Function("$json", "$env", `return (${code});`)(row, { GADGETOS_URL: "http://localhost:3000/" })),
  );
}

describe("n8n workflow data contracts", () => {
  it("maps the app's camelCase Telegram ID and filters invalid cart recipients", () => {
    const result = runCode("Keep Valid Cart Recipients", [
      { id: "a", telegramUserId: "12345", checkout_url: "https://shop.example/shop" },
      { id: "a", telegramUserId: "12345", checkout_url: "https://shop.example/shop" },
      { id: "b", telegramUserId: null, checkout_url: "https://shop.example/shop" },
      { id: "c", telegramUserId: "-12345", checkout_url: "https://shop.example/shop" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].json.telegram_user_id).toBe("12345");
  });

  it("uses the real emitted payment event and a stable replay key", () => {
    const payload = { body: { type: "payment.verified", timestamp: "2026-09-03T01:00:00Z", data: { targetCode: "MHOP-TEST", details: "Verified" } } };
    const first = runCode("Normalize Critical Event", [payload]);
    expect(first[0].json.title).toBe("Payment verified");
    expect(runCode("Normalize Critical Event", [payload])).toEqual(first);
    expect(runCode("Normalize Critical Event", [{ body: { type: "staff.created" } }])).toEqual([]);
  });

  it("does not require or advertise non-redeemable voucher codes", () => {
    const result = runCode("Keep Valid Follow Up Recipients", [
      { order_code: "A", telegram_user_id: "12345", customer: "Customer" },
      { order_code: "B", telegram_user_id: "12345", customer: "Customer" },
    ]);
    expect(result).toHaveLength(1);
    const node = nodes.find((item) => item.name === "Send Accessory Follow Up")!;
    expect(node.parameters.text).not.toMatch(/voucher|10% OFF/i);
  });

  it("renders bounded, escaped Telegram text and real line breaks", () => {
    const row = { customerName: "A < B & C", customer: "A < B & C", checkout_url: "https://example.com", title: "A < B & C", body: "<b>untrusted</b>", target_code: "TEST", timestamp: "now", unshipped: 1, pending_slips: 0, revenue: 50, gross_profit: 10, low_stock: [{ name: "A < B & C", sku: "TEST", stock: 2 }] };
    for (const node of nodes.filter((item) => item.type === "n8n-nodes-base.telegram")) {
      const output = render(node.parameters.text!, row);
      expect(output).not.toContain("<b>");
      expect(output).not.toContain("A < B");
      expect(output).not.toContain("undefined");
      expect(node.retryOnFail).toBe(false);
    }
    const morning = nodes.find((item) => item.name === "Send Morning Briefing")!;
    expect(render(morning.parameters.text!, row)).toContain("\n");
  });

  it("renders API URLs without doubled separators", () => {
    for (const node of nodes.filter((item) => item.type === "n8n-nodes-base.httpRequest")) {
      expect(render(node.parameters.url!, {})).toMatch(/^http:\/\/localhost:3000\/api\/internal\//);
    }
  });
});
