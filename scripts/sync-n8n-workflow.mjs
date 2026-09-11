import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const workflowId = "sinlB8NbcPfUqRb7";
const base = new URL(process.env.N8N_API_URL || "http://localhost:5678/api/v1");
if (!["localhost", "127.0.0.1"].includes(base.hostname) || base.port !== "5678" || base.username || base.password)
  throw new Error("Only the authorized local n8n instance may be used.");
if (!process.env.N8N_API_KEY) throw new Error("N8N_API_KEY is missing.");

async function request(method, path, body) {
  const response = await fetch(`${base.toString().replace(/\/$/, "")}${path}`, {
    method,
    redirect: "error",
    headers: {
      "X-N8N-API-KEY": process.env.N8N_API_KEY,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    const message = typeof details.message === "string"
      ? details.message.replaceAll(process.env.N8N_API_KEY, "[redacted]").slice(0, 400)
      : "No validation details returned";
    throw new Error(`n8n ${method} failed with HTTP ${response.status}: ${message}`);
  }
  return response.json();
}

const current = await request("GET", `/workflows/${workflowId}`);
if (current.id !== workflowId || current.name !== "MH OP Master Suite")
  throw new Error("Workflow identity does not match the authorized target.");

mkdirSync(".local/n8n-backups", { recursive: true });
const backup = `.local/n8n-backups/${workflowId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
writeFileSync(backup, JSON.stringify(current, null, 2), { flag: "wx" });

const template = JSON.parse(readFileSync("gadgetos-master-suite.json", "utf8"));
const aliases = {
  "MH OP Signed Events": "GADGET OS Events",
  "Normalize Critical Event": "Route Event",
  "Send Morning Briefing": "Send Briefing",
  "13:00 Cross Sell Scan": "Daily Cross Sell Scan",
  "Send Accessory Follow Up": "Send Accessory Voucher",
};
const byName = new Map(current.nodes.map((node) => [node.name, node]));
const nodes = template.nodes.map((node) => {
  const updated = structuredClone(node);
  const previous = byName.get(node.name) || byName.get(aliases[node.name]);
  if (previous) {
    updated.id = previous.id;
    if (previous.type === node.type) {
      updated.typeVersion = previous.typeVersion;
      if (previous.credentials) updated.credentials = previous.credentials;
    }
    if (previous.disabled !== undefined) updated.disabled = previous.disabled;
    if (previous.webhookId) updated.webhookId = previous.webhookId;
    if (node.type === "n8n-nodes-base.webhook")
      updated.parameters.path = previous.parameters.path;
    if (node.type === "n8n-nodes-base.telegram" && previous.parameters.chatId)
      updated.parameters.chatId = previous.parameters.chatId;
  }
  return updated;
});
const setup = nodes.find((node) => node.id === "setup-note");
if (setup) setup.parameters.content += "\n\nLive update by Daemon: workflow name, existing webhook path, matching credentials and configured error handler are preserved. Verify app deployment and test chats before activation.";
const desired = {
  name: current.name,
  nodes,
  connections: template.connections,
  settings: { ...current.settings, ...template.settings },
};
// n8n returns this editor-managed field on GET but rejects it on public API PUT.
delete desired.settings.binaryMode;
const missingCredentials = nodes.filter((node) =>
  ((node.type === "n8n-nodes-base.httpRequest" || node.type === "n8n-nodes-base.webhook") && !node.credentials?.httpHeaderAuth)
  || (node.type === "n8n-nodes-base.telegram" && !node.credentials?.telegramApi),
).map((node) => node.name);

if (process.argv.includes("--apply")) {
  const expectedVersion = process.argv[process.argv.indexOf("--expected-version") + 1];
  if (!process.argv.includes("--expected-version") || current.versionId !== expectedVersion)
    throw new Error("The live workflow version changed; inspect again before updating.");
  if (current.active) throw new Error("Refusing to edit an active workflow automatically.");
  const fresh = await request("GET", `/workflows/${workflowId}`);
  if (fresh.active || fresh.versionId !== current.versionId)
    throw new Error("Workflow changed during preparation; update cancelled.");
  await request("PUT", `/workflows/${workflowId}`, desired);
  const verified = await request("GET", `/workflows/${workflowId}`);
  const canonical = (value) => JSON.stringify(value, (_, part) =>
    part && typeof part === "object" && !Array.isArray(part)
      ? Object.fromEntries(Object.entries(part).sort(([a], [b]) => a.localeCompare(b)))
      : part,
  );
  if (verified.active || verified.name !== desired.name
      || canonical(verified.nodes) !== canonical(desired.nodes)
      || canonical(verified.connections) !== canonical(desired.connections))
    throw new Error("Update was submitted, but read-back differed; inspect before any retry.");
  console.log(JSON.stringify({ updated: true, verified: true, backup, id: verified.id,
    name: verified.name, active: verified.active, nodeCount: verified.nodes.length,
    versionId: verified.versionId, missingCredentials,
    errorWorkflowConfigured: Boolean(verified.settings.errorWorkflow),
  }, null, 2));
} else {
console.log(JSON.stringify({
  backup,
  id: current.id,
  name: current.name,
  active: current.active,
  versionId: current.versionId,
  fingerprint: createHash("sha256").update(JSON.stringify(current)).digest("hex"),
  settings: current.settings,
  nodes: current.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    typeVersion: node.typeVersion,
    disabled: node.disabled || false,
    credentialTypes: Object.keys(node.credentials || {}),
  })),
  proposedNodeCount: nodes.length,
  missingCredentials,
}, null, 2));
}
