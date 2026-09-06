import { z } from "zod";

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((v) => v.replace(/[\u0000-\u001F\u007F]/g, ""));
export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
});
export const orderSchema = z.object({
  customerName: text(120),
  phone: text(40),
  telegramUserId: z.string().trim().max(80).optional(),
  shippingAddress: z.string().trim().max(500).default(""),
  shippingZone: z
    .enum(["yangonInner", "yangonOuter", "otherCities"])
    .default("yangonInner"),
  paymentMethod: z.enum(["kbzpay", "wavepay", "bank"]).default("kbzpay"),
});
export const ticketSchema = z.object({
  orderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^MHOP-\d{6}-[A-Z0-9]{4}$/),
  phone: text(40),
  sku: text(80),
  serialNumber: z.string().trim().max(120).default(""),
  category: z.enum(["DOA", "battery", "display", "charging", "other"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  messageText: z.string().trim().max(2000).default(""),
});
export const warrantyResolutionSchema = z
  .object({
    resolution: z.enum(["repair", "replacement", "refund", "rejected"]),
    resolutionCost: z.coerce
      .number()
      .finite()
      .min(0)
      .max(1_000_000_000)
      .default(0),
    refundAmount: z.coerce
      .number()
      .finite()
      .min(0)
      .max(1_000_000_000)
      .default(0),
    replacementVariantId: z.string().uuid().optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.resolution === "replacement" && !value.replacementVariantId)
      ctx.addIssue({
        code: "custom",
        path: ["replacementVariantId"],
        message: "Select a replacement product",
      });
    if (value.resolution === "refund" && value.refundAmount <= 0)
      ctx.addIssue({
        code: "custom",
        path: ["refundAmount"],
        message: "Enter the customer refund amount",
      });
  });
export const shipmentSchema = z.object({
  trackingNumber: text(100),
  carrier: z.enum(["Royal Express", "Ninja Van", "In-house", "Other"]),
});
export const warrantyLookupSchema = z.object({
  orderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^MHOP-\d{6}-[A-Z0-9]{4}$/),
  phone: text(40),
});
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v.replace(/[\u0000-\u001F\u007F]/g, ""))
    .default("");
const money = z.coerce.number().finite().min(0).max(1_000_000_000);
export const catalogItemSchema = z
  .object({
    name: text(180),
    brand: text(80),
    category: z.enum(["Gaming Gadgets", "PUBG Accounts"]),
    subcategory: text(80),
    description: optionalText(1000),
    imageUrl: z
      .string()
      .trim()
      .max(2048)
      .refine((v) => !v || /^https:\/\//i.test(v), "Image URL must use HTTPS")
      .default(""),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z0-9][A-Z0-9._-]{2,79}$/,
        "Use 3-80 letters, numbers, dots, dashes or underscores for SKU",
      ),
    color: optionalText(80),
    price: money,
    costPrice: money,
    warrantyMonths: z.coerce.number().int().min(0).max(120),
    stockQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
    listingStatus: z.enum(["available", "reserved", "sold", "withdrawn"]).default("available"),
    lowStockThreshold: z.coerce.number().int().min(0).max(100_000),
  })
  .superRefine((value, ctx) => {
    if (value.category === "PUBG Accounts") {
      if (value.stockQuantity !== 0) ctx.addIssue({ code: "custom", path: ["stockQuantity"], message: "PUBG accounts do not hold stock" });
    }
    if (value.costPrice > value.price)
      ctx.addIssue({
        code: "custom",
        path: ["costPrice"],
        message: "Cost cannot be higher than retail price",
      });
  });
export const supplierSchema = z.object({
  name: text(180),
  phone: optionalText(40),
  email: z
    .union([z.literal(""), z.string().trim().email().max(255)])
    .default(""),
  address: optionalText(500),
  notes: optionalText(1000),
});
export const purchaseSchema = z.object({
  supplierId: z.string().uuid(),
  variantId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(100_000),
  unitCost: money,
  notes: optionalText(1000),
});
export const leadSchema = z
  .object({
    customerName: text(120),
    phone: optionalText(40),
    telegramUserId: optionalText(80),
    interestedIn: text(500),
    stage: z
      .enum(["new", "contacted", "reserved", "converted", "lost"])
      .default("new"),
    reserveExpiresAt: z.union([z.literal(""), z.coerce.date()]).default(""),
  })
  .superRefine((value, ctx) => {
    if (!value.phone && !value.telegramUserId)
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a phone number or Telegram user ID",
      });
  });
export const expenseSchema = z.object({
  category: z.enum([
    "Rent",
    "Payroll",
    "Delivery",
    "Marketing",
    "Utilities",
    "Software",
    "Maintenance",
    "Tax",
    "Other",
  ]),
  description: text(500),
  amount: money.refine((v) => v > 0, "Amount must be greater than zero"),
  paymentMethod: z.enum([
    "Cash",
    "KBZPay",
    "WavePay",
    "Bank Transfer",
    "Other",
  ]),
  expenseDate: z.coerce
    .date()
    .refine((v) => !Number.isNaN(v.getTime()), "Invalid expense date"),
});
export const bundleSchema = z
  .object({
    name: text(180),
    description: optionalText(1000),
    bundlePrice: money.refine(
      (v) => v > 0,
      "Bundle price must be greater than zero",
    ),
    items: z
      .array(
        z.object({
          sku: z.string().trim().toUpperCase().min(3).max(80),
          quantity: z.coerce.number().int().min(1).max(100),
        }),
      )
      .min(2, "A bundle needs at least two product lines")
      .max(12),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.items.forEach((item, index) => {
      if (seen.has(item.sku))
        ctx.addIssue({
          code: "custom",
          path: ["items", index, "sku"],
          message: "Each SKU can appear only once",
        });
      seen.add(item.sku);
    });
  });
export const staffSchema = z.object({
  name: text(120),
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(["admin", "staff"]),
  password: z.string().min(8).max(128).optional(),
});
export const telegramUpdateSchema = z.object({
  update_id: z.number().optional(),
  message: z
    .object({
      message_id: z.number().optional(),
      from: z
        .object({
          id: z.number(),
          username: z.string().optional(),
          first_name: z.string().optional(),
        })
        .optional(),
      chat: z.object({ id: z.number() }),
      text: z.string().max(1000).optional(),
      caption: z.string().max(1000).optional(),
      voice: z.object({ file_id: z.string() }).optional(),
      photo: z.array(z.object({ file_id: z.string() })).optional(),
    })
    .optional(),
  callback_query: z
    .object({
      data: z.string().max(200).optional(),
      from: z.object({ id: z.number() }),
      message: z.object({ chat: z.object({ id: z.number() }) }).optional(),
    })
    .optional(),
});

export function safeImageUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
