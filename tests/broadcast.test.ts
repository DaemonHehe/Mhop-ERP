import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  audit: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: mocks.from,
    }),
  },
}));

vi.mock("@/lib/services/audit.service", () => ({
  audit: mocks.audit,
}));

import {
  getTelegramBroadcastAudience,
  sendTelegramBroadcast,
} from "@/lib/services/broadcast.service";

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.TELEGRAM_CUSTOMER_BOT_TOKEN;
});

describe("getTelegramBroadcastAudience", () => {
  it("aggregates unique valid telegram user IDs and enriches names", async () => {
    process.env.TELEGRAM_CUSTOMER_BOT_TOKEN = "fake_token_123";

    const sessions = [
      { telegramUserId: "1001" },
      { telegramUserId: "1002" },
      { telegramUserId: "invalid-id" },
      { telegramUserId: "" },
    ];
    const customers = [
      { telegramUserId: "1002", name: "Bob Buyer" },
      { telegramUserId: "1003", name: "Charlie" },
    ];
    const orders = [
      { telegramUserId: "1001", customerName: "Alice Order" },
      { telegramUserId: "1004", customerName: "David" },
    ];

    mocks.from
      .mockResolvedValueOnce(sessions)
      .mockResolvedValueOnce(customers)
      .mockResolvedValueOnce(orders);

    const audience = await getTelegramBroadcastAudience();

    expect(audience.botConfigured).toBe(true);
    expect(audience.totalCount).toBe(4);
    const ids = audience.recipients.map((r) => r.telegramUserId);
    expect(ids).toContain("1001");
    expect(ids).toContain("1002");
    expect(ids).toContain("1003");
    expect(ids).toContain("1004");
    expect(ids).not.toContain("invalid-id");

    const user1001 = audience.recipients.find((r) => r.telegramUserId === "1001");
    expect(user1001?.name).toBe("Alice Order");

    const user1002 = audience.recipients.find((r) => r.telegramUserId === "1002");
    expect(user1002?.name).toBe("Bob Buyer");
  });
});

describe("sendTelegramBroadcast", () => {
  it("rejects empty broadcast text", async () => {
    const result = await sendTelegramBroadcast("   ");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cannot be empty/i);
  });

  it("rejects message exceeding 4,000 characters", async () => {
    const huge = "a".repeat(4001);
    const result = await sendTelegramBroadcast(huge);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/exceeds 4,000/i);
  });

  it("fails if bot token is not configured", async () => {
    const result = await sendTelegramBroadcast("Valid message");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/TELEGRAM_CUSTOMER_BOT_TOKEN is not configured/i);
  });

  it("fails if no audience found in database", async () => {
    process.env.TELEGRAM_CUSTOMER_BOT_TOKEN = "test-token";
    mocks.from
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await sendTelegramBroadcast("Hello everyone");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/No reachable Telegram customers/i);
  });

  it("dispatches messages sequentially and tracks sent, blocked, unreachable, failed", async () => {
    process.env.TELEGRAM_CUSTOMER_BOT_TOKEN = "test-token";

    mocks.from
      .mockResolvedValueOnce([
        { telegramUserId: "1001" },
        { telegramUserId: "1002" },
        { telegramUserId: "1003" },
        { telegramUserId: "1004" },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const originalFetch = global.fetch;
    const fetchMock = vi.fn().mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      const chatId = body.chat_id;

      if (chatId === 1001) {
        return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
      } else if (chatId === 1002) {
        return new Response(JSON.stringify({ ok: false, description: "Forbidden: bot was blocked by the user" }), { status: 403 });
      } else if (chatId === 1003) {
        return new Response(JSON.stringify({ ok: false, description: "Bad Request: chat not found" }), { status: 400 });
      } else {
        return new Response(JSON.stringify({ ok: false, description: "Internal Server Error" }), { status: 500 });
      }
    });

    global.fetch = fetchMock as unknown as typeof global.fetch;

    try {
      const res = await sendTelegramBroadcast("Special holiday sale! 20% off all items.", "admin");

      expect(res.total).toBe(4);
      expect(res.sent).toBe(1);
      expect(res.blocked).toBe(1);
      expect(res.unreachable).toBe(1);
      expect(res.failed).toBe(1);
      expect(res.ok).toBe(true);
      expect(mocks.audit).toHaveBeenCalledWith(
        "telegram.broadcast_sent",
        undefined,
        expect.stringContaining("Broadcast delivered to 1/4"),
        "admin"
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("filters recipients by delivered segment", async () => {
    process.env.TELEGRAM_CUSTOMER_BOT_TOKEN = "test-token";

    mocks.from
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { telegramUserId: "2001", customerName: "U Ba", fulfillmentStatus: "delivered" },
        { telegramUserId: "2002", customerName: "Daw Mya", fulfillmentStatus: "packing" },
      ]);

    const sentTo: number[] = [];
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      sentTo.push(body.chat_id);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 2 } }), { status: 200 });
    });

    try {
      const res = await sendTelegramBroadcast("Checking in on your delivered order!", "admin", {
        segment: "delivered",
      });

      expect(res.total).toBe(1);
      expect(res.sent).toBe(1);
      expect(sentTo).toEqual([2001]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("filters recipients by custom selected user IDs", async () => {
    process.env.TELEGRAM_CUSTOMER_BOT_TOKEN = "test-token";

    mocks.from
      .mockResolvedValueOnce([
        { telegramUserId: "3001" },
        { telegramUserId: "3002" },
        { telegramUserId: "3003" },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const sentTo: number[] = [];
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      const body = JSON.parse(init.body);
      sentTo.push(body.chat_id);
      return new Response(JSON.stringify({ ok: true, result: { message_id: 3 } }), { status: 200 });
    });

    try {
      const res = await sendTelegramBroadcast("Targeted message", "admin", {
        segment: "custom",
        selectedTelegramUserIds: ["3002"],
      });

      expect(res.total).toBe(1);
      expect(res.sent).toBe(1);
      expect(sentTo).toEqual([3002]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
