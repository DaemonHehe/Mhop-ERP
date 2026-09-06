import { db } from "@/db";
import {
  deviceUnits,
  orderItems,
  orders,
  productVariants,
  products,
  tickets,
} from "@/db/schema";
import { evaluateWarrantyPolicy } from "@/lib/warranty-policy";
import { getCustomers } from "@/lib/services/customer.service";
import { getInventory } from "@/lib/services/stock.service";
import { getOrders } from "@/lib/services/order.service";
import { getGeminiConfig, getOpenRouterConfig } from "@/lib/services/settings.service";
import { eq, sql } from "drizzle-orm";

export interface CopilotMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface CopilotToolCall {
  name: string;
  args: Record<string, unknown>;
  summary: string;
}

export interface CopilotResponse {
  answer: string;
  mode: "gemini" | "openrouter" | "pattern_fallback";
  model: string;
  toolCalls: CopilotToolCall[];
}

// ---------------------------------------------------------------------------
// Internal Data Tools
// ---------------------------------------------------------------------------

const normalize = (val?: string | null) => (val || "").toLowerCase().trim();

/**
 * 1. Search Orders
 */
export async function searchInternalOrders(params: {
  query?: string;
  status?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(1, params.limit || 5), 15);
  const q = normalize(params.query);
  const statusQ = normalize(params.status);

  try {
    const allOrders = await getOrders();
    const filtered = allOrders.filter((order) => {
      const matchQuery =
        !q ||
        normalize(order.orderCode).includes(q) ||
        normalize(order.id).includes(q) ||
        normalize(order.customer).includes(q) ||
        normalize(order.phone).includes(q) ||
        normalize(order.item).includes(q) ||
        normalize(order.address).includes(q);

      const matchStatus =
        !statusQ ||
        normalize(order.payment).includes(statusQ) ||
        normalize(order.fulfillment).includes(statusQ);

      return matchQuery && matchStatus;
    });

    return filtered.slice(0, limit).map((o) => ({
      orderCode: o.orderCode || o.id,
      customer: o.customer,
      phone: o.phone,
      item: o.item,
      amount: `${o.amount.toLocaleString()} MMK`,
      paymentStatus: o.payment,
      fulfillmentStatus: o.fulfillment,
      channel: o.channel,
      date: o.created,
      address: o.address,
      trackingNumber: o.trackingNumber || null,
      carrier: o.shippingCarrier || null,
      slipUrl: o.paymentSlipUrl || null,
    }));
  } catch (err) {
    console.error("[searchInternalOrders error]", err);
    return [];
  }
}

/**
 * 2. Search Customers
 */
export async function searchInternalCustomers(params: {
  query?: string;
  limit?: number;
}) {
  const limit = Math.min(Math.max(1, params.limit || 5), 15);
  const q = normalize(params.query);

  try {
    const allCustomers = await getCustomers();
    const filtered = allCustomers.filter((c) => {
      if (!q) return true;
      return (
        normalize(c.name).includes(q) ||
        normalize(c.phone).includes(q) ||
        normalize(c.telegramUserId).includes(q) ||
        normalize(c.primaryAddress).includes(q)
      );
    });

    return filtered.slice(0, limit).map((c) => ({
      name: c.name,
      phone: c.phone,
      telegramId: c.telegramUserId || "Not linked",
      address: c.primaryAddress || "None recorded",
      totalOrders: c.orders,
      lifetimeSpend: `${c.lifetime.toLocaleString()} MMK`,
      lastOrderDate: c.last || "N/A",
    }));
  } catch (err) {
    console.error("[searchInternalCustomers error]", err);
    return [];
  }
}

/**
 * 3. Lookup Warranty
 */
