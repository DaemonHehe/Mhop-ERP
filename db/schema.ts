import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// --- Enums ---
export const deviceStatus = pgEnum("device_status", [
  "in_stock",
  "reserved",
  "sold",
  "rma_under_repair",
  "written_off",
]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "verified",
  "rejected",
  "refunded",
]);
export const fulfillmentStatus = pgEnum("fulfillment_status", [
  "new",
  "confirmed",
  "packing",
  "packed",
  "dispatched",
  "delivered",
  "cancelled",
  "returned",
]);

// --- Admin Users ---
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 40 }).notNull().default("staff"),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// --- Products & Catalog ---
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  brand: varchar("brand", { length: 80 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  subcategory: varchar("subcategory", { length: 80 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  imageUrls: jsonb("image_urls").$type<string[]>().default([]),
  baseCost: numeric("base_cost", { precision: 14, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

// --- Product Variants ---
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    sku: varchar("sku", { length: 80 }).notNull().unique(),
    color: varchar("color", { length: 80 }),
    storage: varchar("storage", { length: 40 }),
    ram: varchar("ram", { length: 40 }),
    condition: varchar("condition", { length: 60 }).notNull(),
    price: numeric("price", { precision: 14, scale: 2 }).notNull(),
    costPrice: numeric("cost_price", { precision: 14, scale: 2 }).notNull(),
    warrantyMonths: integer("warranty_months").notNull().default(12),
    stockQuantity: integer("stock_quantity").notNull().default(0),
    listingStatus: varchar("listing_status", { length: 20 }).notNull().default("available"),
    lowStockThreshold: integer("low_stock_threshold").notNull().default(3),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [index("product_variants_product_id_idx").on(table.productId)],
);

// --- Serialized Units & Digital Accounts ---
export const deviceUnits = pgTable(
  "device_units",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    serialNumber: varchar("serial_number", { length: 120 }).notNull().unique(),
    imeiNumber: varchar("imei_number", { length: 20 }).unique(),
    loginProvider: varchar("login_provider", { length: 60 }),
    rebindStatus: varchar("rebind_status", { length: 40 }).default("pending"),
    status: deviceStatus("status").notNull().default("in_stock"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    soldAt: timestamp("sold_at", { withTimezone: true }),
  },
  (table) => [
    index("device_units_variant_id_idx").on(table.variantId),
    index("device_units_status_idx").on(table.status),
    index("device_units_serial_number_idx").on(table.serialNumber),
  ],
);

// --- Customer master records ---
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerCode: varchar("customer_code", { length: 40 }),
    name: varchar("name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull().unique(),
    telegramUserId: varchar("telegram_user_id", { length: 80 }),
    telegramUsername: varchar("telegram_username", { length: 80 }),
    primaryAddress: text("primary_address"),
    notes: text("notes"),
    points: integer("points").notNull().default(0),
    tier: varchar("tier", { length: 40 }).notNull().default("member"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("customers_telegram_user_idx").on(table.telegramUserId),
    index("customers_telegram_username_idx").on(table.telegramUsername),
    index("customers_customer_code_idx").on(table.customerCode),
    index("customers_active_idx").on(table.isActive),
    index("customers_tier_idx").on(table.tier),
  ],
);

// --- Shipping Destinations (Royal Express 227 Destinations) ---
export const shippingDestinations = pgTable(
  "shipping_destinations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    srNo: integer("sr_no").notNull().unique(),
    stateCode: varchar("state_code", { length: 20 }).notNull(),
    stateName: varchar("state_name", { length: 80 }).notNull(),
    fromCity: varchar("from_city", { length: 80 }).notNull().default("Yangon"),
    toCity: varchar("to_city", { length: 120 }).notNull(),
    zone: varchar("zone", { length: 20 }).notNull(),
    normalPrice: numeric("normal_price", { precision: 14, scale: 2 }).notNull(),
    courierCost: numeric("courier_cost", { precision: 14, scale: 2 }).notNull(),
    nextKgRate: numeric("next_kg_rate", { precision: 14, scale: 2 }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (table) => [
    index("shipping_destinations_city_idx").on(table.toCity),
    index("shipping_destinations_state_idx").on(table.stateCode),
  ],
);

// --- Orders ---
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    orderCode: varchar("order_code", { length: 40 }).notNull().unique(),
    orderSource: varchar("order_source", { length: 40 }).notNull().default("web"),
    telegramUserId: varchar("telegram_user_id", { length: 80 }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    destinationId: uuid("destination_id").references(() => shippingDestinations.id),
    destinationCity: varchar("destination_city", { length: 120 }),
    destinationState: varchar("destination_state", { length: 80 }),
    shippingAddress: text("shipping_address"),
    streetAddress: text("street_address"),
    shippingZone: varchar("shipping_zone", { length: 40 }),
    shippingFee: numeric("shipping_fee", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    shippingCarrier: varchar("shipping_carrier", { length: 80 }),
    paymentMethod: varchar("payment_method", { length: 40 }),
    totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
    paymentStatus: paymentStatus("payment_status").notNull().default("pending"),
    fulfillmentStatus: fulfillmentStatus("fulfillment_status")
      .notNull()
      .default("new"),
    paymentSlipUrl: text("payment_slip_url"),
    trackingNumber: varchar("tracking_number", { length: 100 }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    isDigitalOnly: boolean("is_digital_only").notNull().default(false),
    packedWeightKg: numeric("packed_weight_kg", { precision: 8, scale: 2 }).notNull().default("1.00"),
    expectedCourierCost: numeric("expected_courier_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    actualCourierCost: numeric("actual_courier_cost", { precision: 14, scale: 2 }),
    requiredDeposit: numeric("required_deposit", { precision: 14, scale: 2 }).notNull().default("10000"),
    customerPaidAmount: numeric("customer_paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    customerBalance: numeric("customer_balance", { precision: 14, scale: 2 }).notNull().default("0"),
    codAmount: numeric("cod_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    customerPaymentStatus: varchar("customer_payment_status", { length: 40 }).notNull().default("unpaid"),
    courierSettlementStatus: varchar("courier_settlement_status", { length: 40 }).notNull().default("not_applicable"),
    commercialFrozen: boolean("commercial_frozen").notNull().default(false),
    deliveryFeeConfirmed: boolean("delivery_fee_confirmed").notNull().default(false),
    internalNotes: text("internal_notes"),
    returnCost: numeric("return_cost", { precision: 14, scale: 2 }).notNull().default("0"),
    returnReason: text("return_reason"),
    failedDeliveryAt: timestamp("failed_delivery_at", { withTimezone: true }),
    customerTier: varchar("customer_tier", { length: 40 }).notNull().default("member"),
    tierDiscountAmount: numeric("tier_discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    tierDeliveryDiscount: numeric("tier_delivery_discount", { precision: 14, scale: 2 }).notNull().default("0"),
    pointsEarned: integer("points_earned").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("orders_payment_status_idx").on(table.paymentStatus),
    index("orders_fulfillment_status_idx").on(table.fulfillmentStatus),
    index("orders_created_at_idx").on(table.createdAt),
    index("orders_phone_idx").on(table.phone),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_customer_payment_status_idx").on(table.customerPaymentStatus),
    index("orders_courier_settlement_status_idx").on(table.courierSettlementStatus),
  ],
);

// --- Order Items ---
export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    deviceUnitId: uuid("device_unit_id").references(() => deviceUnits.id),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    costSnapshot: numeric("cost_snapshot", {
      precision: 14,
      scale: 2,
    }).notNull(),
    quantity: integer("quantity").notNull().default(1),
  },
  (table) => [
    index("order_items_order_id_idx").on(table.orderId),
    index("order_items_variant_id_idx").on(table.variantId),
  ],
);

// --- Bundles ---
export const bundles = pgTable("bundles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  description: text("description"),
  bundlePrice: numeric("bundle_price", { precision: 14, scale: 2 }).notNull(),
  savingsAmount: numeric("savings_amount", {
    precision: 14,
    scale: 2,
  }).notNull(),
  itemsJson: jsonb("items_json").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const orderBundleSets = pgTable(
  "order_bundle_sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    bundleId: uuid("bundle_id").references(() => bundles.id),
    bundleName: varchar("bundle_name", { length: 180 }).notNull(),
    bundlePrice: numeric("bundle_price", { precision: 14, scale: 2 }).notNull(),
    itemsJson: jsonb("items_json").notNull(),
  },
  (table) => [
    index("order_bundle_sets_order_idx").on(table.orderId),
    index("order_bundle_sets_bundle_idx").on(table.bundleId),
  ],
);

// --- Tickets / RMA ---
export const tickets = pgTable(
  "tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketCode: varchar("ticket_code", { length: 40 }).notNull().unique(),
    orderCode: varchar("order_code", { length: 40 }).notNull(),
    orderItemId: uuid("order_item_id").references(() => orderItems.id),
    serialNumber: varchar("serial_number", { length: 120 }),
    customerName: varchar("customer_name", { length: 120 }).notNull(),
    phone: varchar("phone", { length: 40 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    priority: varchar("priority", { length: 30 }).notNull().default("normal"),
    status: varchar("status", { length: 40 })
      .notNull()
      .default("claim_received"),
    messageText: text("message_text"),
    warrantyStartAt: timestamp("warranty_start_at", { withTimezone: true }),
    warrantyExpiresAt: timestamp("warranty_expires_at", { withTimezone: true }),
    resolution: varchar("resolution", { length: 40 }),
    resolutionCost: numeric("resolution_cost", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    refundAmount: numeric("refund_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    replacementVariantId: uuid("replacement_variant_id").references(
      () => productVariants.id,
    ),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("tickets_order_code_idx").on(table.orderCode),
    index("tickets_serial_number_idx").on(table.serialNumber),
    index("tickets_status_idx").on(table.status),
    index("tickets_order_item_idx").on(table.orderItemId),
  ],
);


// --- Staff Alerts ---
export const staffAlerts = pgTable("staff_alerts", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 60 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  body: text("body").notNull(),
  targetCode: varchar("target_code", { length: 80 }),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Receipt Settings ---
export const receiptSettings = pgTable("receipt_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  shopName: varchar("shop_name", { length: 180 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 40 }),
  headerMessage: text("header_message"),
  footerMessage: text("footer_message"),
  paperSize: integer("paper_size").notNull().default(80),
  showBarcode: boolean("show_barcode").notNull().default(true),
  showQr: boolean("show_qr").notNull().default(true),
});

// --- System Audit Logs ---
export const systemAuditLogs = pgTable(
  "system_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    category: varchar("category", { length: 40 }).notNull().default("system"),
    event: varchar("event", { length: 80 }).notNull(),
    actor: varchar("actor", { length: 120 }).notNull().default("system"),
    targetCode: varchar("target_code", { length: 100 }),
    details: text("details").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_logs_category_created_idx").on(
      table.category,
      table.createdAt,
    ),
    index("audit_logs_event_idx").on(table.event),
    index("audit_logs_created_at_idx").on(table.createdAt),
  ],
);

// --- Bot Sessions ---
export const botSessions = pgTable("bot_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  telegramUserId: varchar("telegram_user_id", { length: 80 })
    .notNull()
    .unique(),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  stateJson: jsonb("state_json").notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- ERP: suppliers, purchasing and expenses ---
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 255 }),
    address: text("address"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("suppliers_active_idx").on(table.isActive)],
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    poCode: varchar("po_code", { length: 40 }).notNull().unique(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => suppliers.id),
    status: varchar("status", { length: 30 }).notNull().default("ordered"),
    totalCost: numeric("total_cost", { precision: 14, scale: 2 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
  },
  (table) => [
    index("purchase_orders_supplier_idx").on(table.supplierId),
    index("purchase_orders_status_idx").on(table.status),
  ],
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseOrderId: uuid("purchase_order_id")
      .notNull()
      .references(() => purchaseOrders.id),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id),
    quantity: integer("quantity").notNull(),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    index("purchase_items_order_idx").on(table.purchaseOrderId),
    index("purchase_items_variant_idx").on(table.variantId),
  ],
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    expenseCode: varchar("expense_code", { length: 40 }).notNull().unique(),
    category: varchar("category", { length: 80 }).notNull(),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull(),
    expenseDate: timestamp("expense_date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("expenses_date_idx").on(table.expenseDate),
    index("expenses_category_idx").on(table.category),
  ],
);

// --- Payment Accounts ---
export const paymentAccounts = pgTable(
  "payment_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bankName: varchar("bank_name", { length: 120 }).notNull(),
    accountHolder: varchar("account_holder", { length: 120 }).notNull(),
    accountNumber: varchar("account_number", { length: 120 }).notNull(),
    instructions: text("instructions"),
    qrCodeUrl: text("qr_code_url"),
    isActive: boolean("is_active").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("payment_accounts_active_idx").on(table.isActive),
    index("payment_accounts_order_idx").on(table.displayOrder),
  ],
);

// --- Order Payments (Immutable Payment Ledger) ---
export const orderPayments = pgTable(
  "order_payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    paymentType: varchar("payment_type", { length: 40 }).notNull(), // 'deposit', 'cod_collection', 'direct_prepayment', 'refund', 'adjustment'
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull().default("kbzpay"),
    status: varchar("status", { length: 40 }).notNull().default("pending"), // 'pending', 'verified', 'rejected', 'reversed'
    reference: varchar("reference", { length: 120 }),
    slipUrl: text("slip_url"),
    recordedBy: varchar("recorded_by", { length: 120 }).notNull().default("customer"),
    verifiedBy: varchar("verified_by", { length: 120 }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    reversalOfId: uuid("reversal_of_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("order_payments_order_id_idx").on(table.orderId),
    index("order_payments_status_idx").on(table.status),
    index("order_payments_type_idx").on(table.paymentType),
  ],
);

// --- Courier Settlement Batches ---
export const courierSettlementBatches = pgTable(
  "courier_settlement_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchCode: varchar("batch_code", { length: 60 }).notNull().unique(),
    courierName: varchar("courier_name", { length: 80 }).notNull().default("Royal Express"),
    bankAccount: varchar("bank_account", { length: 120 }).notNull(),
    transferReference: varchar("transfer_reference", { length: 120 }).notNull(),
    settlementDate: timestamp("settlement_date", { withTimezone: true }).notNull(),
    totalCollected: numeric("total_collected", { precision: 14, scale: 2 }).notNull().default("0"),
    totalCourierFees: numeric("total_courier_fees", { precision: 14, scale: 2 }).notNull().default("0"),
    otherFees: numeric("other_fees", { precision: 14, scale: 2 }).notNull().default("0"),
    bankReceivedAmount: numeric("bank_received_amount", { precision: 14, scale: 2 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("completed"), // 'completed', 'discrepancy', 'reversed'
    discrepancyAmount: numeric("discrepancy_amount", { precision: 14, scale: 2 }).notNull().default("0"),
    recordedBy: varchar("recorded_by", { length: 120 }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("courier_settlements_date_idx").on(table.settlementDate),
    index("courier_settlements_status_idx").on(table.status),
  ],
);

// --- Courier Settlement Allocations ---
export const courierSettlementAllocations = pgTable(
  "courier_settlement_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    settlementBatchId: uuid("settlement_batch_id")
      .notNull()
      .references(() => courierSettlementBatches.id),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    expectedCod: numeric("expected_cod", { precision: 14, scale: 2 }).notNull(),
    allocatedCollected: numeric("allocated_collected", { precision: 14, scale: 2 }).notNull(),
    expectedCourierFee: numeric("expected_courier_fee", { precision: 14, scale: 2 }).notNull(),
    allocatedCourierFee: numeric("allocated_courier_fee", { precision: 14, scale: 2 }).notNull(),
    netOrderPayout: numeric("net_order_payout", { precision: 14, scale: 2 }).notNull(),
    allocatedBy: varchar("allocated_by", { length: 120 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("courier_allocations_batch_idx").on(table.settlementBatchId),
    index("courier_allocations_order_idx").on(table.orderId),
  ],
);

// --- Media Uploads (Persistent Images) ---
export const mediaUploads = pgTable(
  "media_uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    filename: varchar("filename", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull().default("image/webp"),
    sizeBytes: integer("size_bytes").notNull(),
    data: text("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("media_uploads_created_at_idx").on(table.createdAt)],
);

// --- Bot & Automation Message Templates ---
export const botMessageTemplates = pgTable(
  "bot_message_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 80 }).notNull().unique(),
    label: varchar("label", { length: 160 }).notNull(),
    description: text("description"),
    triggerSource: varchar("trigger_source", { length: 80 }).notNull().default("manual"),
    content: text("content").notNull(),
    placeholders: jsonb("placeholders").$type<string[]>().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: varchar("updated_by", { length: 120 }),
  },
  (table) => [index("bot_message_templates_key_idx").on(table.key)],
);

// --- AI Sales Agent Knowledge Base (Q&A Feed) ---
export const aiSalesQa = pgTable(
  "ai_sales_qa",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    category: varchar("category", { length: 80 }).notNull().default("general"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: varchar("updated_by", { length: 120 }),
  },
  (table) => [
    index("ai_sales_qa_created_idx").on(table.createdAt),
    index("ai_sales_qa_category_idx").on(table.category),
  ],
);


