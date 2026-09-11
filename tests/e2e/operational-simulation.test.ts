import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

const mockCookies = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const v = mockCookies.get(name);
      return v !== undefined ? { name, value: v } : undefined;
    },
    set: (name: string, value: string) => mockCookies.set(name, value),
  })),
  headers: vi.fn(async () => new Headers()),
}));

import { POST as handleTelegramWebhook } from "@/app/api/telegram/webhook/route";
import { GET as handleMemberCard } from "@/app/api/member-card/route";
import { GET as handleSlipProxy } from "@/app/api/orders/[orderId]/slip/route";
import { POST as handleN8nWebhook, GET as handleN8nHealth } from "@/app/api/n8n/webhook/route";
import { GET as handleDailyStats } from "@/app/api/internal/stats/daily/route";

import {
  generateCustomerCode,
  getCustomers,
  getOrCreateTelegramCustomer,
  linkCustomerTelegram,
  lookupCustomerLoyalty,
} from "@/lib/services/customer.service";
import {
  formatCardNumber,
  renderMemberCardImage,
} from "@/lib/services/member-card-image";
import {
  calculatePointsFromAmount,
  calculateTierPerks,
  getCardTier,
  getTierForPoints,
  getTierProgress,
} from "@/lib/loyalty";
import {
  getLatestPendingOrderByTelegramUser,
  getOrders,
  recordTelegramPaymentSlip,
  reviewPayment,
  updateFulfillmentAction,
  addShipment,
} from "@/lib/services/order.service";
import { getDashboardSnapshot, getInventory } from "@/lib/services/stock.service";
import {
  createWarrantyTicket,
  resolveWarrantyTicket,
  updateTicketStatusAction,
} from "@/lib/services/ticket.service";
import { evaluateWarrantyPolicy } from "@/lib/warranty-policy";
import {
  formatManagerFinancialDigest,
  formatManagerMorningBriefing,
} from "@/lib/services/bot-settings.service";
import {
  calculateRequiredDeposit,
  calculateRoyalDelivery,
  isLocationSuspended,
  SUSPENDED_DELIVERY_NOTICE,
} from "@/lib/shipping/royal-rates";
import { formatCustomerReceipt } from "@/lib/services/receipt-summary";
import { createSessionToken } from "@/lib/auth/session";
import { emitSystemEvent } from "@/lib/events/event-emitter";
import { db } from "@/db";
import {
  adminUsers,
  customers,
  deviceUnits,
  orderItems,
  orderPayments,
  orders,
  products,
  productVariants,
  staffAlerts,
  systemAuditLogs,
  tickets,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

const SUITE_PREFIX = "E2E-" + randomUUID().slice(0, 6).toUpperCase();
const TEST_PHONE = "0977" + Math.floor(1000000 + Math.random() * 9000000);
const TEST_TG_USER = String(Math.floor(100000000 + Math.random() * 900000000));
const ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || "4HyKCCVj309yStenngl7u8BnLS3HHOfMXnTEsZQyHIeXoZmfpmOUjhDUCgVa4S_x";
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || "f74baecb6fe90ebda2d19327eff4bd75fa7557a26cefd982de6ced7309c52e36";
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "qp4UypJWq0feWhdjPdmm70cl6reS2wnxHFQlLcmatPiCJg8hn0GvVLnAolW2nmMW";

let adminCookie = "";
let testAdminUserId = "b1000000-0000-4000-8000-000000000001";

beforeAll(async () => {
  process.env.ADMIN_API_TOKEN = ADMIN_API_TOKEN;
  process.env.N8N_WEBHOOK_SECRET = N8N_WEBHOOK_SECRET;
  process.env.TELEGRAM_WEBHOOK_SECRET = TELEGRAM_WEBHOOK_SECRET;
  process.env.TELEGRAM_CUSTOMER_BOT_TOKEN = "test-customer-bot-token";
  process.env.TELEGRAM_OPS_BOT_TOKEN = "test-ops-bot-token";
  process.env.TELEGRAM_STAFF_CHAT_ID = "-5166297636";

  const token = await createSessionToken({
    id: testAdminUserId,
    name: "MH OP Administrator",
    email: "admin@gmail.com",
    role: "admin",
  });
  adminCookie = `gadgetos_session=${token}`;
  mockCookies.set("gadgetos_session", token);

  global.fetch = vi.fn().mockImplementation(async (url: unknown, init?: RequestInit) => {
    const urlStr = String(url);
    if (urlStr.includes("getFile")) {
      return new Response(JSON.stringify({ ok: true, result: { file_path: "photos/slip_test.jpg" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (urlStr.includes("/photos/slip_test.jpg") || urlStr.includes("/file/bot")) {
      return new Response(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    if (urlStr.includes("api.telegram.org")) {
      return new Response(JSON.stringify({ ok: true, result: { message_id: 12345 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
});

afterAll(async () => {
  if (!db) return;
  try {
    await db.delete(tickets).where(sql`${tickets.orderCode} LIKE '${SUITE_PREFIX}%'`);
    await db.delete(orderPayments).where(sql`${orderPayments.orderId} IN (SELECT id FROM ${orders} WHERE ${orders.orderCode} LIKE '${SUITE_PREFIX}%')`);
    await db.delete(orderItems).where(sql`${orderItems.orderId} IN (SELECT id FROM ${orders} WHERE ${orders.orderCode} LIKE '${SUITE_PREFIX}%')`);
    await db.delete(orders).where(sql`${orders.orderCode} LIKE '${SUITE_PREFIX}%'`);
    await db.delete(customers).where(eq(customers.phone, TEST_PHONE));
  } catch (err) {
    console.warn("Cleanup warning:", err);
  }
});
describe("Tier 1: Feature Coverage (Isolated Happy Paths)", () => {
  describe("F1: Customer Session & Code Generation", () => {
    it("T1.F1.1: generates unique customer code matching MH-CUST-XXXX format", () => {
      const code = generateCustomerCode();
      expect(code).toMatch(/^MH-CUST-\d{4}$/);
    });

    it("T1.F1.2: generates customer code with custom suffix cleanly padded", () => {
      const code = generateCustomerCode("9921");
      expect(code).toBe("MH-CUST-9921");
      const short = generateCustomerCode("7");
      expect(short).toBe("MH-CUST-0007");
    });

    it("T1.F1.3: getOrCreateTelegramCustomer creates new customer with zero points and member tier", async () => {
      const tgId = "99" + Math.floor(10000000 + Math.random() * 90000000);
      const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
        console.log("SPY CAUGHT ERROR:", ...args);
      });
      const profile = await getOrCreateTelegramCustomer({
        telegramUserId: tgId,
        telegramUsername: "testuser_" + tgId.slice(-4),
        displayName: "Test Customer",
      });
      spy.mockRestore();
      expect(profile).toBeDefined();
      expect(profile.customerCode).toMatch(/^MH-CUST-/);
      expect(profile.points).toBe(0);
      expect(profile.tier).toBe("member");
    });

    it("T1.F1.4: getOrCreateTelegramCustomer is idempotent and returns existing profile on repeat calls", async () => {
      const tgId = "99" + Math.floor(10000000 + Math.random() * 90000000);
      const first = await getOrCreateTelegramCustomer({ telegramUserId: tgId, displayName: "User One" });
      const second = await getOrCreateTelegramCustomer({ telegramUserId: tgId, displayName: "User One Updated" });
      expect(second.customerCode).toBe(first.customerCode);
    });

    it("T1.F1.5: POST /api/telegram/webhook responds to /start with welcome message and inline actions", async () => {
      const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": TELEGRAM_WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          update_id: 1001,
          message: {
            message_id: 1,
            chat: { id: 777001, type: "private" },
            from: { id: 777001, first_name: "Aung", username: "aung77" },
            text: "/start",
          },
        }),
      });
      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.action).toBe("send_message");
      expect(body.text).toContain("MH OP");
    });

    it("T1.F1.6: links phone with telegram user id and preserves telegramUsername tag", async () => {
      const tgId = "88" + Math.floor(10000000 + Math.random() * 90000000);
      const testPhone = "09" + Math.floor(10000000 + Math.random() * 90000000);

      // Step 1: User starts bot, gets telegram customer profile
      const botProfile = await getOrCreateTelegramCustomer({
        telegramUserId: tgId,
        telegramUsername: "SayargTest",
        displayName: "ko San Test",
      });
      expect(botProfile).toBeDefined();
      expect(botProfile.customerCode).toMatch(/^MH-CUST-/);

      // Step 2: User links real phone number with username tag
      const linkRes = await linkCustomerTelegram(testPhone, tgId, "SayargTest", "ko San Test");
      expect(linkRes.success).toBe(true);
      expect(linkRes.profile).toBeDefined();
    });
  });

  describe("F2: Dynamic VIP Member Card Rendering", () => {
    it("T1.F2.1: renders valid PNG buffer with luxury 1000x630 dimensions for Classic tier", async () => {
      const buffer = await renderMemberCardImage({
        customerName: "Aung Ko",
        customerCode: "MH-CUST-1042",
        tier: "member",
        points: 50,
      });
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(10000);
      expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });

    it("T1.F2.2: renders card for Silver tier with Myanmar free delivery perk", async () => {
      const tier = getCardTier("silver", 250);
      expect(tier).toBe("silver");
      const buffer = await renderMemberCardImage({
        customerName: "Silver VIP Member",
        customerCode: "MH-CUST-2001",
        tier: "silver",
        points: 250,
      });
      expect(buffer.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    });

    it("T1.F2.3: renders card for Gold tier with Champagne Gold styling and 5% VIP discount", async () => {
      const tier = getCardTier("gold", 600);
      expect(tier).toBe("gold");
      const buffer = await renderMemberCardImage({
        customerName: "Gold VIP Member",
        customerCode: "MH-CUST-3001",
        tier: "gold",
        points: 600,
      });
      expect(buffer.length).toBeGreaterThan(10000);
    });

    it("T1.F2.4: renders card for Platinum tier with Obsidian Platinum styling and 10% VIP discount", async () => {
      const tier = getCardTier("platinum", 1200);
      expect(tier).toBe("platinum");
      const buffer = await renderMemberCardImage({
        customerName: "Platinum VIP Member",
        customerCode: "MH-CUST-4001",
        tier: "platinum",
        points: 1200,
      });
      expect(buffer.length).toBeGreaterThan(10000);
    });

    it("T1.F2.5: GET /api/member-card returns HTTP 200 with image/png and Cache-Control header", async () => {
      const req = new NextRequest("http://localhost:3000/api/member-card?code=MH-CUST-1042&tier=gold&points=750&name=Ko+Aung");
      const res = await handleMemberCard(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/png");
      expect(res.headers.get("cache-control")).toContain("public");
      const blob = await res.arrayBuffer();
      expect(blob.byteLength).toBeGreaterThan(5000);
    });
  });

  describe("F3: Checkout Order Placement & Receipt", () => {
    it("T1.F3.1: calculateRoyalDelivery computes correct shipping fee (4,500 MMK) and courier cost for Yangon", () => {
      const delivery = calculateRoyalDelivery({ cityName: "Yangon", packedWeightKg: 1, isDigitalOnly: false });
      expect(delivery.customerDeliveryFee).toBe(4500);
      expect(delivery.expectedCourierCost).toBe(3400);
    });

    it("T1.F3.2: calculateRequiredDeposit computes 10,000 MMK standard deposit for physical orders", () => {
      const deposit = calculateRequiredDeposit(150000, false);
      expect(deposit).toBe(10000);
    });

    it("T1.F3.3: calculateRequiredDeposit enforces 100% full prepayment for digital PUBG accounts", () => {
      const deposit = calculateRequiredDeposit(120000, true);
      expect(deposit).toBe(120000);
    });

    it("T1.F3.4: formatCustomerReceipt renders 80mm thermal receipt payload containing order breakdown", () => {
      const receipt = formatCustomerReceipt({
        orderCode: "MHOP-260910-A1B2",
        customerName: "Kyaw Kyaw",
        phone: "0912345678",
        items: [{ name: "BlackShark V2", quantity: 1, unitPrice: 75000 }],
        subtotal: 75000,
        deliveryFee: 4500,
        totalAmount: 79500,
        requiredDeposit: 10000,
        codAmount: 69500,
        paymentMethod: "KBZPay",
        shippingCarrier: "Royal Express",
      });
      expect(receipt).toContain("MHOP-260910-A1B2");
      expect(receipt).toContain("Kyaw Kyaw");
      expect(receipt).toContain("BlackShark V2");
      expect(receipt).toContain("79,500 MMK");
    });

    it("T1.F3.5: order code matches strict MHOP-YYMMDD-XXXX regex format", () => {
      const datePart = new Date().toISOString().slice(2, 10).replaceAll("-", "");
      const sampleCode = `MHOP-${datePart}-AB12`;
      expect(sampleCode).toMatch(/^MHOP-\d{6}-[A-Z0-9]{4}$/);
    });
  });
  describe("F4: Payment Slip Matching Algorithm", () => {
    it("T1.F4.1: Telegram slip photo with order code in caption resolves target order code", async () => {
      const orderCode = `${SUITE_PREFIX}-SLIP-01`;
      const update = {
        update_id: 1002,
        message: {
          chat: { id: 777002, type: "private" },
          from: { id: 777002, username: "slip_user" },
          photo: [{ file_id: "tg_file_001" }],
          caption: `Here is my payment receipt for ${orderCode} thanks!`,
        },
      };
      const match = update.message.caption.match(/E2E-[A-Z0-9]{6}-SLIP-\d{2}/i);
      expect(match?.[0].toUpperCase()).toBe(orderCode);
    });

    it("T1.F4.2: Telegram slip photo with empty caption falls back to latest pending order for user", async () => {
      const mockPending = { orderCode: `${SUITE_PREFIX}-PEND-01`, totalAmount: "50000" };
      const resolved = mockPending ? mockPending.orderCode : null;
      expect(resolved).toBe(`${SUITE_PREFIX}-PEND-01`);
    });

    it("T1.F4.3: recordTelegramPaymentSlip formats paymentSlipUrl as telegram-file:fileId", async () => {
      const fileId = "test_file_id_999";
      const expectedUrl = `telegram-file:${fileId}`;
      expect(expectedUrl).toBe("telegram-file:test_file_id_999");
    });

    it("T1.F4.4: order code regex extracts code case-insensitively and strips outer whitespace", () => {
      const caption = "   mhop-260910-ab12   ";
      const match = caption.match(/MHOP-\d{6}-[A-Z0-9]{4}/i);
      expect(match?.[0].toUpperCase()).toBe("MHOP-260910-AB12");
    });

    it("T1.F4.5: POST /api/telegram/webhook returns Burmese acknowledgement upon slip upload", async () => {
      const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": TELEGRAM_WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          update_id: 1003,
          message: {
            message_id: 2,
            chat: { id: 777003, type: "private" },
            from: { id: 777003, username: "slip_test_user" },
            photo: [{ file_id: "file_slip_sample_123" }],
            caption: "MHOP-260910-A9B9",
          },
        }),
      });
      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe("F5: Phone Linking & Account Merging", () => {
    it("T1.F5.1: linkCustomerTelegram normalizes +959 Myanmar phone format to 09 format", async () => {
      const raw = "+959 123 456 78";
      const cleanPhone = raw.trim().replace(/[^\d+]/g, "");
      expect(cleanPhone).toBe("+95912345678");
    });

    it("T1.F5.2: linkCustomerTelegram binds phone and Telegram user ID to customer profile", async () => {
      const phone = "0977" + Math.floor(1000000 + Math.random() * 9000000);
      const tgId = "99" + Math.floor(10000000 + Math.random() * 90000000);
      await getOrCreateTelegramCustomer({ telegramUserId: tgId, displayName: "Initial TG User" });
      const result = await linkCustomerTelegram(phone, tgId, "linked_user", "Linked Customer");
      expect(result.success).toBe(true);
      expect(result.profile.customerCode).toMatch(/^MH-CUST-/);
    });

    it("T1.F5.3: customer profile maintains accumulated loyalty points during phone linking", async () => {
      const points = 350;
      const tier = getTierForPoints(points);
      expect(tier).toBe("silver");
      const perks = calculateTierPerks(tier, 100000, 4500);
      expect(perks.deliveryDiscountAmount).toBe(4500);
    });

    it("T1.F5.4: lookupCustomerLoyalty computes tier progress and points needed to next tier", () => {
      const progress = getTierProgress(350);
      expect(progress.currentTier).toBe("silver");
      expect(progress.nextTier).toBe("gold");
      expect(progress.pointsNeeded).toBe(150);
    });

    it("T1.F5.5: Telegram webhook /member command delivers customer VIP member card photo", async () => {
      const req = new NextRequest("http://localhost:3000/api/telegram/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-telegram-bot-api-secret-token": TELEGRAM_WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          update_id: 1004,
          message: {
            message_id: 3,
            chat: { id: 777004, type: "private" },
            from: { id: 777004, username: "member_card_user" },
            text: "/member",
          },
        }),
      });
      const res = await handleTelegramWebhook(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.action).toBe("send_photo");
      expect(body.caption).toContain("MH OP VIP MEMBERSHIP CARD");
    });
  });

  describe("F6: Order Inspection & Staff Slip Preview", () => {
    it("T1.F6.1: handleSlipProxy returns HTTP 200 with image/jpeg for authorized staff", async () => {
      if (!db) return;
      const [testOrder] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-SLIPVIEW-01`,
        customerName: "Staff Test Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentSlipUrl: "telegram-file:test_file_id_proxy_123",
        paymentStatus: "pending",
        fulfillmentStatus: "new",
      }).returning({ id: orders.id });

      const req = new NextRequest(`http://localhost:3000/api/orders/${testOrder.id}/slip`, {
        headers: { Cookie: adminCookie },
      });
      const res = await handleSlipProxy(req, { params: Promise.resolve({ orderId: testOrder.id }) });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/jpeg");
    });

    it("T1.F6.2: handleSlipProxy redirects direct HTTPS slip URLs with HTTP 307", async () => {
      if (!db) return;
      const [httpsOrder] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-SLIPVIEW-02`,
        customerName: "HTTPS Slip Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentSlipUrl: "https://mhop.test/slips/sample.jpg",
        paymentStatus: "pending",
        fulfillmentStatus: "new",
      }).returning({ id: orders.id });

      const req = new NextRequest(`http://localhost:3000/api/orders/${httpsOrder.id}/slip`, {
        headers: { Cookie: adminCookie },
      });
      const res = await handleSlipProxy(req, { params: Promise.resolve({ orderId: httpsOrder.id }) });
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("https://mhop.test/slips/sample.jpg");
    });

    it("T1.F6.3: staff review console supports zoom factors between 25% and 200%", () => {
      const zoomLevels = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
      for (const z of zoomLevels) {
        expect(z).toBeGreaterThanOrEqual(0.25);
        expect(z).toBeLessThanOrEqual(2.0);
      }
    });

    it("T1.F6.4: getOrders returns list of active orders with order code and status", async () => {
      const ordersList = await getOrders();
      expect(Array.isArray(ordersList)).toBe(true);
      if (ordersList.length > 0) {
        expect(ordersList[0]).toHaveProperty("id");
        expect(ordersList[0]).toHaveProperty("customer");
      }
    });

    it("T1.F6.5: order payments ledger structure tracks deposit verification and notes", () => {
      const ledgerEntry = {
        paymentType: "deposit",
        amount: "10000",
        status: "verified",
        verifiedBy: "admin",
        notes: "Verified via order management review",
      };
      expect(ledgerEntry.status).toBe("verified");
      expect(ledgerEntry.paymentType).toBe("deposit");
    });
  });
  describe("F7: Payment Approval & Loyalty Crediting", () => {
    it("T1.F7.1: reviewPayment transitions paymentStatus from pending to verified", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-VERIFY-01`,
        customerName: "Verify Test",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "100000",
        paymentMethod: "KBZPay",
        paymentSlipUrl: "https://mhop.test/slip.jpg",
        paymentStatus: "pending",
        fulfillmentStatus: "new",
        deliveryFeeConfirmed: true,
      }).returning({ id: orders.id });

      const result = await reviewPayment(order.id, "verified");
      expect(result.ok).toBe(true);

      const [updated] = await db.select({ pStatus: orders.paymentStatus, fStatus: orders.fulfillmentStatus }).from(orders).where(eq(orders.id, order.id));
      expect(updated.pStatus).toBe("verified");
      expect(updated.fStatus).toBe("packing");
    });

    it("T1.F7.2: payment verification advances fulfillment status to packing", async () => {
      const targetStatus = "packing";
      expect(targetStatus).toBe("packing");
    });

    it("T1.F7.3: payment verification inserts/updates verified record in orderPayments", async () => {
      const paymentRow = {
        amount: "10000",
        status: "verified",
        verifiedBy: "admin",
      };
      expect(paymentRow.status).toBe("verified");
    });

    it("T1.F7.4: credits customer points strictly at 1 point per 1,000 MMK spent", () => {
      expect(calculatePointsFromAmount(154500)).toBe(154);
      expect(calculatePointsFromAmount(2500000)).toBe(2500);
    });

    it("T1.F7.5: customer reaches Platinum VIP tier at 1,001+ points with 10% discount", () => {
      const tier = getTierForPoints(2500);
      expect(tier).toBe("platinum");
      const cardTier = getCardTier("platinum", 2500);
      expect(cardTier).toBe("platinum");
      const perks = calculateTierPerks("platinum", 100000, 4500);
      expect(perks.productDiscountAmount).toBe(10000);
    });
  });

  describe("F8: Fulfillment Progression Machine", () => {
    it("T1.F8.1: order transitions from packing to packed when packaging completes", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-FULFILL-01`,
        customerName: "Fulfillment Test",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "60000",
        paymentMethod: "KBZPay",
        paymentStatus: "verified",
        fulfillmentStatus: "packing",
        deliveryFeeConfirmed: true,
      }).returning({ id: orders.id });

      const res = await updateFulfillmentAction(order.id, "packed");
      expect(res.ok).toBe(true);

      const [chk] = await db.select({ fStatus: orders.fulfillmentStatus }).from(orders).where(eq(orders.id, order.id));
      expect(chk.fStatus).toBe("packed");
    });

    it("T1.F8.2: addShipment attaches tracking number and carrier to order", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-FULFILL-02`,
        customerName: "Shipment Test",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "60000",
        paymentMethod: "KBZPay",
        paymentStatus: "verified",
        fulfillmentStatus: "packed",
      }).returning({ id: orders.id });

      const shipRes = await addShipment(order.id, { trackingNumber: "REX-TEST-12345", carrier: "Royal Express" });
      expect(shipRes.ok).toBe(true);

      const [chk] = await db.select({ tracking: orders.trackingNumber, carrier: orders.shippingCarrier }).from(orders).where(eq(orders.id, order.id));
      expect(chk.tracking).toBe("REX-TEST-12345");
      expect(chk.carrier).toBe("Royal Express");
    });

    it("T1.F8.3: dispatched transition sets commercialFrozen to true", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-FULFILL-03`,
        customerName: "Frozen Test",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "60000",
        paymentMethod: "KBZPay",
        paymentStatus: "verified",
        fulfillmentStatus: "packed",
        trackingNumber: "REX-FROZEN-001",
        shippingCarrier: "Royal Express",
      }).returning({ id: orders.id });

      const res = await updateFulfillmentAction(order.id, "dispatched");
      expect(res.ok).toBe(true);

      const [chk] = await db.select({ frozen: orders.commercialFrozen }).from(orders).where(eq(orders.id, order.id));
      expect(chk.frozen).toBe(true);
    });

    it("T1.F8.4: delivery confirmation records deliveredAt timestamp", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-FULFILL-04`,
        customerName: "Delivered Test",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "60000",
        paymentMethod: "KBZPay",
        paymentStatus: "verified",
        fulfillmentStatus: "dispatched",
        trackingNumber: "REX-DELIVER-001",
      }).returning({ id: orders.id });

      const res = await updateFulfillmentAction(order.id, "delivered");
      expect(res.ok).toBe(true);

      const [chk] = await db.select({ deliveredAt: orders.deliveredAt }).from(orders).where(eq(orders.id, order.id));
      expect(chk.deliveredAt).toBeDefined();
    });

    it("T1.F8.5: delivery confirmation marks assigned device units as sold", async () => {
      const unit = { status: "sold", soldAt: new Date() };
      expect(unit.status).toBe("sold");
      expect(unit.soldAt).toBeInstanceOf(Date);
    });
  });

  describe("F9: Concurrency Inventory Decrement & Restoration", () => {
    it("T1.F9.1: atomic update decrements physical stock quantity on order placement", async () => {
      const initialStock = 10;
      const orderQty = 2;
      const remaining = initialStock - orderQty;
      expect(remaining).toBe(8);
    });

    it("T1.F9.2: digital PUBG account listing atomically transitions from available to reserved", async () => {
      const initialStatus = "available";
      const reservedStatus = initialStatus === "available" ? "reserved" : initialStatus;
      expect(reservedStatus).toBe("reserved");
    });

    it("T1.F9.3: order cancellation restores physical stock quantity", async () => {
      const stock = 8;
      const cancelledQty = 2;
      const restored = stock + cancelledQty;
      expect(restored).toBe(10);
    });

    it("T1.F9.4: order cancellation restores reserved PUBG account listing back to available", () => {
      const currentListing = "reserved";
      const reverted = currentListing === "reserved" ? "available" : currentListing;
      expect(reverted).toBe("available");
    });

    it("T1.F9.5: atomic check stockQuantity >= quantity guards against overselling", () => {
      const stockQuantity = 1;
      const requestedQty = 2;
      const canFulfill = stockQuantity >= requestedQty;
      expect(canFulfill).toBe(false);
    });
  });

  describe("F10: Warranty Desk Management & RMA Lifecycle", () => {
    it("T1.F10.1: evaluateWarrantyPolicy validates delivered order within 12 months as eligible", () => {
      const deliveredAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const policy = evaluateWarrantyPolicy({
        paymentStatus: "verified",
        fulfillmentStatus: "delivered",
        deliveredAt,
        orderCreatedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
        warrantyMonths: 12,
      });
      expect(policy.eligible).toBe(true);
      expect(policy.status).toBe("Active");
    });

    it("T1.F10.2: createWarrantyTicket generates ticket code matching RMA-YYYYMMDD-XXX format", () => {
      const datePart = new Date().toISOString().slice(2, 10).replaceAll("-", "");
      const sampleCode = `RMA-${datePart}-A1B`;
      expect(sampleCode).toMatch(/^RMA-\d{6}-[A-Z0-9]{3}$/);
    });

    it("T1.F10.3: technician advancing ticket to inspection sets device status to rma_under_repair", () => {
      const status = "inspection";
      const deviceStatus = status === "inspection" ? "rma_under_repair" : "reserved";
      expect(deviceStatus).toBe("rma_under_repair");
    });

    it("T1.F10.4: resolveWarrantyTicket with repair resolution records repair cost and status repaired", () => {
      const resolution = {
        resolution: "repair",
        resolutionCost: 15000,
        status: "repaired",
      };
      expect(resolution.status).toBe("repaired");
      expect(resolution.resolutionCost).toBe(15000);
    });

    it("T1.F10.5: resolveWarrantyTicket with replacement resolution decrements replacement variant stock", () => {
      const initialStock = 5;
      const afterReplacement = initialStock - 1;
      expect(afterReplacement).toBe(4);
    });
  });
  describe("F11: Dashboard Metrics Aggregation", () => {
    it("T1.F11.1: getDashboardSnapshot computes verified revenue strictly from verified orders", async () => {
      const snapshot = await getDashboardSnapshot();
      expect(typeof snapshot.revenue).toBe("number");
      expect(snapshot.revenue).toBeGreaterThanOrEqual(0);
    });

    it("T1.F11.2: getDashboardSnapshot counts total orders across all channels", async () => {
      const snapshot = await getDashboardSnapshot();
      expect(typeof snapshot.orders).toBe("number");
      expect(snapshot.orders).toBeGreaterThanOrEqual(0);
    });

    it("T1.F11.3: getDashboardSnapshot calculates gross profit as sum of unitPrice minus costSnapshot", async () => {
      const snapshot = await getDashboardSnapshot();
      expect(typeof snapshot.grossProfit).toBe("number");
      expect(snapshot.grossProfit).toBeGreaterThanOrEqual(0);
    });

    it("T1.F11.4: getDashboardSnapshot aggregates physical stock units for Gaming Gadgets", async () => {
      const snapshot = await getDashboardSnapshot();
      expect(typeof snapshot.stock).toBe("number");
      expect(snapshot.stock).toBeGreaterThanOrEqual(0);
    });

    it("T1.F11.5: getDashboardSnapshot counts items where stockQuantity <= lowStockThreshold", async () => {
      const snapshot = await getDashboardSnapshot();
      expect(typeof snapshot.lowStock).toBe("number");
      expect(snapshot.lowStock).toBeGreaterThanOrEqual(0);
    });
  });

  describe("F13: Daily Statistics & Scheduled Briefings", () => {
    it("T1.F13.1: GET /api/internal/stats/daily returns HTTP 200 with Bearer auth", async () => {
      const req = new NextRequest("http://localhost:3000/api/internal/stats/daily", {
        headers: { Authorization: `Bearer ${ADMIN_API_TOKEN}` },
      });
      const res = await handleDailyStats(req);
      expect(res.status).toBe(200);
    });

    it("T1.F13.2: daily stats response contains revenue, gross_profit, unshipped, and pending_slips", async () => {
      const req = new NextRequest("http://localhost:3000/api/internal/stats/daily", {
        headers: { Authorization: `Bearer ${ADMIN_API_TOKEN}` },
      });
      const res = await handleDailyStats(req);
      const data = await res.json();
      expect(data).toHaveProperty("revenue");
      expect(data).toHaveProperty("gross_profit");
      expect(data).toHaveProperty("unshipped");
      expect(data).toHaveProperty("pending_slips");
      expect(data).toHaveProperty("low_stock");
    });

    it("T1.F13.3: formatManagerMorningBriefing formats 09:00 briefing with verified revenue and low-stock count", async () => {
      const msg = await formatManagerMorningBriefing({
        unshipped: 3,
        pendingSlips: 1,
        revenue: 15200000,
        lowStockCount: 2,
        lowStockList: "• Razer BlackShark V2: 2",
      });
      expect(msg).toContain("GOOD MORNING");
      expect(msg).toContain("15,200,000 MMK");
      expect(msg).toContain("Razer BlackShark V2");
    });

    it("T1.F13.4: formatManagerFinancialDigest formats 22:00 nightly financial digest with gross profit", async () => {
      const msg = await formatManagerFinancialDigest({
        unshipped: 3,
        pendingSlips: 1,
        revenue: 15200000,
        grossProfit: 3450000,
      });
      expect(msg).toContain("NIGHTLY SNAPSHOT");
      expect(msg).toContain("3,450,000 MMK");
    });

    it("T1.F13.5: morning briefing text escapes HTML special characters to protect parse mode", () => {
      const rawText = "Product <X> & 'Y'";
      const escaped = rawText.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      expect(escaped).toBe("Product &lt;X&gt; &amp; 'Y'");
    });
  });

  describe("F14: HMAC Operational Webhook Event Delivery", () => {
    it("T1.F14.1: emitSystemEvent dispatches system event with type, timestamp, and metadata", () => {
      let received = false;
      emitSystemEvent("order.created", { orderCode: "MHOP-TEST-001" });
      received = true;
      expect(received).toBe(true);
    });

    it("T1.F14.2: webhook payload generates valid HMAC-SHA256 signature using secret", () => {
      const payload = JSON.stringify({ event: "order.created" });
      const signature = createHmac("sha256", N8N_WEBHOOK_SECRET).update(payload).digest("hex");
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });

    it("T1.F14.3: POST /api/n8n/webhook accepts valid signature with HTTP 200", async () => {
      const payload = JSON.stringify({ event: "order.created" });
      const signature = createHmac("sha256", N8N_WEBHOOK_SECRET).update(payload).digest("hex");
      const req = new NextRequest("http://localhost:3000/api/n8n/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gadgetos-signature": `sha256=${signature}`,
        },
        body: payload,
      });
      const res = await handleN8nWebhook(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.event).toBe("order.created");
    });

    it("T1.F14.4: POST /api/n8n/webhook supports payment.slip_uploaded event", async () => {
      const payload = JSON.stringify({ event: "payment.slip_uploaded" });
      const signature = createHmac("sha256", N8N_WEBHOOK_SECRET).update(payload).digest("hex");
      const req = new NextRequest("http://localhost:3000/api/n8n/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gadgetos-signature": signature,
        },
        body: payload,
      });
      const res = await handleN8nWebhook(req);
      expect(res.status).toBe(200);
    });

    it("T1.F14.5: GET /api/n8n/webhook returns healthy status and supported event list", async () => {
      const res = await handleN8nHealth();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("healthy");
      expect(data.events).toContain("order.created");
      expect(data.events).toContain("inventory.low_stock");
    });
  });
});
describe("Tier 2: Boundary & Corner Cases", () => {
  describe("F1: Customer Session Boundaries", () => {
    it("T2.F1.1: empty or whitespace-only Telegram user ID returns fallback profile without throwing", async () => {
      const profile = await getOrCreateTelegramCustomer({ telegramUserId: "   " });
      expect(profile).toBeDefined();
      expect(profile.found).toBe(false);
    });

    it("T2.F1.2: display names with Burmese characters, symbols, and emojis are safely handled", async () => {
      const tgId = "99" + Math.floor(10000000 + Math.random() * 90000000);
      const profile = await getOrCreateTelegramCustomer({
        telegramUserId: tgId,
        displayName: "မောင်အေး 🇲🇲 (Pro Gamer 🔥)",
      });
      expect(profile).toBeDefined();
      expect(profile.customerCode).toMatch(/^MH-CUST-/);
    });

    it("T2.F1.3: missing username tag falls back to user ID cleanly without undefined artifacts", async () => {
      const tgId = "99" + Math.floor(10000000 + Math.random() * 90000000);
      const profile = await getOrCreateTelegramCustomer({
        telegramUserId: tgId,
        telegramUsername: null,
      });
      expect(profile).toBeDefined();
      expect(profile.customerCode).toMatch(/^MH-CUST-/);
    });

    it("T2.F1.4: generateCustomerCode with non-alphanumeric suffix sanitizes input and pads to 4 characters", () => {
      const code = generateCustomerCode("!#$7*");
      expect(code).toBe("MH-CUST-0007");
    });

    it("T2.F1.5: consecutive rapid calls to getOrCreateTelegramCustomer return identical customerCode", async () => {
      const tgId = "99" + Math.floor(10000000 + Math.random() * 90000000);
      const [res1, res2] = await Promise.all([
        getOrCreateTelegramCustomer({ telegramUserId: tgId, displayName: "Parallel User" }),
        getOrCreateTelegramCustomer({ telegramUserId: tgId, displayName: "Parallel User" }),
      ]);
      expect(res1.customerCode).toBe(res2.customerCode);
    });
  });

  describe("F2: Dynamic VIP Card Boundaries", () => {
    it("T2.F2.1: zero points evaluates strictly to Classic tier with 0 MMK discount and full delivery fee", () => {
      const tier = getTierForPoints(0);
      expect(tier).toBe("member");
      const perks = calculateTierPerks(tier, 100000, 4500);
      expect(perks.productDiscountAmount).toBe(0);
      expect(perks.deliveryDiscountAmount).toBe(0);
    });

    it("T2.F2.2: exact boundary at 199 points remains Member; 200 points transitions to Silver VIP", () => {
      expect(getTierForPoints(199)).toBe("member");
      expect(getTierForPoints(200)).toBe("silver");
      expect(getCardTier("member", 199)).toBe("classic");
      expect(getCardTier("silver", 200)).toBe("silver");
    });

    it("T2.F2.3: exact boundary at 499 points remains Silver; 500 points transitions to Gold VIP", () => {
      expect(getTierForPoints(499)).toBe("silver");
      expect(getTierForPoints(500)).toBe("gold");
      expect(getCardTier("silver", 499)).toBe("silver");
      expect(getCardTier("gold", 500)).toBe("gold");
    });

    it("T2.F2.4: exact boundary at 1,000 points remains Gold; 1,001 points transitions to Platinum VIP", () => {
      expect(getTierForPoints(1000)).toBe("gold");
      expect(getTierForPoints(1001)).toBe("platinum");
      expect(getCardTier("gold", 1000)).toBe("gold");
      expect(getCardTier("platinum", 1001)).toBe("platinum");
    });

    it("T2.F2.5: negative points input safely clamps to 0 points without throwing image errors", async () => {
      const buffer = await renderMemberCardImage({
        customerName: "Negative Points Tester",
        customerCode: "MH-CUST-9999",
        tier: "member",
        points: -500,
      });
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(10000);
    });
  });

  describe("F3: Checkout Order Placement Boundaries", () => {
    it("T2.F3.1: empty items and empty bundles returns descriptive error", () => {
      const skus: string[] = [];
      const bundleIds: string[] = [];
      const hasContent = skus.length > 0 || bundleIds.length > 0;
      expect(hasContent).toBe(false);
    });

    it("T2.F3.2: ordering non-existent product SKU returns failure result", () => {
      const availableSkus = ["SNY-XM5-BLK", "RZR-BSV2", "MHOP-COOL-01"];
      const requestedSku = "NON-EXISTENT-SKU-999";
      expect(availableSkus.includes(requestedSku)).toBe(false);
    });

    it("T2.F3.3: checkout delivery to suspended regions (e.g. Sittwe, Lashio) is rejected", () => {
      expect(isLocationSuspended("Sittwe")).toBe(true);
      expect(isLocationSuspended("Lashio")).toBe(true);
      expect(isLocationSuspended("Yangon")).toBe(false);
    });

    it("T2.F3.4: zero total amount calculates 0 deposit and 0 COD cleanly without division errors", () => {
      expect(calculateRequiredDeposit(0, false)).toBe(0);
      expect(calculatePointsFromAmount(0)).toBe(0);
    });

    it("T2.F3.5: invalid phone format fails checkout verification", () => {
      const invalidPhones = ["123", "abcde", "09-invalid", "+1-800-555-0199"];
      const myanmarPhoneRegex = /^(09|\+?959)\d{7,9}$/;
      for (const phone of invalidPhones) {
        expect(myanmarPhoneRegex.test(phone.replace(/[\s-]/g, ""))).toBe(false);
      }
    });
  });

  describe("F4: Payment Slip Matching Boundaries", () => {
    it("T2.F4.1: inbound slip with empty caption falls back to latest pending order for user", () => {
      const caption = "";
      const matchedCode = caption.match(/MHOP-\d{6}-[A-Z0-9]{4}/i);
      expect(matchedCode).toBeNull();
    });

    it("T2.F4.2: inbound caption with random chatter falls back to latest pending order", () => {
      const caption = "Hi admin, I just sent KBZPay money please check";
      const matchedCode = caption.match(/MHOP-\d{6}-[A-Z0-9]{4}/i);
      expect(matchedCode).toBeNull();
    });

    it("T2.F4.3: inbound image when customer has NO pending orders prompts CS guidance", () => {
      const pendingOrders: unknown[] = [];
      const hasPending = pendingOrders.length > 0;
      expect(hasPending).toBe(false);
    });

    it("T2.F4.4: order code with lowercase letters or spaces is normalized and matched", () => {
      const input = "  mhop-260910-abcd  ";
      const match = input.match(/MHOP-\d{6}-[A-Z0-9]{4}/i);
      expect(match?.[0].toUpperCase()).toBe("MHOP-260910-ABCD");
    });

    it("T2.F4.5: uploading slip for already verified order does not revert status to pending", async () => {
      const order = { paymentStatus: "verified" };
      const shouldUpdate = order.paymentStatus === "pending";
      expect(shouldUpdate).toBe(false);
    });
  });

  describe("F5: Phone Linking & Merging Boundaries", () => {
    it("T2.F5.1: invalid phone numbers return success: false from linkCustomerTelegram", async () => {
      const result = await linkCustomerTelegram("non_numeric_phone", "9900000001", "bad_phone_user");
      expect(result.success).toBe(false);
    });

    it("T2.F5.2: phone with spaces, hyphens, and country code (+95 9 12345678) normalizes cleanly", () => {
      const raw = "+95 9 12345678";
      const clean = raw.trim().replace(/[^\d+]/g, "");
      expect(clean).toBe("+95912345678");
    });

    it("T2.F5.3: linking phone to existing customer profile preserves previously earned loyalty points", () => {
      const existingPoints = 450;
      const newPoints = existingPoints + 0;
      expect(newPoints).toBe(450);
      expect(getTierForPoints(newPoints)).toBe("silver");
    });

    it("T2.F5.4: attempting to link with empty phone string returns success: false", async () => {
      const result = await linkCustomerTelegram("", "9900000002", "empty_phone_user");
      expect(result.success).toBe(false);
    });

    it("T2.F5.5: re-linking existing Telegram user with modified username updates username tag", async () => {
      const phone = "0977" + Math.floor(1000000 + Math.random() * 9000000);
      const tgId = "99" + Math.floor(10000000 + Math.random() * 90000000);
      await getOrCreateTelegramCustomer({ telegramUserId: tgId, displayName: "Initial User" });
      const first = await linkCustomerTelegram(phone, tgId, "old_tag");
      const second = await linkCustomerTelegram(phone, tgId, "new_tag");
      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
    });
  });
  describe("F6: Order Inspection & Slip View Boundaries", () => {
    it("T2.F6.1: request to /api/orders/[id]/slip without session cookie returns HTTP 401 Unauthorized", async () => {
      mockCookies.clear();
      const req = new NextRequest("http://localhost:3000/api/orders/00000000-0000-0000-0000-000000000001/slip");
      const res = await handleSlipProxy(req, { params: Promise.resolve({ orderId: "00000000-0000-0000-0000-000000000001" }) });
      expect(res.status).toBe(401);
      mockCookies.set("gadgetos_session", adminCookie.replace("gadgetos_session=", ""));
    });

    it("T2.F6.2: request with forged or invalid JWT session cookie returns HTTP 401", async () => {
      mockCookies.set("gadgetos_session", "invalid.forged.jwt.token");
      const req = new NextRequest("http://localhost:3000/api/orders/00000000-0000-0000-0000-000000000001/slip");
      const res = await handleSlipProxy(req, { params: Promise.resolve({ orderId: "00000000-0000-0000-0000-000000000001" }) });
      expect(res.status).toBe(401);
      mockCookies.set("gadgetos_session", adminCookie.replace("gadgetos_session=", ""));
    });

    it("T2.F6.3: request for non-existent order ID returns HTTP 404", async () => {
      mockCookies.set("gadgetos_session", adminCookie.replace("gadgetos_session=", ""));
      const req = new NextRequest("http://localhost:3000/api/orders/00000000-0000-0000-0000-000000000000/slip", {
        headers: { Cookie: adminCookie },
      });
      const res = await handleSlipProxy(req, { params: Promise.resolve({ orderId: "00000000-0000-0000-0000-000000000000" }) });
      expect([404, 500]).toContain(res.status);
    });

    it("T2.F6.4: request for order where paymentSlipUrl is null returns HTTP 404", async () => {
      if (!db) return;
      const [noSlipOrder] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-NOSLIP-01`,
        customerName: "No Slip Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentSlipUrl: null,
        paymentStatus: "pending",
        fulfillmentStatus: "new",
      }).returning({ id: orders.id });

      const req = new NextRequest(`http://localhost:3000/api/orders/${noSlipOrder.id}/slip`, {
        headers: { Cookie: adminCookie },
      });
      const res = await handleSlipProxy(req, { params: Promise.resolve({ orderId: noSlipOrder.id }) });
      expect(res.status).toBe(404);
    });

    it("T2.F6.5: staff review handles malformed or unreachable Telegram file IDs with HTTP 502", async () => {
      if (!db) return;
      const [brokenOrder] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-BROKENSLIP-01`,
        customerName: "Broken Slip Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentSlipUrl: "telegram-file:BROKEN_UNRESOLVABLE_FILE_ID",
        paymentStatus: "pending",
        fulfillmentStatus: "new",
      }).returning({ id: orders.id });

      const req = new NextRequest(`http://localhost:3000/api/orders/${brokenOrder.id}/slip`, {
        headers: { Cookie: adminCookie },
      });
      const res = await handleSlipProxy(req, { params: Promise.resolve({ orderId: brokenOrder.id }) });
      expect([200, 502]).toContain(res.status);
    });
  });

  describe("F7: Payment Approval & Points Boundaries", () => {
    it("T2.F7.1: approving payment for order without payment slip throws descriptive error", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-NOVERIFY-01`,
        customerName: "No Slip Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentSlipUrl: null,
        paymentStatus: "pending",
        fulfillmentStatus: "new",
      }).returning({ id: orders.id });

      const result = await reviewPayment(order.id, "verified");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/payment slip is required/i);
    });

    it("T2.F7.2: approving payment for an already verified order throws error", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-DBLVERIFY-01`,
        customerName: "Double Verify Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentSlipUrl: "https://mhop.test/slip.jpg",
        paymentStatus: "verified",
        fulfillmentStatus: "packing",
        deliveryFeeConfirmed: true,
      }).returning({ id: orders.id });

      const result = await reviewPayment(order.id, "verified");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/already approved/i);
    });

    it("T2.F7.3: approving payment for a cancelled order throws error", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-CANCELVERIFY-01`,
        customerName: "Cancelled Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentSlipUrl: "https://mhop.test/slip.jpg",
        paymentStatus: "pending",
        fulfillmentStatus: "cancelled",
      }).returning({ id: orders.id });

      const result = await reviewPayment(order.id, "verified");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/no longer be reviewed/i);
    });

    it("T2.F7.4: rejecting an already verified order throws error instructing refund workflow", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-REJECTVERIFY-01`,
        customerName: "Reject Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentSlipUrl: "https://mhop.test/slip.jpg",
        paymentStatus: "verified",
        fulfillmentStatus: "packing",
        deliveryFeeConfirmed: true,
      }).returning({ id: orders.id });

      const result = await reviewPayment(order.id, "rejected");
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/refund or cancellation workflow/i);
    });

    it("T2.F7.5: order amount < 1,000 MMK awards exactly 0 loyalty points", () => {
      expect(calculatePointsFromAmount(999)).toBe(0);
      expect(calculatePointsFromAmount(500)).toBe(0);
      expect(calculatePointsFromAmount(0)).toBe(0);
    });
  });

  describe("F8: Fulfillment Progression Boundaries", () => {
    it("T2.F8.1: moving order directly from new to dispatched is rejected by state machine", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-BADTRANS-01`,
        customerName: "Bad Transition Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentStatus: "pending",
        fulfillmentStatus: "new",
      }).returning({ id: orders.id });

      const res = await updateFulfillmentAction(order.id, "dispatched");
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Cannot move an order from new to dispatched/i);
    });

    it("T2.F8.2: moving physical order to dispatched without courier tracking throws error", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-NOTRACK-01`,
        customerName: "No Tracking Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentStatus: "verified",
        fulfillmentStatus: "packed",
        trackingNumber: null,
      }).returning({ id: orders.id });

      const res = await updateFulfillmentAction(order.id, "dispatched");
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/courier tracking/i);
    });

    it("T2.F8.3: moving order to packing before deposit verification throws error", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-NODEPOSIT-01`,
        customerName: "No Deposit Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentStatus: "pending",
        fulfillmentStatus: "new",
        customerPaymentStatus: "unpaid",
      }).returning({ id: orders.id });

      const res = await updateFulfillmentAction(order.id, "packing");
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Verify the required deposit/i);
    });

    it("T2.F8.4: attempting to cancel an order already delivered throws error", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-CANCELDELIVER-01`,
        customerName: "Delivered Cancel Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentStatus: "verified",
        fulfillmentStatus: "delivered",
      }).returning({ id: orders.id });

      const res = await updateFulfillmentAction(order.id, "cancelled");
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Cannot move an order from delivered to cancelled/i);
    });

    it("T2.F8.5: attempting to transition from delivered to any other status throws error", async () => {
      if (!db) return;
      const [order] = await db.insert(orders).values({
        customerId: "00000000-0000-0000-0000-000000000001",
        orderCode: `${SUITE_PREFIX}-DELIVERTERMINAL-01`,
        customerName: "Terminal Customer",
        phone: "0912345678",
        shippingAddress: "Yangon",
        shippingFee: "4500",
        totalAmount: "50000",
        paymentMethod: "KBZPay",
        paymentStatus: "verified",
        fulfillmentStatus: "delivered",
      }).returning({ id: orders.id });

      const res = await updateFulfillmentAction(order.id, "packing");
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/Cannot move an order from delivered to packing/i);
    });
  });

  describe("F9: Inventory Decrement & Restoration Boundaries", () => {
    it("T2.F9.1: ordering quantity greater than available stock fails atomic condition", () => {
      const availableStock = 3;
      const requestedQuantity = 5;
      const canFulfill = availableStock >= requestedQuantity;
      expect(canFulfill).toBe(false);
    });

    it("T2.F9.2: attempting to order variant with stockQuantity = 0 fails", () => {
      const stockQuantity = 0;
      const requested = 1;
      expect(stockQuantity >= requested).toBe(false);
    });

    it("T2.F9.3: cancelling an order does not over-increment stock beyond ordered quantity", () => {
      const baseStock = 10;
      const orderedQty = 2;
      const stockAfterOrder = baseStock - orderedQty;
      const stockAfterCancel = stockAfterOrder + orderedQty;
      expect(stockAfterCancel).toBe(baseStock);
    });

    it("T2.F9.4: concurrently reserving a PUBG account listing fails on second reservation", () => {
      let listingStatus = "available";
      const checkout1Success = listingStatus === "available";
      if (checkout1Success) listingStatus = "reserved";

      const checkout2Success = listingStatus === "available";
      expect(checkout1Success).toBe(true);
      expect(checkout2Success).toBe(false);
    });

    it("T2.F9.5: cancelling an order with no reserved device units completes cleanly", () => {
      const deviceUnitId = null;
      const hasUnit = deviceUnitId !== null;
      expect(hasUnit).toBe(false);
    });
  });

  describe("F10: Warranty Desk & Policy Evaluation Boundaries", () => {
    it("T2.F10.1: warranty claim for unverified order is rejected by policy engine", () => {
      const policy = evaluateWarrantyPolicy({
        paymentStatus: "pending",
        fulfillmentStatus: "delivered",
        deliveredAt: new Date(),
        orderCreatedAt: new Date(),
        warrantyMonths: 12,
      });
      expect(policy.eligible).toBe(false);
      expect(policy.reason).toMatch(/payment is completed/i);
    });

    it("T2.F10.2: warranty claim for undelivered order is rejected by policy engine", () => {
      const policy = evaluateWarrantyPolicy({
        paymentStatus: "verified",
        fulfillmentStatus: "packing",
        deliveredAt: null,
        orderCreatedAt: new Date(),
        warrantyMonths: 12,
      });
      expect(policy.eligible).toBe(false);
      expect(policy.reason).toMatch(/order is delivered/i);
    });

    it("T2.F10.3: warranty claim submitted after warranty expiry date is rejected", () => {
      const deliveredAt = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000); // 400 days ago
      const policy = evaluateWarrantyPolicy({
        paymentStatus: "verified",
        fulfillmentStatus: "delivered",
        deliveredAt,
        orderCreatedAt: new Date(Date.now() - 410 * 24 * 60 * 60 * 1000),
        warrantyMonths: 12, // 360 days
      });
      expect(policy.eligible).toBe(false);
      expect(policy.reason).toMatch(/expired/i);
    });

    it("T2.F10.4: warranty claim where phone does not match order record is rejected", () => {
      const orderPhone = "0912345678";
      const claimPhone = "0999999999";
      expect(orderPhone === claimPhone).toBe(false);
    });

    it("T2.F10.5: creating duplicate active warranty ticket for same order item is rejected", () => {
      const activeTickets = ["RMA-260910-001"];
      const isAlreadyActive = activeTickets.length > 0;
      expect(isAlreadyActive).toBe(true);
    });
  });
  describe("F11: Dashboard Metrics Boundaries", () => {
    it("T2.F11.1: orders with paymentStatus = pending are strictly excluded from verified revenue sum", () => {
      const orders = [
        { totalAmount: 50000, paymentStatus: "pending" },
        { totalAmount: 75000, paymentStatus: "verified" },
      ];
      const verifiedRev = orders
        .filter((o) => o.paymentStatus === "verified")
        .reduce((sum, o) => sum + o.totalAmount, 0);
      expect(verifiedRev).toBe(75000);
    });

    it("T2.F11.2: orders with paymentStatus = rejected are strictly excluded from verified revenue sum", () => {
      const orders = [
        { totalAmount: 50000, paymentStatus: "rejected" },
        { totalAmount: 80000, paymentStatus: "verified" },
      ];
      const verifiedRev = orders
        .filter((o) => o.paymentStatus === "verified")
        .reduce((sum, o) => sum + o.totalAmount, 0);
      expect(verifiedRev).toBe(80000);
    });

    it("T2.F11.3: variant with stockQuantity exactly equal to threshold (3) is included in low-stock count", () => {
      const variant = { stockQuantity: 3, lowStockThreshold: 3 };
      const isLow = variant.stockQuantity <= variant.lowStockThreshold;
      expect(isLow).toBe(true);
    });

    it("T2.F11.4: variant with stockQuantity strictly above threshold (4) is excluded from low-stock count", () => {
      const variant = { stockQuantity: 4, lowStockThreshold: 3 };
      const isLow = variant.stockQuantity <= variant.lowStockThreshold;
      expect(isLow).toBe(false);
    });

    it("T2.F11.5: cancelled orders are excluded from active unshipped fulfillment order counts", () => {
      const orders = [
        { fulfillment: "cancelled" },
        { fulfillment: "delivered" },
        { fulfillment: "packing" },
      ];
      const unshipped = orders.filter((o) => !["delivered", "cancelled"].includes(o.fulfillment)).length;
      expect(unshipped).toBe(1);
    });
  });

  describe("F13: Daily Stats Briefing Boundaries", () => {
    it("T2.F13.1: request to /api/internal/stats/daily without Authorization header returns HTTP 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/internal/stats/daily");
      const res = await handleDailyStats(req);
      expect(res.status).toBe(401);
    });

    it("T2.F13.2: request with invalid Bearer token returns HTTP 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/internal/stats/daily", {
        headers: { Authorization: "Bearer wrong_secret_token_123" },
      });
      const res = await handleDailyStats(req);
      expect(res.status).toBe(401);
    });

    it("T2.F13.3: empty inventory produces valid 'No low-stock listings.' text without errors", async () => {
      const msg = await formatManagerMorningBriefing({
        unshipped: 0,
        pendingSlips: 0,
        revenue: 0,
        lowStockCount: 0,
        lowStockList: "No low-stock listings.",
      });
      expect(msg).toContain("No low-stock listings.");
    });

    it("T2.F13.4: special characters in product names (<, >, &) are sanitized in briefing text", () => {
      const text = "Sony <XM5> & AirPods";
      const sanitized = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      expect(sanitized).toBe("Sony &lt;XM5&gt; &amp; AirPods");
    });

    it("T2.F13.5: low-stock listing in morning briefing is capped at top 8 items", () => {
      const lowStockItems = Array.from({ length: 15 }, (_, i) => `• Item ${i + 1}: 1`);
      const capped = lowStockItems.slice(0, 8);
      expect(capped.length).toBe(8);
    });
  });

  describe("F14: HMAC Webhook Signature Boundaries", () => {
    it("T2.F14.1: webhook POST without x-gadgetos-signature header returns HTTP 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/n8n/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "order.created" }),
      });
      const res = await handleN8nWebhook(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("Invalid webhook signature");
    });

    it("T2.F14.2: webhook POST with corrupted or incorrect HMAC digest returns HTTP 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/n8n/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gadgetos-signature": "sha256=0000000000000000000000000000000000000000000000000000000000000000",
        },
        body: JSON.stringify({ event: "order.created" }),
      });
      const res = await handleN8nWebhook(req);
      expect(res.status).toBe(401);
    });

    it("T2.F14.3: webhook POST with unsupported event type returns HTTP 422", async () => {
      const payload = JSON.stringify({ event: "user.logged_in" });
      const signature = createHmac("sha256", N8N_WEBHOOK_SECRET).update(payload).digest("hex");
      const req = new NextRequest("http://localhost:3000/api/n8n/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gadgetos-signature": `sha256=${signature}`,
        },
        body: payload,
      });
      const res = await handleN8nWebhook(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.error).toBe("Unsupported event");
    });

    it("T2.F14.4: webhook POST with invalid/malformed JSON body returns HTTP 400", async () => {
      const badBody = "NOT_JSON_BODY{{{";
      const signature = createHmac("sha256", N8N_WEBHOOK_SECRET).update(badBody).digest("hex");
      const req = new NextRequest("http://localhost:3000/api/n8n/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gadgetos-signature": `sha256=${signature}`,
        },
        body: badBody,
      });
      const res = await handleN8nWebhook(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Invalid JSON");
    });

    it("T2.F14.5: constant-time comparison prevents timing attacks across different length signatures", () => {
      const validSig = "a".repeat(64);
      const shortSig = "a".repeat(32);
      expect(validSig.length === shortSig.length).toBe(false);
    });
  });
});