export async function lookupInternalWarranty(params: {
  orderCode?: string;
  phone?: string;
  identifier?: string;
}) {
  const codeQ = normalize(params.orderCode);
  const phoneQ = normalize(params.phone);
  const idQ = normalize(params.identifier);

  if (!db) {
    // Demo fallback
    const allOrders = await getOrders();
    const matched = allOrders.find(
      (o) =>
        (codeQ &&
          (normalize(o.orderCode).includes(codeQ) ||
            normalize(o.id).includes(codeQ))) ||
        (phoneQ && normalize(o.phone).includes(phoneQ)),
    );
    if (!matched) return null;

    const policy = evaluateWarrantyPolicy({
      paymentStatus: matched.payment,
      fulfillmentStatus: matched.fulfillment,
      deliveredAt: null,
      orderCreatedAt: new Date(),
      warrantyMonths: 12,
    });

    return {
      orderCode: matched.orderCode || matched.id,
      customer: matched.customer,
      phone: matched.phone || "—",
      paymentStatus: matched.payment,
      fulfillmentStatus: matched.fulfillment,
      items: [
        {
          name: matched.item,
          identifier: null,
          warrantyMonths: 12,
          coverageStatus: policy.status,
          warrantyStarts: policy.startAt.toLocaleDateString("en-GB", {
            timeZone: "Asia/Yangon",
          }),
          validUntil: policy.expiresAt.toLocaleDateString("en-GB", {
            timeZone: "Asia/Yangon",
          }),
          reason: policy.reason,
        },
      ],
    };
  }

  try {
    const rows = await db
      .select({
        orderCode: orders.orderCode,
        customer: orders.customerName,
        phone: orders.phone,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        createdAt: orders.createdAt,
        deliveredAt: orders.deliveredAt,
        name: products.name,
        warrantyMonths: productVariants.warrantyMonths,
        serial: deviceUnits.serialNumber,
        imei: deviceUnits.imeiNumber,
      })
      .from(orders)
      .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
      .innerJoin(products, eq(products.id, orderItems.productId))
      .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
      .leftJoin(deviceUnits, eq(deviceUnits.id, orderItems.deviceUnitId))
      .where(
        sql`(${orders.orderCode} ILIKE ${`%${codeQ || ""}%`} OR ${orders.phone} ILIKE ${`%${phoneQ || ""}%`} OR ${deviceUnits.serialNumber} ILIKE ${`%${idQ || ""}%`} OR ${deviceUnits.imeiNumber} ILIKE ${`%${idQ || ""}%`})`,
      )
      .limit(10);

    if (!rows.length) return null;

    const first = rows[0];
    return {
      orderCode: first.orderCode,
      customer: first.customer,
      phone: first.phone,
      paymentStatus: first.paymentStatus,
      fulfillmentStatus: first.fulfillmentStatus,
      items: rows.map((row) => {
        const policy = evaluateWarrantyPolicy({
          paymentStatus: row.paymentStatus,
          fulfillmentStatus: row.fulfillmentStatus,
          deliveredAt: row.deliveredAt,
          orderCreatedAt: row.createdAt,
          warrantyMonths: row.warrantyMonths,
        });
        return {
          name: row.name,
          identifier: row.imei || row.serial || null,
          warrantyMonths: row.warrantyMonths,
          coverageStatus: policy.status,
          warrantyStarts: policy.startAt.toLocaleDateString("en-GB", {
            timeZone: "Asia/Yangon",
          }),
          validUntil: policy.expiresAt.toLocaleDateString("en-GB", {
            timeZone: "Asia/Yangon",
          }),
          reason: policy.reason,
        };
      }),
    };
  } catch (err) {
    console.error("[lookupInternalWarranty error]", err);
    return null;
  }
}

/**
 * 4. Check Inventory Levels
 */
export async function checkInternalInventory(params: {
  query?: string;
  lowStockOnly?: boolean;
  limit?: number;
}) {
  const limit = Math.min(Math.max(1, params.limit || 8), 25);
  const q = normalize(params.query);

  try {
    const inv = await getInventory();
    const filtered = inv.filter((item) => {
      if (params.lowStockOnly && item.stock > item.lowStockThreshold) {
        return false;
      }
      if (!q) return true;
      return (
        normalize(item.name).includes(q) ||
        normalize(item.sku).includes(q) ||
        normalize(item.brand).includes(q) ||
        normalize(item.category).includes(q) ||
        normalize(item.subcategory).includes(q)
      );
    });

    return filtered.slice(0, limit).map((item) => ({
      name: item.name,
      sku: item.sku,
      brand: item.brand,
      category: item.category,
      stock: item.stock,
      lowStockThreshold: item.lowStockThreshold,
      isLowStock: item.stock <= item.lowStockThreshold,
      isOutOfStock: item.stock === 0,
      price: `${item.price.toLocaleString()} MMK`,
      cost: `${item.cost.toLocaleString()} MMK`,
      condition: item.condition,
      warrantyMonths: item.warranty,
    }));
  } catch (err) {
    console.error("[checkInternalInventory error]", err);
    return [];
  }
}

/**
 * 5. Real-Time Business & Operational Snapshot
 */
