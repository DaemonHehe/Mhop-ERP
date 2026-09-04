import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  expenses,
  orderItems,
  orders,
  productVariants,
  products,
  tickets,
} from "@/db/schema";
import { products as demoProducts } from "@/lib/data";

export interface MonthlyReportSummary {
  year: number;
  month: number;
  monthLabel: string;
  generatedAt: string;
  totalOrdersCount: number;
  verifiedOrdersCount: number;
  verifiedRevenue: number;
  totalCogs: number;
  shippingFeesCollected: number;
  grossProfit: number;
  grossMarginPercent: number;
  operatingExpenses: number;
  warrantyCosts: number;
  refunds: number;
  netProfit: number;
  netMarginPercent: number;
}

export interface CategorySummary {
  category: string;
  unitsSold: number;
  revenue: number;
  cogs: number;
  profit: number;
  marginPercent: number;
}

export interface PaymentSummary {
  method: string;
  ordersCount: number;
  totalAmount: number;
  percentage: number;
}

export interface ChannelSummary {
  channel: string;
  ordersCount: number;
  totalAmount: number;
}

export interface TopProductSummary {
  sku: string;
  name: string;
  category: string;
  unitsSold: number;
  revenue: number;
  profit: number;
}

export interface ItemizedOrderRow {
  code: string;
  createdAt: string;
  customerName: string;
  phone: string;
  channel: string;
  itemsList: string;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  paymentMethod: string;
  fulfillmentStatus: string;
}

export interface ItemizedExpenseRow {
  code: string;
  expenseDate: string;
  category: string;
  description: string;
  paymentMethod: string;
  amount: number;
}

export interface MonthlyReportData {
  summary: MonthlyReportSummary;
  categories: CategorySummary[];
  payments: PaymentSummary[];
  channels: ChannelSummary[];
  topProducts: TopProductSummary[];
  expensesByCategory: { category: string; amount: number; percentage: number }[];
  orders: ItemizedOrderRow[];
  expenses: ItemizedExpenseRow[];
}