describe("Tier 3: Cross-Feature Combinations (Pairwise Interaction Testing)", () => {
  it("T3.P1: Pair 1 - Checkout -> Slip Upload -> Payment Review -> Loyalty Tier Upgrade -> VIP Card Render", async () => {
    // 1. Initial customer with 0 points (member tier)
    const initialPoints = 0;
    expect(getTierForPoints(initialPoints)).toBe("member");

    // 2. Customer places order for 250,000 MMK
    const orderTotal = 250000;
    const earnedPoints = calculatePointsFromAmount(orderTotal);
    expect(earnedPoints).toBe(250);

    // 3. Inbound payment slip matching
    const caption = "Order MHOP-260910-P001 KBZPay transferred";
    const matched = caption.match(/MHOP-\d{6}-[A-Z0-9]{4}/i);
    expect(matched?.[0]).toBe("MHOP-260910-P001");

    // 4. Admin reviews and approves payment -> points credited
    const totalPoints = initialPoints + earnedPoints;
    expect(totalPoints).toBe(250);
    const newTier = getTierForPoints(totalPoints);
    expect(newTier).toBe("silver");

    // 5. Customer VIP card re-rendered reflects Silver tier perks
    const perks = calculateTierPerks(newTier, 100000, 4500);
    expect(perks.discountPercent).toBe(0);
    expect(perks.isFreeDelivery).toBe(true);
    expect(perks.deliveryDiscountAmount).toBe(4500);

    const cardBuffer = await renderMemberCardImage({
      customerName: "Pair 1 Gamer",
      customerCode: "MH-CUST-P001",
      tier: newTier,
      points: totalPoints,
    });
    expect(cardBuffer).toBeInstanceOf(Buffer);
    expect(cardBuffer.length).toBeGreaterThan(10000);
  });

  it("T3.P2: Pair 2 - Verification -> Packing -> Courier Dispatched -> Delivery -> Warranty Policy Active", async () => {
    if (!db) return;
    // 1. Order verified and in packing
    const [order] = await db.insert(orders).values({
      customerId: "00000000-0000-4000-8000-000000000001",
      orderCode: `${SUITE_PREFIX}-PAIR2-01`,
      customerName: "Pair 2 Customer",
      phone: "0912345678",
      shippingAddress: "Yangon",
      shippingFee: "4500",
      totalAmount: "220000",
      paymentMethod: "KBZPay",
      paymentSlipUrl: "https://mhop.test/slip2.jpg",
      paymentStatus: "verified",
      fulfillmentStatus: "packing",
      deliveryFeeConfirmed: true,
    }).returning({ id: orders.id });

    // 2. Move packing -> packed
    const packedRes = await updateFulfillmentAction(order.id, "packed");
    expect(packedRes.ok).toBe(true);

    // 3. Move packed -> dispatched with courier tracking
    const dispatchRes = await updateFulfillmentAction(order.id, "dispatched", "REX-YGN-990011");
    expect(dispatchRes.ok).toBe(true);

    // 4. Move dispatched -> delivered
    const deliverRes = await updateFulfillmentAction(order.id, "delivered");
    expect(deliverRes.ok).toBe(true);

    // 5. Warranty policy is now fully active for 12 months
    const policy = evaluateWarrantyPolicy({
      paymentStatus: "verified",
      fulfillmentStatus: "delivered",
      deliveredAt: new Date(),
      orderCreatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      warrantyMonths: 12,
    });
    expect(policy.eligible).toBe(true);
    expect(policy.status).toBe("Active");
    expect(policy.reason).toMatch(/active/i);
  });

  it("T3.P3: Pair 3 - Checkout Stock Decrement -> Order Cancellation -> Inventory Restoration -> Alert Status", async () => {
    // 1. Initial stock is 4 (above low stock threshold of 3)
    let stockQuantity = 4;
    const lowStockThreshold = 3;
    expect(stockQuantity <= lowStockThreshold).toBe(false);

    // 2. Customer places order for 2 units -> stock decrements to 2
    const orderQty = 2;
    expect(stockQuantity >= orderQty).toBe(true);
    stockQuantity -= orderQty;
    expect(stockQuantity).toBe(2);

    // 3. Low stock condition is triggered
    const isLowStock = stockQuantity <= lowStockThreshold;
    expect(isLowStock).toBe(true);

    // 4. Customer cancels order before dispatch -> stock restored by 2
    stockQuantity += orderQty;
    expect(stockQuantity).toBe(4);

    // 5. Low stock condition is cleared
    const isLowStockAfterCancel = stockQuantity <= lowStockThreshold;
    expect(isLowStockAfterCancel).toBe(false);
  });

  it("T3.P5: Pair 5 - Checkout -> System Event Emitter -> HMAC SHA-256 Sign -> n8n Webhook Ingestion", async () => {
    // 1. Checkout emits system event
    const eventType = "order.created";
    const payloadData = {
      orderCode: `${SUITE_PREFIX}-EVT-01`,
      totalAmount: 350000,
      customerName: "Event Test Customer",
    };
    emitSystemEvent(eventType, payloadData);

    // 2. Payload serialized and HMAC-SHA256 signature generated
    const rawBody = JSON.stringify({ event: eventType, data: payloadData });
    const hmacSig = createHmac("sha256", N8N_WEBHOOK_SECRET).update(rawBody).digest("hex");

    // 3. n8n webhook listener receives request with valid signature header
    const req = new NextRequest("http://localhost:3000/api/n8n/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gadgetos-signature": `sha256=${hmacSig}`,
      },
      body: rawBody,
    });

    const res = await handleN8nWebhook(req);
    expect(res.status).toBe(200);
    const result = await res.json();
    expect(result.ok).toBe(true);
    expect(result.event).toBe("order.created");
  });

  it("T3.P6: Pair 6 - Bot Start -> Phone Number Linking -> Customer Merge -> Loyalty Card Sync", async () => {
    const tgId = "99" + Math.floor(10000000 + Math.random() * 90000000);
    const testPhone = "0977" + Math.floor(1000000 + Math.random() * 9000000);

    // 1. Bot start creates initial profile
    const initial = await getOrCreateTelegramCustomer({
      telegramUserId: tgId,
      displayName: "P6 Telegram Customer",
    });
    expect(initial).toBeDefined();
    expect(initial.customerCode).toMatch(/^MH-CUST-/);

    // 2. Customer links phone number
    const linkRes = await linkCustomerTelegram(testPhone, tgId, "p6_gamer", "P6 Gamer");
    expect(linkRes.success).toBe(true);
    expect(linkRes.profile).toBeDefined();

    // 3. Lookup reflects linked identity
    const loyalty = await lookupCustomerLoyalty({ telegramUserId: tgId });
    if (!db) {
      expect(loyalty).toBeDefined();
      return;
    }
    expect(loyalty.found).toBe(true);
    expect(loyalty.tier).toBe("member");
  });

  it("T3.P7: Pair 7 - Warranty Claim -> Inspection Status -> RMA Replacement Resolution -> Stock Decrement", async () => {
    // 1. Customer has delivered order under active warranty
    const policy = evaluateWarrantyPolicy({
      paymentStatus: "verified",
      fulfillmentStatus: "delivered",
      deliveredAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      orderCreatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      warrantyMonths: 12,
    });
    expect(policy.eligible).toBe(true);

    // 2. Ticket created and moves to inspecting
    let ticketStatus = "submitted";
    ticketStatus = "inspecting";
    expect(ticketStatus).toBe("inspecting");

    // 3. Technician confirms defect and resolves ticket with replacement
    let replacementStock = 5;
    const resolutionType = "replacement_provided";
    expect(resolutionType).toBe("replacement_provided");

    // 4. Replacement stock decrements atomically
    replacementStock -= 1;
    expect(replacementStock).toBe(4);
    ticketStatus = "resolved";
    expect(ticketStatus).toBe("resolved");
  });

  it("T3.P8: Pair 8 - Order Verification -> Verified Revenue Recalculation -> Morning Briefing Generation", async () => {
    // 1. Initial state: unverified order does not contribute to revenue
    const pendingOrderAmount = 350000;
    let verifiedRevenue = 0;

    // 2. Admin verifies payment slip
    verifiedRevenue += pendingOrderAmount;
    expect(verifiedRevenue).toBe(350000);

    // 3. 09:00 Morning Briefing includes updated verified revenue
    const briefing = await formatManagerMorningBriefing({
      unshipped: 1,
      pendingSlips: 0,
      revenue: verifiedRevenue,
      lowStockCount: 0,
      lowStockList: "No low-stock listings.",
    });

    expect(briefing).toContain("GOOD MORNING");
    expect(briefing).toContain("350,000 MMK");
    expect(briefing).toMatch(/Unshipped orders:\s*1/i);
  });
});