export async function getInternalBusinessSnapshot() {
  try {
    const [allOrders, inventory] = await Promise.all([
      getOrders(),
      getInventory(),
    ]);

    const todayStr = new Date().toISOString().slice(0, 10);
    const verifiedOrders = allOrders.filter(
      (o) => o.payment.toLowerCase() === "verified",
    );
    const todayVerified = verifiedOrders.filter(
      (o) => o.created && o.created.includes(todayStr),
    );

    const pendingSlips = allOrders.filter(
      (o) => o.payment.toLowerCase() === "pending",
    );
    const awaitingDispatch = verifiedOrders.filter(
      (o) =>
        o.fulfillment.toLowerCase() === "new" ||
        o.fulfillment.toLowerCase() === "confirmed" ||
        o.fulfillment.toLowerCase() === "packing" ||
        o.fulfillment.toLowerCase() === "packed",
    );
    const inTransit = allOrders.filter(
      (o) => o.fulfillment.toLowerCase() === "dispatched",
    );
    const delivered = allOrders.filter(
      (o) => o.fulfillment.toLowerCase() === "delivered",
    );

    const lowStockItems = inventory.filter(
      (i) => i.stock <= i.lowStockThreshold,
    );
    const outOfStockItems = inventory.filter((i) => i.stock === 0);

    let openTicketsCount = 0;
    if (db) {
      try {
        const [ticketRow] = await db
          .select({ count: sql<number>`count(*)` })
          .from(tickets)
          .where(sql`${tickets.status} != 'resolved'`);
        openTicketsCount = Number(ticketRow?.count || 0);
      } catch {
        openTicketsCount = 0;
      }
    }

    const totalVerifiedRevenue = verifiedOrders.reduce(
      (sum, o) => sum + (o.amount || 0),
      0,
    );
    const todayRevenue = todayVerified.reduce(
      (sum, o) => sum + (o.amount || 0),
      0,
    );

    return {
      totalOrdersCount: allOrders.length,
      todayVerifiedOrdersCount: todayVerified.length,
      todayRevenue: `${todayRevenue.toLocaleString()} MMK`,
      totalVerifiedRevenue: `${totalVerifiedRevenue.toLocaleString()} MMK`,
      pendingPaymentSlipsCount: pendingSlips.length,
      awaitingDispatchCount: awaitingDispatch.length,
      inTransitDispatchedCount: inTransit.length,
      deliveredOrdersCount: delivered.length,
      lowStockItemsCount: lowStockItems.length,
      outOfStockItemsCount: outOfStockItems.length,
      openTicketsCount,
      lowStockAlertSample: lowStockItems.slice(0, 4).map((i) => ({
        name: i.name,
        sku: i.sku,
        stock: i.stock,
        threshold: i.lowStockThreshold,
      })),
    };
  } catch (err) {
    console.error("[getInternalBusinessSnapshot error]", err);
    return {
      error: "Unable to calculate snapshot at this moment",
    };
  }
}

// ---------------------------------------------------------------------------
// Gemini Function Declarations Schema
// ---------------------------------------------------------------------------

const GEMINI_FUNCTION_DECLARATIONS = [
  {
    name: "search_orders",
    description:
      "Search internal orders by order code (MHOP-...), customer name, phone number, or fulfillment/payment status.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description:
            "Search term: order code (e.g. MHOP-260906-AB12), customer name, or phone number",
        },
        status: {
          type: "STRING",
          description:
            "Optional status filter: pending, verified, packed, dispatched, delivered, cancelled",
        },
        limit: {
          type: "INTEGER",
          description: "Max results to return (1-10)",
        },
      },
    },
  },
  {
    name: "search_customers",
    description:
      "Search customer profiles by name, phone, or Telegram ID, including lifetime spend, total orders, and address.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Customer name, phone number, or Telegram ID",
        },
        limit: {
          type: "INTEGER",
          description: "Max results to return (1-10)",
        },
      },
    },
  },
  {
    name: "lookup_warranty",
    description:
      "Check warranty status, device IMEI/serial, and expiration date for an order code, customer phone, or serial number.",
    parameters: {
      type: "OBJECT",
      properties: {
        orderCode: {
          type: "STRING",
          description: "MH OP order code (e.g. MHOP-260906-AB12)",
        },
        phone: {
          type: "STRING",
          description: "Customer phone number (e.g. 09772601762)",
        },
        identifier: {
          type: "STRING",
          description: "Device serial number or IMEI",
        },
      },
    },
  },
  {
    name: "check_inventory",
    description:
      "Check warehouse inventory stock levels, low-stock alerts, pricing, and specs.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description: "Product name, SKU, brand, or category",
        },
        lowStockOnly: {
          type: "BOOLEAN",
          description: "Set to true to show only low stock or out of stock items",
        },
        limit: {
          type: "INTEGER",
          description: "Max items to return (1-15)",
        },
      },
    },
  },
  {
    name: "get_business_summary",
    description:
      "Get real-time business KPIs: today's revenue, pending payment slips needing review, pending dispatches, low stock counts, and open tickets.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
];