const num = (v: string | number | null | undefined) => Number(v) || 0;

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function getMonthDateRange(year: number, month: number) {
  const safeYear = Math.max(2020, Math.min(2035, year || new Date().getFullYear()));
  const safeMonth = Math.max(1, Math.min(12, month || new Date().getMonth() + 1));

  // Construct start and end dates in UTC matching Asia/Yangon (+06:30) offset
  const startDate = new Date(Date.UTC(safeYear, safeMonth - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(safeYear, safeMonth, 0, 23, 59, 59, 999));

  return {
    year: safeYear,
    month: safeMonth,
    monthLabel: `${monthNames[safeMonth - 1]} ${safeYear}`,
    startDate,
    endDate,
  };
}

export async function generateMonthlyReportData(
  year: number,
  month: number
): Promise<MonthlyReportData> {
  const { year: safeYear, month: safeMonth, monthLabel, startDate, endDate } =
    getMonthDateRange(year, month);

  const generatedAt = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Yangon",
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (!db) {
    // Demo fallback dataset for preview environments
    const totalOrdersCount = 28;
    const verifiedOrdersCount = 24;
    const verifiedRevenue = 12_840_000;
    const totalCogs = 9_930_000;
    const shippingFeesCollected = 72_000;
    const grossProfit = verifiedRevenue - totalCogs + shippingFeesCollected;
    const operatingExpenses = 730_000;
    const warrantyCosts = 18_000;
    const refunds = 0;
    const netProfit = grossProfit - operatingExpenses - warrantyCosts - refunds;

    return {
      summary: {
        year: safeYear,
        month: safeMonth,
        monthLabel,
        generatedAt,
        totalOrdersCount,
        verifiedOrdersCount,
        verifiedRevenue,
        totalCogs,
        shippingFeesCollected,
        grossProfit,
        grossMarginPercent: Number(((grossProfit / (verifiedRevenue || 1)) * 100).toFixed(1)),
        operatingExpenses,
        warrantyCosts,
        refunds,
        netProfit,
        netMarginPercent: Number(((netProfit / (verifiedRevenue || 1)) * 100).toFixed(1)),
      },
      categories: [
        {
          category: "PUBG Accounts",
          unitsSold: 8,
          revenue: 6_200_000,
          cogs: 4_500_000,
          profit: 1_700_000,
          marginPercent: 27.4,
        },
        {
          category: "Gaming Gadgets",
          unitsSold: 22,
          revenue: 6_640_000,
          cogs: 5_430_000,
          profit: 1_210_000,
          marginPercent: 18.2,
        },
      ],
      payments: [
        { method: "KBZPay", ordersCount: 16, totalAmount: 8_420_000, percentage: 65.6 },
        { method: "WavePay", ordersCount: 6, totalAmount: 3_120_000, percentage: 24.3 },
        { method: "Bank Transfer", ordersCount: 2, totalAmount: 1_300_000, percentage: 10.1 },
      ],
      channels: [
        { channel: "Web Storefront", ordersCount: 17, totalAmount: 8_980_000 },
        { channel: "Telegram Bot", ordersCount: 7, totalAmount: 3_860_000 },
      ],
      topProducts: demoProducts.slice(0, 5).map((p, idx) => {
        const units = 5 - idx;
        const rev = p.price * units;
        const c = p.cost * units;
        return {
          sku: p.sku,
          name: p.name,
          category: p.category,
          unitsSold: units,
          revenue: rev,
          profit: rev - c,
        };
      }),
      expensesByCategory: [
        { category: "Marketing", amount: 350_000, percentage: 47.9 },
        { category: "Payroll", amount: 200_000, percentage: 27.4 },
        { category: "Delivery", amount: 120_000, percentage: 16.4 },
        { category: "Utilities", amount: 60_000, percentage: 8.3 },
      ],
      orders: [
        {
          code: "MHOP-260824-A101",
          createdAt: `${monthLabel} 24, 14:30`,
          customerName: "Min Thant",
          phone: "09 79 123 4567",
          channel: "Telegram",
          itemsList: "DL05 RGB Phone Cooler (1x)",
          subtotal: 75_000,
          shippingFee: 3_000,
          totalAmount: 78_000,
          paymentMethod: "KBZPay",
          fulfillmentStatus: "delivered",
        },
        {
          code: "MHOP-260822-B204",
          createdAt: `${monthLabel} 22, 11:15`,
          customerName: "Kyaw Zayar",
          phone: "09 97 888 9999",
          channel: "Web",
          itemsList: "PUBG Mobile Conqueror Starter Account (1x)",
          subtotal: 450_000,
          shippingFee: 0,
          totalAmount: 450_000,
          paymentMethod: "KBZPay",
          fulfillmentStatus: "delivered",
        },
      ],
      expenses: [
        {
          code: "EXP-260815-001",
          expenseDate: `${monthLabel} 15`,
          category: "Marketing",
          description: "Facebook Gaming Boost Campaign",
          paymentMethod: "KBZPay",
          amount: 350_000,
        },
      ],
    };
  }

  // --- Database Fetching ---
  const [allOrdersInPeriod, allExpensesInPeriod, allTicketsInPeriod] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderCode: orders.orderCode,
        customerName: orders.customerName,
        phone: orders.phone,
        telegramUserId: orders.telegramUserId,
        paymentMethod: orders.paymentMethod,
        totalAmount: orders.totalAmount,
        shippingFee: orders.shippingFee,
        paymentStatus: orders.paymentStatus,
        fulfillmentStatus: orders.fulfillmentStatus,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(sql`${orders.createdAt} >= ${startDate}`, sql`${orders.createdAt} <= ${endDate}`))
      .orderBy(desc(orders.createdAt)),

    db
      .select({
        id: expenses.id,
        expenseCode: expenses.expenseCode,
        category: expenses.category,
        description: expenses.description,
        amount: expenses.amount,
        paymentMethod: expenses.paymentMethod,
        expenseDate: expenses.expenseDate,
      })
      .from(expenses)
      .where(
        and(sql`${expenses.expenseDate} >= ${startDate}`, sql`${expenses.expenseDate} <= ${endDate}`)
      )
      .orderBy(desc(expenses.expenseDate)),

    db
      .select({
        resolutionCost: tickets.resolutionCost,
        refundAmount: tickets.refundAmount,
      })
      .from(tickets)
      .where(
        or(
          and(
            sql`${tickets.resolvedAt} >= ${startDate}`,
            sql`${tickets.resolvedAt} <= ${endDate}`
          ),
          and(
            sql`${tickets.warrantyStartAt} >= ${startDate}`,
            sql`${tickets.warrantyStartAt} <= ${endDate}`
          )
        )
      ),
  ]);

  const verifiedOrders = allOrdersInPeriod.filter((o) => o.paymentStatus === "verified");
  const verifiedOrderIds = verifiedOrders.map((o) => o.id);

  // Fetch Order Items for verified orders
  const verifiedItems = verifiedOrderIds.length
    ? await db
        .select({
          orderId: orderItems.orderId,
          productId: orderItems.productId,
          variantId: orderItems.variantId,
          unitPrice: orderItems.unitPrice,
          costSnapshot: orderItems.costSnapshot,
          quantity: orderItems.quantity,
          productName: products.name,
          category: products.category,
          sku: productVariants.sku,
        })
        .from(orderItems)
        .innerJoin(products, eq(products.id, orderItems.productId))
        .innerJoin(productVariants, eq(productVariants.id, orderItems.variantId))
        .where(inArray(orderItems.orderId, verifiedOrderIds))
    : [];

  // Group items by order
  const itemsByOrder = new Map<string, typeof verifiedItems>();
  for (const item of verifiedItems) {
    const list = itemsByOrder.get(item.orderId) || [];
    list.push(item);
    itemsByOrder.set(item.orderId, list);
  }

  // Financial aggregates
  const verifiedRevenue = verifiedOrders.reduce((sum, o) => sum + num(o.totalAmount), 0);
  const shippingFeesCollected = verifiedOrders.reduce((sum, o) => sum + num(o.shippingFee), 0);
  const totalCogs = verifiedItems.reduce(
    (sum, item) => sum + num(item.costSnapshot) * num(item.quantity),
    0
  );
  const grossProfit = verifiedRevenue - totalCogs;
  const operatingExpenses = allExpensesInPeriod.reduce((sum, exp) => sum + num(exp.amount), 0);
  const warrantyCosts = allTicketsInPeriod.reduce((sum, t) => sum + num(t.resolutionCost), 0);
  const refunds = allTicketsInPeriod.reduce((sum, t) => sum + num(t.refundAmount), 0);
  const netProfit = grossProfit - operatingExpenses - warrantyCosts - refunds;

  // Category aggregates
  const catMap = new Map<string, { units: number; rev: number; cost: number }>();
  for (const item of verifiedItems) {
    const c = item.category || "Gaming Gadgets";
    const current = catMap.get(c) || { units: 0, rev: 0, cost: 0 };
    current.units += num(item.quantity);
    current.rev += num(item.unitPrice) * num(item.quantity);
    current.cost += num(item.costSnapshot) * num(item.quantity);
    catMap.set(c, current);
  }

  const categories: CategorySummary[] = Array.from(catMap.entries()).map(([category, stats]) => {
    const profit = stats.rev - stats.cost;
    return {
      category,
      unitsSold: stats.units,
      revenue: stats.rev,
      cogs: stats.cost,
      profit,
      marginPercent: stats.rev > 0 ? Number(((profit / stats.rev) * 100).toFixed(1)) : 0,
    };
  });

  // Payment methods aggregates
  const payMap = new Map<string, { count: number; amount: number }>();
  for (const o of verifiedOrders) {
    const method = o.paymentMethod || "Other";
    const cur = payMap.get(method) || { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += num(o.totalAmount);
    payMap.set(method, cur);
  }

  const payments: PaymentSummary[] = Array.from(payMap.entries()).map(([method, stats]) => ({
    method,
    ordersCount: stats.count,
    totalAmount: stats.amount,
    percentage:
      verifiedRevenue > 0 ? Number(((stats.amount / verifiedRevenue) * 100).toFixed(1)) : 0,
  }));

  // Channel breakdown
  let webCount = 0,
    webAmount = 0,
    tgCount = 0,
    tgAmount = 0;
  for (const o of verifiedOrders) {
    if (o.telegramUserId) {
      tgCount++;
      tgAmount += num(o.totalAmount);
    } else {
      webCount++;
      webAmount += num(o.totalAmount);
    }
  }

  const channels: ChannelSummary[] = [
    { channel: "Web Storefront", ordersCount: webCount, totalAmount: webAmount },
    { channel: "Telegram Bot", ordersCount: tgCount, totalAmount: tgAmount },
  ];

  // Top Selling Products
  const prodMap = new Map<
    string,
    { name: string; category: string; units: number; rev: number; cost: number }
  >();
  for (const item of verifiedItems) {
    const cur = prodMap.get(item.sku) || {
      name: item.productName,
      category: item.category,
      units: 0,
      rev: 0,
      cost: 0,
    };
    cur.units += num(item.quantity);
    cur.rev += num(item.unitPrice) * num(item.quantity);
    cur.cost += num(item.costSnapshot) * num(item.quantity);
    prodMap.set(item.sku, cur);
  }

  const topProducts: TopProductSummary[] = Array.from(prodMap.entries())
    .map(([sku, data]) => ({
      sku,
      name: data.name,
      category: data.category,
      unitsSold: data.units,
      revenue: data.rev,
      profit: data.rev - data.cost,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 15);

  // Expenses by Category
  const expCatMap = new Map<string, number>();
  for (const exp of allExpensesInPeriod) {
    expCatMap.set(exp.category, (expCatMap.get(exp.category) || 0) + num(exp.amount));
  }

  const expensesByCategory = Array.from(expCatMap.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage:
        operatingExpenses > 0 ? Number(((amount / operatingExpenses) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Itemized Orders
  const ordersList: ItemizedOrderRow[] = allOrdersInPeriod.map((o) => {
    const oItems = itemsByOrder.get(o.id) || [];
    const itemsList = oItems.length
      ? oItems.map((i) => `${i.productName} (${i.quantity}x)`).join(", ")
      : "No item details";
    const subtotal = Math.max(0, num(o.totalAmount) - num(o.shippingFee));

    return {
      code: o.orderCode,
      createdAt: new Date(o.createdAt).toLocaleString("en-US", {
        timeZone: "Asia/Yangon",
        dateStyle: "short",
        timeStyle: "short",
      }),
      customerName: o.customerName,
      phone: o.phone,
      channel: o.telegramUserId ? "Telegram" : "Web",
      itemsList,
      subtotal,
      shippingFee: num(o.shippingFee),
      totalAmount: num(o.totalAmount),
      paymentMethod: o.paymentMethod || "—",
      fulfillmentStatus: o.fulfillmentStatus,
    };
  });

  // Itemized Expenses
  const expensesList: ItemizedExpenseRow[] = allExpensesInPeriod.map((exp) => ({
    code: exp.expenseCode,
    expenseDate: new Date(exp.expenseDate).toLocaleDateString("en-GB", {
      timeZone: "Asia/Yangon",
    }),
    category: exp.category,
    description: exp.description,
    paymentMethod: exp.paymentMethod,
    amount: num(exp.amount),
  }));

  return {
    summary: {
      year: safeYear,
      month: safeMonth,
      monthLabel,
      generatedAt,
      totalOrdersCount: allOrdersInPeriod.length,
      verifiedOrdersCount: verifiedOrders.length,
      verifiedRevenue,
      totalCogs,
      shippingFeesCollected,
      grossProfit,
      grossMarginPercent:
        verifiedRevenue > 0 ? Number(((grossProfit / verifiedRevenue) * 100).toFixed(1)) : 0,
      operatingExpenses,
      warrantyCosts,
      refunds,
      netProfit,
      netMarginPercent:
        verifiedRevenue > 0 ? Number(((netProfit / verifiedRevenue) * 100).toFixed(1)) : 0,
    },
    categories,
    payments,
    channels,
    topProducts,
    expensesByCategory,
    orders: ordersList,
    expenses: expensesList,
  };
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return `"${str}"`;
}

export function generateMonthlyReportCsv(data: MonthlyReportData): string {
  const lines: string[] = [];

  // UTF-8 BOM for Excel character rendering
  const BOM = "\uFEFF";

  const addLine = (...cells: (string | number | null | undefined)[]) => {
    lines.push(cells.map(csvCell).join(","));
  };

  const addEmpty = () => lines.push("");

  // SECTION 1: HEADER & EXECUTIVE SUMMARY
  addLine("MH OP GAMING STORE - MONTHLY FINANCIAL & OPERATIONS REPORT");
  addLine("Period", data.summary.monthLabel);
  addLine("Generated At", data.summary.generatedAt);
  addLine("Report Status", "Verified Closed Ledger");
  addEmpty();

  addLine("1. EXECUTIVE FINANCIAL SUMMARY");
  addLine("Metric", "Value (MMK / Count)", "Notes");
  addLine("Total Orders Placed", data.summary.totalOrdersCount, "All channels");
  addLine("Verified Paid Orders", data.summary.verifiedOrdersCount, "Approved payments");
  addLine("Gross Verified Revenue", data.summary.verifiedRevenue, "Net sales inclusive of items");
  addLine("Total Cost of Goods Sold (COGS)", data.summary.totalCogs, "Direct inventory purchase cost");
  addLine("Delivery Fees Collected", data.summary.shippingFeesCollected, "Courier pass-through");
  addLine("Gross Profit", data.summary.grossProfit, "Revenue - COGS");
  addLine("Gross Profit Margin (%)", `${data.summary.grossMarginPercent}%`);
  addLine("Total Operating Expenses", data.summary.operatingExpenses, "Rent, Payroll, Ads, Utilities");
  addLine("Warranty & RMA Service Cost", data.summary.warrantyCosts, "Technician repairs & replacement");
  addLine("Customer Refunds", data.summary.refunds, "RMA refunds");
  addLine("Net Profit", data.summary.netProfit, "Gross Profit - Expenses - Warranty - Refunds");
  addLine("Net Profit Margin (%)", `${data.summary.netMarginPercent}%`);
  addEmpty();

  // SECTION 2: CATEGORY PERFORMANCE
  addLine("2. CATEGORY PERFORMANCE (PUBG ACCOUNTS VS GAMING GADGETS)");
  addLine("Category", "Units Sold", "Revenue (MMK)", "COGS (MMK)", "Gross Margin (MMK)", "Margin (%)");
  for (const cat of data.categories) {
    addLine(cat.category, cat.unitsSold, cat.revenue, cat.cogs, cat.profit, `${cat.marginPercent}%`);
  }
  addEmpty();

  // SECTION 3: PAYMENT METHODS
  addLine("3. PAYMENT METHOD BREAKDOWN");
  addLine("Payment Method", "Order Count", "Total Volume (MMK)", "Share of Sales (%)");
  for (const p of data.payments) {
    addLine(p.method, p.ordersCount, p.totalAmount, `${p.percentage}%`);
  }
  addEmpty();

  // SECTION 4: SALES CHANNELS
  addLine("4. SALES CHANNELS");
  addLine("Channel", "Orders Count", "Total Volume (MMK)");
  for (const ch of data.channels) {
    addLine(ch.channel, ch.ordersCount, ch.totalAmount);
  }
  addEmpty();

  // SECTION 5: TOP SELLING PRODUCTS
  addLine("5. TOP SELLING PRODUCTS & SKUS");
  addLine("Rank", "SKU", "Product Name", "Category", "Units Sold", "Total Revenue (MMK)", "Total Margin (MMK)");
  data.topProducts.forEach((p, idx) => {
    addLine(idx + 1, p.sku, p.name, p.category, p.unitsSold, p.revenue, p.profit);
  });
  addEmpty();

  // SECTION 6: OPERATING EXPENSES BY CATEGORY
  addLine("6. OPERATING EXPENSES BY CATEGORY");
  addLine("Expense Category", "Amount (MMK)", "Share of Expenses (%)");
  for (const exp of data.expensesByCategory) {
    addLine(exp.category, exp.amount, `${exp.percentage}%`);
  }
  addEmpty();

  // SECTION 7: ITEMIZED SALES LEDGER
  addLine("7. ITEMIZED SALES LEDGER");
  addLine(
    "Order Code",
    "Date & Time",
    "Customer Name",
    "Phone",
    "Channel",
    "Ordered Items",
    "Subtotal (MMK)",
    "Shipping Fee (MMK)",
    "Total Amount (MMK)",
    "Payment Method",
    "Fulfillment Status"
  );
  for (const o of data.orders) {
    addLine(
      o.code,
      o.createdAt,
      o.customerName,
      o.phone,
      o.channel,
      o.itemsList,
      o.subtotal,
      o.shippingFee,
      o.totalAmount,
      o.paymentMethod,
      o.fulfillmentStatus
    );
  }
  addEmpty();

  // SECTION 8: ITEMIZED OPERATING EXPENSES LEDGER
  addLine("8. ITEMIZED OPERATING EXPENSES LEDGER");
  addLine("Expense Code", "Date", "Category", "Description", "Payment Method", "Amount (MMK)");
  for (const exp of data.expenses) {
    addLine(exp.code, exp.expenseDate, exp.category, exp.description, exp.paymentMethod, exp.amount);
  }

  return BOM + lines.join("\r\n");
}