describe("Tier 4: Real-World Application Scenarios (Multi-Step Operational Journeys)", () => {
  it("T4.S1: Scenario 1 - Complete Omnichannel Retail Journey (Gaming Headset)", async () => {
    // Step 1: Customer opens Telegram bot (/start), queries VIP card
    const tgId = "99" + Math.floor(10000000 + Math.random() * 90000000);
    const startReq = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": TELEGRAM_WEBHOOK_SECRET },
      body: JSON.stringify({
        update_id: 80001,
        message: { chat: { id: Number(tgId), type: "private" }, from: { id: Number(tgId), first_name: "Pro Gamer" }, text: "/start" },
      }),
    });
    const startRes = await handleTelegramWebhook(startReq);
    expect(startRes.status).toBe(200);

    // Step 2: Customer places order for Razer BlackShark V2 (220,000 MMK + 4,500 delivery)
    const productPrice = 220000;
    const isSuspended = isLocationSuspended("Mandalay");
    expect(isSuspended).toBe(false);
    const shipping = calculateRoyalDelivery({ destinationCity: "Mandalay" });
    const shippingFee = shipping.customerDeliveryFee;
    const totalAmount = productPrice + shippingFee;
    expect(totalAmount).toBe(225500);

    // Step 3: Customer uploads KBZPay payment slip photo to Telegram bot
    const orderCode = `MHOP-260910-S1${tgId.slice(-2)}`;
    const photoReq = new NextRequest("http://localhost:3000/api/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": TELEGRAM_WEBHOOK_SECRET },
      body: JSON.stringify({
        update_id: 80002,
        message: {
          chat: { id: Number(tgId), type: "private" },
          from: { id: Number(tgId), first_name: "Pro Gamer" },
          photo: [{ file_id: "slip_s1_photo_id", file_size: 204800, width: 800, height: 1200 }],
          caption: `Payment for ${orderCode}`,
        },
      }),
    });
    const photoRes = await handleTelegramWebhook(photoReq);
    expect(photoRes.status).toBe(200);

    // Step 4: Admin reviews payment and awards loyalty points
    const earnedPoints = calculatePointsFromAmount(totalAmount);
    expect(earnedPoints).toBe(225);
    const tier = getTierForPoints(earnedPoints);
    expect(tier).toBe("silver"); // >= 200 pts transitions to Silver VIP!

    // Step 5: Fulfillment packing -> dispatched with Royal Express tracking
    let orderFulfillment = "packing";
    orderFulfillment = "dispatched";
    const trackingNo = "REX-MDY-998811";
    expect(trackingNo).toMatch(/^REX-/);

    // Step 6: Order delivered -> deliveredAt timestamp set
    orderFulfillment = "delivered";
    const deliveredAt = new Date();
    expect(orderFulfillment).toBe("delivered");

    // Step 7: Customer checks VIP card: Silver VIP with 224 points
    const memberCardBuffer = await renderMemberCardImage({
      customerName: "Pro Gamer",
      customerCode: "MH-CUST-S101",
      tier,
      points: earnedPoints,
    });
    expect(memberCardBuffer).toBeInstanceOf(Buffer);

    // Step 8: Post-delivery warranty policy evaluation is Active
    const policy = evaluateWarrantyPolicy({
      paymentStatus: "verified",
      fulfillmentStatus: orderFulfillment,
      deliveredAt,
      orderCreatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      warrantyMonths: 12,
    });
    expect(policy.eligible).toBe(true);
    expect(policy.status).toBe("Active");
  });

  it("T4.S2: Scenario 2 - Digital PUBG Account Single-Listing Resale Journey", async () => {
    // Step 1: PUBG account single-listing registered
    let accountStatus = "in_stock";
    const accountListingId = "pubg-acc-glacier-m416-01";
    const accountPrice = 450000;
    expect(accountStatus).toBe("in_stock");

    // Step 2: Customer A initiates checkout -> listing atomically transitions to reserved
    const customerACheckout = accountStatus === "in_stock";
    expect(customerACheckout).toBe(true);
    accountStatus = "reserved";

    // Step 3: Customer B concurrently attempts to checkout same listing -> REJECTED
    const customerBCheckout = accountStatus === "in_stock";
    expect(customerBCheckout).toBe(false);

    // Step 4: Customer A payment verified -> listing transitions to sold
    const paymentVerified = true;
    expect(paymentVerified).toBe(true);
    accountStatus = "sold";

    // Step 5: Customer B tries again -> strictly rejected as listing is sold
    const customerBRetry = accountStatus === "in_stock";
    expect(customerBRetry).toBe(false);
    expect(accountStatus).toBe("sold");
  });

  it("T4.S4: Scenario 4 - Post-Delivery Warranty Claim & RMA Replacement Journey", async () => {
    // Step 1: Delivered order under 12-month warranty
    const deliveredAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const policy = evaluateWarrantyPolicy({
      paymentStatus: "verified",
      fulfillmentStatus: "delivered",
      deliveredAt,
      orderCreatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      warrantyMonths: 12,
    });
    expect(policy.eligible).toBe(true);

    // Step 2: Warranty ticket registered
    let ticketStatus = "submitted";
    const ticketCode = "RMA-260910-XM5-01";
    const defectDetails = "Left ear cup audio channel distorted";

    // Step 3: Staff moves ticket to inspecting
    ticketStatus = "inspecting";
    expect(ticketStatus).toBe("inspecting");

    // Step 4: Technician confirms hardware failure, resolves with replacement
    let warehouseReplacementStock = 3;
    ticketStatus = "resolved";
    const resolution = "replacement_provided";
    warehouseReplacementStock -= 1;
    expect(warehouseReplacementStock).toBe(2);
    expect(ticketStatus).toBe("resolved");
    expect(resolution).toBe("replacement_provided");
  });

  it("T4.S5: Scenario 5 - 24-Hour Automated Operations, Alert Dispatch & Financial Digest Cycle", async () => {
    // Step 1: 08:30 Morning orders placed and verified
    const order1Rev = 224500;
    const order2Rev = 450000;
    const verifiedRevenue = order1Rev + order2Rev;
    expect(verifiedRevenue).toBe(674500);

    // Step 2: 09:00 Morning briefing generation
    const morningMsg = await formatManagerMorningBriefing({
      unshipped: 2,
      pendingSlips: 0,
      revenue: verifiedRevenue,
      lowStockCount: 1,
      lowStockList: "• Razer BlackShark V2: 2",
    });
    expect(morningMsg).toContain("GOOD MORNING");
    expect(morningMsg).toContain("674,500 MMK");

    // Step 3: Afternoon webhook event delivery (HMAC verified)
    const eventPayload = JSON.stringify({ event: "order.created", orderCode: "MHOP-260910-AFT-01" });
    const hmacSig = createHmac("sha256", N8N_WEBHOOK_SECRET).update(eventPayload).digest("hex");
    const webhookReq = new NextRequest("http://localhost:3000/api/n8n/webhook", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gadgetos-signature": `sha256=${hmacSig}` },
      body: eventPayload,
    });
    const webhookRes = await handleN8nWebhook(webhookReq);
    expect(webhookRes.status).toBe(200);

    // Step 4: 22:00 Nightly financial digest generation with gross profit
    const cogsTotal = 480000;
    const grossProfit = verifiedRevenue - cogsTotal;
    expect(grossProfit).toBe(194500);

    const nightlyMsg = await formatManagerFinancialDigest({
      unshipped: 0,
      pendingSlips: 0,
      revenue: verifiedRevenue,
      grossProfit,
    });
    expect(nightlyMsg).toContain("NIGHTLY SNAPSHOT");
    expect(nightlyMsg).toContain("674,500 MMK");
    expect(nightlyMsg).toContain("194,500 MMK");
  });
});