const SYSTEM_INSTRUCTION = `You are MH OP's Admin Internal AI Copilot, an internal operations assistant for store administrators.
Your job is to answer staff inquiries about orders, customers, inventory stock levels, warranty coverage, and business performance.

STRICT GROUNDING & SECURITY RULES:
1. ONLY use the internal store data returned by the provided tools. NEVER invent order codes, fake customers, made-up prices, or nonexistent stock numbers.
2. If the user asks for an order, customer, or product that does not exist in the database, politely state that no matching record was found in the internal system.
3. LANGUAGE: Match the user's language. If the user writes in Myanmar/Burmese (မြန်မာဘာသာ), answer fluently and politely in Burmese. If they write in English, answer in English. You can naturally mix English operational terms where appropriate (e.g., Order Code, Dispatched, Delivered, Low Stock).
4. FORMATTING:
   - Always put Order Codes in backticks (e.g. \`MHOP-260906-AB12\`).
   - Use bullet points and clear bold headings for readability.
   - For orders, mention: Customer Name, Phone, Item, Total Amount, Payment Status, and Fulfillment/Delivery status (include carrier & tracking number if available).
   - For warranty, state clearly whether it is Active, Expired, or Pending Delivery, along with the expiration date.
   - For inventory, state current stock and whether it is below the low-stock threshold.`;

// ---------------------------------------------------------------------------
// Zero-Key Pattern Matching Engine
// ---------------------------------------------------------------------------

function isBurmese(text: string) {
  return /[\u1000-\u109f]/.test(text);
}

