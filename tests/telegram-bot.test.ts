import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  sendTelegramMessage,
  sendTelegramOpsMessage,
  sendTelegramPhoto,
} from "@/lib/telegram/bot";

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.TELEGRAM_CUSTOMER_BOT_TOKEN;
});

describe("sendTelegramPhoto", () => {
  it("returns delivered: false if TELEGRAM_CUSTOMER_BOT_TOKEN is missing", async () => {
    const res = await sendTelegramPhoto(123456, new Uint8Array([1, 2, 3]));
    expect(res.delivered).toBe(false);
    expect(res.reason).toMatch(/TELEGRAM_CUSTOMER_BOT_TOKEN is not configured/i);
  });

  it("posts photo to Telegram API with proper chat_id and caption", async () => {
    process.env.TELEGRAM_CUSTOMER_BOT_TOKEN = "test-token-xyz";

    let capturedUrl = "";
    let capturedBody: FormData | null = null;

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = init.body;
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 999 } }),
        { status: 200 },
      );
    });

    const photoBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    const res = await sendTelegramPhoto("1670134164", photoBytes, {
      filename: "test-order-receipt.png",
      caption: "🧾 <b>MHOP-260906-TEST</b>",
      parse_mode: "HTML",
    });

    expect(res.delivered).toBe(true);
    expect(capturedUrl).toBe("https://api.telegram.org/bottest-token-xyz/sendPhoto");
    expect(capturedBody).toBeInstanceOf(FormData);
    expect(capturedBody?.get("chat_id")).toBe("1670134164");
    expect(capturedBody?.get("caption")).toBe("🧾 <b>MHOP-260906-TEST</b>");
    expect(capturedBody?.get("parse_mode")).toBe("HTML");
    const file = capturedBody?.get("photo") as File;
    expect(file).toBeDefined();
    expect(file.name).toBe("test-order-receipt.png");
  });

  it("throws descriptive error when Telegram API rejects the photo", async () => {
    process.env.TELEGRAM_CUSTOMER_BOT_TOKEN = "test-token-xyz";

    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify({ ok: false, description: "Bad Request: wrong file identifier" }),
        { status: 400 },
      );
    });

    await expect(
      sendTelegramPhoto(123, new Uint8Array([1, 2, 3])),
    ).rejects.toThrow(/Telegram sendPhoto failed \(400\)/);
  });
});

describe("sendTelegramOpsMessage", () => {
  it("returns delivered: false if tokens or staff chat id are missing", async () => {
    delete process.env.TELEGRAM_OPS_BOT_TOKEN;
    delete process.env.TELEGRAM_CUSTOMER_BOT_TOKEN;
    delete process.env.TELEGRAM_STAFF_CHAT_ID;

    const res = await sendTelegramOpsMessage("Support alert");
    expect(res.delivered).toBe(false);
    expect(res.reason).toMatch(/is not configured/i);
  });

  it("posts ops alert to staff chat id with parse_mode HTML", async () => {
    process.env.TELEGRAM_OPS_BOT_TOKEN = "ops-token-123";
    process.env.TELEGRAM_STAFF_CHAT_ID = "-100123456789";

    let capturedUrl = "";
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      return new Response(
        JSON.stringify({ ok: true, result: { message_id: 1001 } }),
        { status: 200 },
      );
    });

    const res = await sendTelegramOpsMessage("🆘 <b>Customer Support Request</b>", {
      parse_mode: "HTML",
    });

    expect(res.delivered).toBe(true);
    expect(capturedUrl).toBe("https://api.telegram.org/botops-token-123/sendMessage");
    expect(capturedBody.chat_id).toBe("-100123456789");
    expect(capturedBody.text).toBe("🆘 <b>Customer Support Request</b>");
    expect(capturedBody.parse_mode).toBe("HTML");
  });
});