export async function synthesizePatternResponse(
  question: string,
): Promise<CopilotResponse> {
  const q = question.trim();
  const lower = q.toLowerCase();
  const burmese = isBurmese(q);
  const toolCalls: CopilotToolCall[] = [];

  // 1. Order Code pattern (MHOP-...)
  const orderMatch = q.match(/\b(MHOP-[A-Za-z0-9_-]+)\b/i);
  if (orderMatch) {
    const code = orderMatch[1];
    const orders = await searchInternalOrders({ query: code, limit: 1 });
    toolCalls.push({
      name: "search_orders",
      args: { query: code },
      summary: `Searched order ${code}`,
    });

    if (orders.length > 0) {
      const o = orders[0];
      const text = burmese
        ? `📦 **အော်ဒါ အချက်အလက် (\`${o.orderCode}\`)**\n\n` +
          `• **ဝယ်ယူသူ:** ${o.customer} (${o.phone})\n` +
          `• **ပစ္စည်း:** ${o.item}\n` +
          `• **ကျသင့်ငွေ:** ${o.amount}\n` +
          `• **ငွေပေးချေမှု:** ${o.paymentStatus.toLowerCase() === "verified" ? "အတည်ပြုပြီး (Verified) ✅" : o.paymentStatus}\n` +
          `• **ပို့ဆောင်မှု အခြေအနေ:** ${o.fulfillmentStatus.toUpperCase()}\n` +
          (o.carrier ? `• **ပို့ဆောင်ရေး:** ${o.carrier} (Tracking: \`${o.trackingNumber || "N/A"}\`)\n` : "") +
          `• **ပို့ဆောင်ရမည့် လိပ်စာ:** ${o.address || "N/A"}\n` +
          (o.slipUrl ? `• **ငွေလွှဲစလစ်:** ရှိပါသည် (စစ်ဆေးပြီး)\n` : "") +
          `• **အော်ဒါတင်သည့်နေ့:** ${o.date}`
        : `📦 **Order Details (\`${o.orderCode}\`)**\n\n` +
          `• **Customer:** ${o.customer} (${o.phone})\n` +
          `• **Item(s):** ${o.item}\n` +
          `• **Total Amount:** ${o.amount}\n` +
          `• **Payment Status:** ${o.paymentStatus}\n` +
          `• **Fulfillment:** ${o.fulfillmentStatus.toUpperCase()}\n` +
          (o.carrier ? `• **Shipping:** ${o.carrier} (Tracking: \`${o.trackingNumber || "N/A"}\`)\n` : "") +
          `• **Address:** ${o.address || "N/A"}\n` +
          `• **Date Created:** ${o.date}`;

      return {
        answer: text,
        mode: "pattern_fallback",
        model: "internal-pattern-engine",
        toolCalls,
      };
    }
  }

  // 2. Warranty Inquiry
  if (
    lower.includes("warranty") ||
    lower.includes("အာမခံ") ||
    lower.includes("guarantee")
  ) {
    const phoneMatch = q.match(/\b(09\d{7,9})\b/);
    const codeMatch = q.match(/\b(MHOP-[A-Za-z0-9_-]+)\b/i);

    const warrantyResult = await lookupInternalWarranty({
      orderCode: codeMatch ? codeMatch[1] : undefined,
      phone: phoneMatch ? phoneMatch[1] : undefined,
    });

    toolCalls.push({
      name: "lookup_warranty",
      args: { orderCode: codeMatch?.[1], phone: phoneMatch?.[1] },
      summary: "Queried internal warranty database",
    });

    if (warrantyResult) {
      const itemsList = warrantyResult.items
        .map(
          (it) =>
            `  - **${it.name}** (SN/IMEI: ${it.identifier || "N/A"})\n` +
            `    အခြေအနေ: **${it.coverageStatus}** | ကာလ: ${it.warrantyMonths} လ | သက်တမ်းကုန်ဆုံးမည့်ရက်: ${it.validUntil}\n` +
            `    မှတ်ချက်: ${it.reason}`,
        )
        .join("\n");

      const text = burmese
        ? `🛡️ **အာမခံ အချက်အလက် (\`${warrantyResult.orderCode}\`)**\n\n` +
          `• **ဝယ်ယူသူ:** ${warrantyResult.customer} (${warrantyResult.phone})\n` +
          `• **ငွေပေးချေမှု:** ${warrantyResult.paymentStatus}\n` +
          `• **ပစ္စည်းများ:**\n${itemsList}`
        : `🛡️ **Warranty Lookup (\`${warrantyResult.orderCode}\`)**\n\n` +
          `• **Customer:** ${warrantyResult.customer} (${warrantyResult.phone})\n` +
          `• **Status:** Payment: ${warrantyResult.paymentStatus}, Fulfillment: ${warrantyResult.fulfillmentStatus}\n` +
          `• **Covered Items:**\n${itemsList}`;

      return {
        answer: text,
        mode: "pattern_fallback",
        model: "internal-pattern-engine",
        toolCalls,
      };
    }
  }

  // 3. Stock / Inventory Inquiry
  if (
    lower.includes("stock") ||
    lower.includes("inventory") ||
    lower.includes("လက်ကျန်") ||
    lower.includes("ကုန်") ||
    lower.includes("ပစ္စည်း")
  ) {
    const isLowOnly =
      lower.includes("low") ||
      lower.includes("နည်း") ||
      lower.includes("ပြတ်") ||
      lower.includes("out");

    const items = await checkInternalInventory({
      lowStockOnly: isLowOnly,
      limit: 6,
    });
    toolCalls.push({
      name: "check_inventory",
      args: { lowStockOnly: isLowOnly },
      summary: `Queried inventory (lowStockOnly: ${isLowOnly})`,
    });

    if (items.length > 0) {
      const list = items
        .map(
          (i) =>
            `• **${i.name}** (${i.sku})\n  လက်ကျန်: **${i.stock}** ခု ${i.isLowStock ? "⚠️ (Low Stock)" : "✅"} | ဈေးနှုန်း: ${i.price} | အာမခံ: ${i.warrantyMonths} လ`,
        )
        .join("\n");

      const text = burmese
        ? `📊 **လက်ကျန် ကုန်ပစ္စည်းများ စာရင်း${isLowOnly ? " (လက်ကျန်နည်းနေသော ပစ္စည်းများ)" : ""}:**\n\n${list}\n\nအသေးစိတ် ပိုမိုသိရှိလိုပါက [Inventory](/inventory) စာမျက်နှာတွင် ကြည့်ရှုနိုင်ပါသည်။`
        : `📊 **Inventory Stock Levels${isLowOnly ? " (Low Stock Items)" : ""}:**\n\n${list}\n\nView full details in the [Inventory](/inventory) management page.`;

      return {
        answer: text,
        mode: "pattern_fallback",
        model: "internal-pattern-engine",
        toolCalls,
      };
    }
  }

  // 4. Customer Phone pattern (09...)
  const phoneMatch = q.match(/\b(09\d{7,9})\b/);
  if (
    phoneMatch ||
    lower.includes("customer") ||
    lower.includes("ဖောက်သည်") ||
    lower.includes("ဝယ်သူ")
  ) {
    const phone = phoneMatch ? phoneMatch[1] : undefined;
    const custs = await searchInternalCustomers({
      query: phone || q,
      limit: 3,
    });
    toolCalls.push({
      name: "search_customers",
      args: { query: phone || q },
      summary: `Searched customer database`,
    });

    if (custs.length > 0) {
      const list = custs
        .map(
          (c) =>
            `• **${c.name}** (${c.phone})\n  စုစုပေါင်း အော်ဒါ: ${c.totalOrders} ခု | သုံးစွဲငွေ: ${c.lifetimeSpend}\n  Telegram: ${c.telegramId} | လိပ်စာ: ${c.address}`,
        )
        .join("\n\n");

      const text = burmese
        ? `👥 **ဝယ်ယူသူ အချက်အလက်များ:**\n\n${list}`
        : `👥 **Customer Profiles:**\n\n${list}`;

      return {
        answer: text,
        mode: "pattern_fallback",
        model: "internal-pattern-engine",
        toolCalls,
      };
    }
  }

  // 5. Business Summary / Revenue / Dashboard Overview
  if (
    lower.includes("revenue") ||
    lower.includes("summary") ||
    lower.includes("today") ||
    lower.includes("ဝင်ငွေ") ||
    lower.includes("အခြေအနေ") ||
    lower.includes("orders") ||
    lower.includes("pending")
  ) {
    const snap = await getInternalBusinessSnapshot();
    toolCalls.push({
      name: "get_business_summary",
      args: {},
      summary: "Queried internal business snapshot",
    });

    if (!("error" in snap)) {
      const text = burmese
        ? `📈 **ယနေ့ လုပ်ငန်းဆောင်ရွက်မှု အကျဉ်းချုပ် (Business Summary)**\n\n` +
          `• **ယနေ့ အတည်ပြုပြီး ဝင်ငွေ:** **${snap.todayRevenue}** (${snap.todayVerifiedOrdersCount} orders)\n` +
          `• **စုစုပေါင်း အတည်ပြု ဝင်ငွေ:** ${snap.totalVerifiedRevenue} (${snap.totalOrdersCount} orders စုစုပေါင်း)\n` +
          `• **စစ်ဆေးရန်ကျန် စလစ်များ:** **${snap.pendingPaymentSlipsCount}** ခု ⚠️\n` +
          `• **ပို့ဆောင်ရန် ပြင်ဆင်ဆဲ:** ${snap.awaitingDispatchCount} ခု\n` +
          `• **လမ်းခရီးရှိ အော်ဒါများ:** ${snap.inTransitDispatchedCount} ခု\n` +
          `• **ပို့ဆောင်ပြီးစီး:** ${snap.deliveredOrdersCount} ခု\n` +
          `• **လက်ကျန်နည်း/ပြတ်နေသော ပစ္စည်းများ:** ${snap.lowStockItemsCount} ခု (${snap.outOfStockItemsCount} ခု ပစ္စည်းပြတ်)\n` +
          `• **ဖြေရှင်းရန်ကျန် Support လက်မှတ်များ:** ${snap.openTicketsCount} ခု`
        : `📈 **Real-Time Business Snapshot**\n\n` +
          `• **Today's Verified Revenue:** **${snap.todayRevenue}** (${snap.todayVerifiedOrdersCount} orders)\n` +
          `• **Total Lifetime Revenue:** ${snap.totalVerifiedRevenue} (${snap.totalOrdersCount} total orders)\n` +
          `• **Pending Payment Slips:** **${snap.pendingPaymentSlipsCount}** awaiting verification ⚠️\n` +
          `• **Awaiting Dispatch:** ${snap.awaitingDispatchCount} orders\n` +
          `• **In Transit:** ${snap.inTransitDispatchedCount} orders\n` +
          `• **Delivered:** ${snap.deliveredOrdersCount} orders\n` +
          `• **Low/Out of Stock Items:** ${snap.lowStockItemsCount} items (${snap.outOfStockItemsCount} completely out)\n` +
          `• **Open Support Tickets:** ${snap.openTicketsCount} tickets`;

      return {
        answer: text,
        mode: "pattern_fallback",
        model: "internal-pattern-engine",
        toolCalls,
      };
    }
  }

  // Default helpful guide
  const defaultText = burmese
    ? `မင်္ဂလာပါခင်ဗျာ! ကျွန်တော်သည် MH OP ၏ Admin AI Copilot ဖြစ်ပါသည်။\n\nစတိုးဆိုင်၏ အတွင်းပိုင်း ဒေတာများကို အောက်ပါအတိုင်း မေးမြန်းစုံစမ်းနိုင်ပါသည်:\n\n` +
      `• **အော်ဒါ အခြေအနေ:** ဥပမာ \`MHOP-260906-AB12 အခြေအနေ ဘယ်လိုရှိလဲ\`\n` +
      `• **ဖောက်သည် စုံစမ်းရန်:** ဥပမာ \`09772601762 ဝယ်ယူသူ အချက်အလက်\`\n` +
      `• **အာမခံ စစ်ဆေးရန်:** ဥပမာ \`အော်ဒါ MHOP-... အာမခံ သက်တမ်း\`\n` +
      `• **လက်ကျန် ပစ္စည်းများ:** ဥပမာ \`လက်ကျန်နည်းနေသော ပစ္စည်းများ ပြပေးပါ\`\n` +
      `• **ယနေ့ ဝင်ငွေနှင့် စာရင်း:** ဥပမာ \`ယနေ့ ဝင်ငွေနှင့် စစ်ဆေးရန်ကျန် စလစ်များ\``
    : `Hello! I am MH OP's Admin Internal AI Copilot.\n\nYou can ask me questions about internal store operations:\n\n` +
      `• **Order Tracking:** e.g. "Status of \`MHOP-260906-AB12\`"\n` +
      `• **Customer Lookup:** e.g. "Customer profile for 09772601762"\n` +
      `• **Warranty Coverage:** e.g. "Check warranty for MHOP-..."\n` +
      `• **Stock Levels:** e.g. "Show items with low stock"\n` +
      `• **Business Performance:** e.g. "Today's revenue and pending orders"`;

  return {
    answer: defaultText,
    mode: "pattern_fallback",
    model: "internal-pattern-engine",
    toolCalls,
  };
}

// ---------------------------------------------------------------------------
// Tool Dispatcher for Gemini Function Calling
// ---------------------------------------------------------------------------

async function executeTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "search_orders":
      return await searchInternalOrders({
        query: typeof args.query === "string" ? args.query : undefined,
        status: typeof args.status === "string" ? args.status : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
      });

    case "search_customers":
      return await searchInternalCustomers({
        query: typeof args.query === "string" ? args.query : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
      });

    case "lookup_warranty":
      return await lookupInternalWarranty({
        orderCode:
          typeof args.orderCode === "string" ? args.orderCode : undefined,
        phone: typeof args.phone === "string" ? args.phone : undefined,
        identifier:
          typeof args.identifier === "string" ? args.identifier : undefined,
      });

    case "check_inventory":
      return await checkInternalInventory({
        query: typeof args.query === "string" ? args.query : undefined,
        lowStockOnly:
          typeof args.lowStockOnly === "boolean" ? args.lowStockOnly : undefined,
        limit: typeof args.limit === "number" ? args.limit : undefined,
      });

    case "get_business_summary":
      return await getInternalBusinessSnapshot();

    default:
      return { error: `Tool ${name} not recognized` };
  }
}

// ---------------------------------------------------------------------------
// OpenRouter OpenAI-Compatible Tools Schema
// ---------------------------------------------------------------------------

const OPENAI_COMPATIBLE_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_orders",
      description:
        "Search internal orders by order code (MHOP-...), customer name, phone number, or fulfillment/payment status.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search term: order code, customer name, or phone",
          },
          status: {
            type: "string",
            description: "Optional status filter: pending, verified, packed, dispatched, delivered",
          },
          limit: {
            type: "number",
            description: "Max results to return (1-10)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_customers",
      description:
        "Search customer profiles by name, phone, or Telegram ID, including lifetime spend, total orders, and address.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Customer name, phone number, or Telegram ID",
          },
          limit: {
            type: "number",
            description: "Max results to return (1-10)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "lookup_warranty",
      description:
        "Check warranty status, device IMEI/serial, and expiration date for an order code, customer phone, or serial number.",
      parameters: {
        type: "object",
        properties: {
          orderCode: {
            type: "string",
            description: "MH OP order code (e.g. MHOP-260906-AB12)",
          },
          phone: {
            type: "string",
            description: "Customer phone number (e.g. 09772601762)",
          },
          identifier: {
            type: "string",
            description: "Device serial number or IMEI",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "check_inventory",
      description:
        "Check warehouse inventory stock levels, low-stock alerts, pricing, and specs.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Product name, SKU, brand, or category",
          },
          lowStockOnly: {
            type: "boolean",
            description: "Set to true to show only low stock or out of stock items",
          },
          limit: {
            type: "number",
            description: "Max items to return (1-15)",
          },
        },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_business_summary",
      description:
        "Get real-time business KPIs: today's revenue, pending payment slips needing review, pending dispatches, low stock counts, and open tickets.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

async function queryOpenRouterCopilot(input: {
  question: string;
  history?: CopilotMessage[];
  apiKey: string;
  model: string;
}): Promise<CopilotResponse | null> {
  const recordedToolCalls: CopilotToolCall[] = [];

  try {
    const messages: Array<{
      role: string;
      content?: string | null;
      tool_calls?: Array<Record<string, unknown>>;
      tool_call_id?: string;
      name?: string;
    }> = [{ role: "system", content: SYSTEM_INSTRUCTION }];

    if (input.history && input.history.length > 0) {
      for (const msg of input.history.slice(-6)) {
        messages.push({
          role: msg.role === "assistant" ? "assistant" : "user",
          content: msg.content,
        });
      }
    }

    messages.push({ role: "user", content: input.question });

    const firstRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
        "HTTP-Referer": "https://mhop-erp.local",
        "X-Title": "MH OP Operations Copilot",
      },
      body: JSON.stringify({
        model: input.model,
        messages,
        tools: OPENAI_COMPATIBLE_TOOLS,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(18_000),
    });

    if (!firstRes.ok) {
      console.warn(`[OpenRouter API returned ${firstRes.status}]`);
      return null;
    }

    const firstJson = await firstRes.json();
    const firstChoice = firstJson?.choices?.[0]?.message;

    if (firstChoice?.tool_calls && firstChoice.tool_calls.length > 0) {
      messages.push(firstChoice);

      for (const tc of firstChoice.tool_calls) {
        const fnName = tc.function?.name;
        let fnArgs: Record<string, unknown> = {};
        try {
          fnArgs = JSON.parse(tc.function?.arguments || "{}");
        } catch {
          fnArgs = {};
        }

        const toolResult = await executeTool(fnName, fnArgs);
        recordedToolCalls.push({
          name: fnName,
          args: fnArgs,
          summary: `Called ${fnName}`,
        });

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          name: fnName,
          content: JSON.stringify(toolResult),
        });
      }

      const secondRes = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${input.apiKey}`,
            "HTTP-Referer": "https://mhop-erp.local",
            "X-Title": "MH OP Operations Copilot",
          },
          body: JSON.stringify({
            model: input.model,
            messages,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(18_000),
        },
      );

      if (secondRes.ok) {
        const secondJson = await secondRes.json();
        const reply = secondJson?.choices?.[0]?.message?.content;
        if (reply) {
          return {
            answer: reply.trim(),
            mode: "openrouter",
            model: input.model,
            toolCalls: recordedToolCalls,
          };
        }
      }
    } else if (firstChoice?.content) {
      return {
        answer: firstChoice.content.trim(),
        mode: "openrouter",
        model: input.model,
        toolCalls: recordedToolCalls,
      };
    }

    return null;
  } catch (err) {
    console.error("[queryOpenRouterCopilot error]", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main AI Copilot Entrypoint (Tier 1: Gemini -> Tier 2: OpenRouter -> Tier 3: DB Pattern)
// ---------------------------------------------------------------------------

export async function askAdminCopilot(input: {
  question: string;
  history?: CopilotMessage[];
  clientApiKey?: string;
  clientModel?: string;
  clientOpenRouterKey?: string;
  clientOpenRouterModel?: string;
}): Promise<CopilotResponse> {
  const geminiConfig = await getGeminiConfig(
    input.clientApiKey,
    input.clientModel,
  );
  const openRouterConfig = await getOpenRouterConfig(
    input.clientOpenRouterKey,
    input.clientOpenRouterModel,
  );

  const recordedToolCalls: CopilotToolCall[] = [];

  // Tier 1: Try Primary Google Gemini Direct API
  if (geminiConfig.isConfigured) {
    const model = geminiConfig.model || "gemini-2.5-flash";
    const apiKey = geminiConfig.apiKey;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const contents: Array<{
        role: string;
        parts: Array<Record<string, unknown>>;
      }> = [];

      if (input.history && input.history.length > 0) {
        for (const msg of input.history.slice(-6)) {
          contents.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          });
        }
      }

      contents.push({
        role: "user",
        parts: [{ text: input.question }],
      });

      const requestBody = {
        system_instruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }],
        },
        contents,
        tools: [
          {
            function_declarations: GEMINI_FUNCTION_DECLARATIONS,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      };

      const firstRes = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(15_000),
      });

      if (firstRes.ok) {
        const firstJson = await firstRes.json();
        const candidate = firstJson?.candidates?.[0];
        const firstPart = candidate?.content?.parts?.[0];

        if (firstPart?.functionCall) {
          const fnName = firstPart.functionCall.name;
          const fnArgs = (firstPart.functionCall.args || {}) as Record<
            string,
            unknown
          >;

          const toolResult = await executeTool(fnName, fnArgs);
          recordedToolCalls.push({
            name: fnName,
            args: fnArgs,
            summary: `Called ${fnName}`,
          });

          contents.push({
            role: "model",
            parts: [{ functionCall: firstPart.functionCall }],
          });

          contents.push({
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: fnName,
                  response: {
                    name: fnName,
                    content: toolResult,
                  },
                },
              },
            ],
          });

          const secondRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }],
              },
              contents,
              generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 1024,
              },
            }),
            signal: AbortSignal.timeout(15_000),
          });

          if (secondRes.ok) {
            const secondJson = await secondRes.json();
            const secondText =
              secondJson?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (secondText) {
              return {
                answer: secondText.trim(),
                mode: "gemini",
                model,
                toolCalls: recordedToolCalls,
              };
            }
          }
        } else if (firstPart?.text) {
          return {
            answer: firstPart.text.trim(),
            mode: "gemini",
            model,
            toolCalls: recordedToolCalls,
          };
        }
      }
    } catch (err) {
      console.warn("[Google Gemini attempt failed, trying OpenRouter fallback]", err);
    }
  }

  // Tier 2: Try OpenRouter Fallback Model (google/gemini-2.0-flash-exp:free)
  if (openRouterConfig.isConfigured) {
    const openRouterResult = await queryOpenRouterCopilot({
      question: input.question,
      history: input.history,
      apiKey: openRouterConfig.apiKey,
      model: openRouterConfig.model || "google/gemini-2.0-flash-exp:free",
    });

    if (openRouterResult) {
      return openRouterResult;
    }
  }

  // Tier 3: Zero-Key Pattern Matching Engine
  return await synthesizePatternResponse(input.question);
}
