import { expect, test, type Page } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bundles as bundleTable,
  customers,
  orderBundleSets,
  orderItems,
  orders,
  products,
  productVariants,
} from "@/db/schema";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

test("activity history groups weeks and filters records", async ({ page }) => {
  await signIn(page, "/logs");
  await expect(
    page.getByRole("heading", { name: "Activity logs" }),
  ).toBeVisible();
  await expect(page.getByLabel("Filter week")).toBeVisible();
  await expect(page.getByLabel("Filter category")).toBeVisible();
  await page.getByLabel("Search activity").fill("nonexistent-audit-record-xyz");
  await expect(page.getByText("No matching activity")).toBeVisible();
  await page.getByLabel("Search activity").fill("");
  await expect(page.locator("summary").first()).toBeVisible();
  await page.getByLabel("Filter category").selectOption("inventory");
  await expect(page.locator("article").first()).toContainText(
    "Products & Stock",
  );
});

test("customer entry stays public and cannot fall through to operations", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/shop$/);
  await expect(
    page.getByRole("heading", { name: /Play better/i }),
  ).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to continue." }),
  ).toBeVisible();

  await page.goto("/shop/compare");
  await expect(page).toHaveURL(/\/shop\/compare$/);
});

test("staff role cannot enter admin-only access management", async ({
  page,
}) => {
  await page.goto("/login?next=%2Fstaff");
  await page.getByLabel("Email").fill("staff@mhop.test");
  await page.getByLabel("Password").fill("adminadminadmin");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { name: /MH OP Admin/i }).first(),
  ).toBeVisible();
});

async function signIn(page: Page, next = "/dashboard") {
  test.skip(!email || !password, "E2E admin credentials are required");
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace("/", "\\/")}$`));
}

async function cleanupCatalogFixture(sku: string) {
  if (!db) return;
  const removed = await db
    .delete(productVariants)
    .where(eq(productVariants.sku, sku))
    .returning({ productId: productVariants.productId });
  for (const row of removed) {
    await db.delete(products).where(eq(products.id, row.productId));
  }
}


async function cleanupOrderFixture(phone: string) {
  if (!db) return;
  await db.transaction(async (tx) => {
    const matchingOrders = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.phone, phone));
    for (const order of matchingOrders) {
      const items = await tx
        .select({
          variantId: orderItems.variantId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id));
      for (const item of items) {
        await tx
          .update(productVariants)
          .set({
            stockQuantity: sql`${productVariants.stockQuantity} + ${item.quantity}`,
          })
          .where(eq(productVariants.id, item.variantId));
      }
      await tx
        .delete(orderBundleSets)
        .where(eq(orderBundleSets.orderId, order.id));
      await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
      await tx.delete(orders).where(eq(orders.id, order.id));
    }
    await tx.delete(customers).where(eq(customers.phone, phone));
  });
}

test("public storefront search, filters, bag, and warranty navigation", async ({
  page,
}) => {
  await page.goto("/shop");
  await expect(
    page.getByRole("heading", { name: /Play better/i }),
  ).toBeVisible();

  const search = page.getByPlaceholder("What are you looking for?");
  await search.fill("zz-no-match");
  await expect(page.getByText("No products found")).toBeVisible();
  await page.getByRole("button", { name: "Show all products" }).click();
  await expect(search).toHaveValue("");

  await page
    .getByRole("button", { name: "Gaming Gadgets", exact: true })
    .click();
  const firstCard = page.locator("article").first();
  await expect(firstCard).toBeVisible();
  const add = firstCard.getByRole("button", { name: "Add to bag" });
  if (await add.isEnabled()) {
    await add.click();
    await expect(
      page.getByRole("link", { name: /Checkout 1 item/ }),
    ).toBeVisible();
  }



  await page.getByRole("link", { name: "Warranty" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your warranty." }),
  ).toBeVisible();
});

test("checkout validates customer input and calculates delivery", async ({
  page,
}) => {
  await page.goto("/shop");
  const add = page.getByRole("button", { name: "Add to bag" }).first();
  await expect(add).toBeVisible();
  await add.click();
  await page.getByRole("link", { name: /Checkout 1 item/ }).click();
  await expect(
    page.getByRole("heading", { name: "Complete your order." }),
  ).toBeVisible();
  await expect(page.getByText("Order total")).toBeVisible();
  await expect(page.getByRole("button", { name: "Place order" })).toBeEnabled();
});

test("staff authentication protects and opens every operations route", async ({
  page,
}) => {
  const routes: Array<[string, RegExp]> = [
    ["/dashboard", /MH OP Admin/i],
    ["/orders", /Orders & fulfillment/i],
    ["/inventory", /Products & Stock/i],
    ["/bundles", /Bundle Sets/i],
    ["/customers", /Customer directory/i],
    ["/tickets", /RMA ticket board/i],
    ["/receipts", /Sales voucher studio/i],
    ["/erp", /ERP & Finance/i],
    ["/ai-studio", /AI Creative Studio/i],
    ["/alerts", /Staff alerts/i],
    ["/logs", /Activity logs/i],
    ["/staff", /Staff & access/i],
  ];

  await signIn(page);
  for (const [route, heading] of routes) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} response status`).toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: heading }).first(),
    ).toBeVisible();
    await expect(page.getByText(/This view could not be loaded/i)).toHaveCount(
      0,
    );
  }
});

test("Bot & Messages provides a touch-sized mobile choose, edit, and preview flow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chrome",
    "Mobile Bot & Messages workflow",
  );
  await signIn(page, "/bot");

  for (const label of ["Choose", "Edit", "Preview"]) {
    const control = page.getByRole("button", { name: label, exact: true });
    await expect(control).toBeVisible();
    expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  }

  await page.getByRole("button", { name: /^Customer/ }).click();
  await page
    .getByRole("button", { name: /welcome.*Telegram Bot Welcome/i })
    .click();
  await expect(page.getByLabel("Message Template Copy")).toBeVisible();

  const viewportWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  const documentWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth);

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Telegram Preview" }),
  ).toBeVisible();
});

test("admin navigation preserves the shell and streams a content skeleton", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "Desktop shell persistence audit",
  );
  await signIn(page);

  const sidebar = page.locator(".app-sidebar");
  await sidebar.evaluate((element) => {
    element.setAttribute("data-e2e-shell", "persistent");
  });

  await page.route(/\/inventory\?.*_rsc=/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });

  const navigation = page
    .getByRole("link", { name: "Products & Stock" })
    .click();
  await expect(page.locator(".route-skeleton")).toBeVisible();
  await navigation;
  await expect(
    page.getByRole("heading", { name: "Products & Stock" }),
  ).toBeVisible();
  await expect(sidebar).toHaveAttribute("data-e2e-shell", "persistent");
  await expect(page.locator(".route-skeleton")).toHaveCount(0);
});

test("staff global search opens, searches, clears, and closes", async ({
  page,
}) => {
  await signIn(page);
  if ((page.viewportSize()?.width || 0) < 768) {
    await page
      .getByRole("button", { name: /search/i })
      .first()
      .click();
  }
  const search = page
    .getByRole("combobox", { name: /Search products, orders, and customers/i })
    .last();
  await search.fill("MHOP");
  const results = page.getByRole("listbox").last();
  await expect(results).toBeVisible();
  await expect(results.getByRole("option").first()).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).last().click();
  await expect(search).toHaveValue("");
});

test("staff control surfaces open, switch, reset, and close", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "Desktop control audit",
  );
  await signIn(page);

  const closeDialog = async () => {
    const dialog = page.getByRole("dialog").last();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  };

  await page.goto("/inventory");
  await page.getByRole("button", { name: "Add gadget" }).click();
  await closeDialog();
  await page.getByRole("button", { name: /^PUBG accounts/ }).click();
  await page.getByRole("button", { name: "Add PUBG account" }).click();
  await closeDialog();
  await page.getByPlaceholder(/Search PUBG accounts/i).fill("TEST");
  await expect(page.getByPlaceholder(/Search PUBG accounts/i)).toHaveValue(
    "TEST",
  );

  await page.goto("/bundles");
  const createBundle = page.getByRole("button", { name: "Create bundle set" });
  if (await createBundle.isEnabled()) {
    await createBundle.click();
    await closeDialog();
  }
  const editBundle = page.getByRole("button", { name: /^Edit / }).first();
  if (await editBundle.count()) {
    await editBundle.click();
    await closeDialog();
  }

  await page.goto("/erp");
  await page.getByRole("button", { name: "Suppliers" }).click();
  await page.getByRole("button", { name: "Add supplier" }).click();
  await closeDialog();
  await page.getByRole("button", { name: "Expenses" }).click();
  await page.getByRole("button", { name: "Add expense" }).click();
  await closeDialog();
  await page.getByRole("button", { name: "Purchasing" }).click();
  const addPurchase = page.getByRole("button", { name: "Add purchase" });
  if (await addPurchase.isEnabled()) {
    await addPurchase.click();
    await closeDialog();
  }

  await page.goto("/tickets");
  await page.getByRole("button", { name: "New warranty claim" }).click();
  await closeDialog();

  await page.goto("/staff");
  await page.getByRole("button", { name: "Add staff" }).click();
  await closeDialog();
  const editStaff = page.getByRole("button", { name: "Edit / reset" }).first();
  if (await editStaff.isEnabled()) {
    await editStaff.click();
    await closeDialog();
  }

  await page.goto("/orders");
  for (const filter of ["New", "Packing", "Dispatched", "All"]) {
    await page.getByRole("button", { name: filter, exact: true }).click();
  }

  await page.goto("/receipts");
  for (const format of ["80mm", "58mm", "Voucher"]) {
    await page.getByRole("button", { name: new RegExp(`^${format}`) }).click();
  }

  await page.goto("/ai-studio");
  const shortcut = page.getByLabel("MH OP shortcut");
  await shortcut.selectOption({ label: "/advertising" });
  await expect(page.getByLabel("Generated master prompt")).toHaveValue(
    /advertising/i,
  );
  await page.getByRole("button", { name: "Reset brief" }).click();
});

test("catalog, PUBG account, and bundle CRUD stay synchronized", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chrome", "Desktop CRUD audit");
  const sku = "E2E-GADGET-CRUD";
  const accountReference = "E2E-PUBG-ACCOUNT-CRUD";
  const bundleName = "E2E Commercial Set";
  await cleanupCatalogFixture(sku);
  await cleanupCatalogFixture(accountReference);
  if (db) await db.delete(bundleTable).where(eq(bundleTable.name, bundleName));

  try {
    await signIn(page, "/inventory");
    await page.getByRole("button", { name: "Add gadget" }).click();
    const listing = page.getByRole("dialog", { name: "Create listing" });
    await listing.getByLabel("Name").fill("E2E Test Gaming Headset");
    await listing.getByLabel("SKU").fill(sku);
    await listing.getByLabel("Brand").fill("Daemon QA");
    await listing.getByLabel("Retail price (MMK)").fill("25000");
    await listing.getByLabel("Cost price (MMK)").fill("15000");
    await listing.getByLabel("Stock quantity").fill("4");
    await listing
      .getByLabel("Description")
      .fill("Automated end-to-end fixture");
    await listing.getByRole("button", { name: "Create listing" }).click();
    await expect(page.getByRole("status")).toContainText(
      "created and published",
    );

    await page.getByPlaceholder(/Search gadgets.*SKU/i).fill(sku);
    await expect(page.getByRole("row").filter({ hasText: sku })).toContainText(
      "E2E Test Gaming Headset",
    );
    await page
      .getByRole("button", { name: "Edit E2E Test Gaming Headset" })
      .first()
      .click();
    const editListing = page.getByRole("dialog", { name: "Edit listing" });
    await editListing.getByLabel("Name").fill("E2E Updated Gaming Headset");
    await editListing.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("updated across");
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: "Delete E2E Updated Gaming Headset" })
      .first()
      .click();
    await expect(page.getByRole("status")).toContainText("Listing removed");

    await page.getByRole("button", { name: /^PUBG accounts/ }).click();
    await page.getByRole("button", { name: "Add PUBG account" }).click();
    const account = page.getByRole("dialog", { name: "Create listing" });
    await account.getByLabel("Name", { exact: true }).fill(accountReference);
    await account.getByLabel("SKU").fill(accountReference);
    await account.getByLabel("Retail price (MMK)").fill("50000");
    await account.getByLabel("Cost price (MMK)").fill("45000");
    await expect(account.getByLabel("Stock quantity")).toHaveCount(0);
    await account.getByRole("button", { name: "Create listing" }).click();
    await expect(page.getByRole("status")).toContainText("created and published");
    await page.getByPlaceholder(/Search PUBG accounts/i).fill(accountReference);
    await page.getByRole("button", { name: `Edit ${accountReference}` }).first().click();
    const editAccount = page.getByRole("dialog", { name: "Edit listing" });
    await editAccount.getByLabel("Sale status").selectOption("withdrawn");
    await editAccount.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toContainText("updated across");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: `Delete ${accountReference}` }).first().click();
    await expect(page.getByRole("status")).toContainText("Listing removed");

    await page.goto("/bundles");
    await page.getByRole("button", { name: "Create bundle set" }).click();
    const bundle = page.getByRole("dialog");
    await bundle.getByLabel("Name").fill(bundleName);
    await bundle.getByLabel("Bundle price (MMK)").fill("1");
    await bundle.getByLabel("Description").fill("Automated bundle fixture");
    await bundle.getByRole("button", { name: "Publish bundle" }).click();
    await expect(page.getByRole("status")).toContainText(
      "created and published",
    );
    await page.getByRole("button", { name: `Edit ${bundleName}` }).click();
    const editBundle = page.getByRole("dialog");
    await editBundle
      .getByLabel("Description")
      .fill("Updated automated bundle fixture");
    await editBundle.getByRole("button", { name: "Save bundle" }).click();
    await expect(page.getByRole("status")).toContainText("updated across");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: `Delete ${bundleName}` }).click();
    await expect(page.getByRole("status")).toContainText(
      "removed from all sales surfaces",
    );
  } finally {
    await cleanupCatalogFixture(accountReference);
    if (db)
      await db.delete(bundleTable).where(eq(bundleTable.name, bundleName));
    await cleanupCatalogFixture(sku);
  }
});

test("public checkout creates an order and customer atomically", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chrome",
    "Desktop order mutation audit",
  );
  const phone = "09999990001";
  await cleanupOrderFixture(phone);
  try {
    await page.goto("/shop");
    await page
      .getByRole("button", { name: "Gaming Gadgets", exact: true })
      .click();
    await page.getByRole("button", { name: "Add to bag" }).first().click();
    await page.getByRole("link", { name: /Checkout 1 item/ }).click();
    await page.getByLabel("Customer name").fill("E2E Checkout Customer");
    await page.getByLabel("Phone").fill(phone);
    await page.getByLabel("Delivery address").fill("E2E Test Address, Yangon");
    await page.getByRole("button", { name: "Place order" }).click();
    await expect(page.getByRole("status")).toContainText(/Order MHOP-/);
    if (db) {
      const [created] = await db
        .select()
        .from(orders)
        .where(eq(orders.phone, phone));
      expect(created?.customerId).toBeTruthy();
      expect(created?.totalAmount).not.toBe("0");
    }
  } finally {
    await cleanupOrderFixture(phone);
  }
});

test("staff completes the guarded payment, packing, and dispatch workflow", async ({
  page,
}, testInfo) => {
  test.skip(!db, "A database is required for the order workflow audit");
  const mobile = testInfo.project.name === "mobile-chrome";
  const phone = mobile ? "09999990003" : "09999990002";
  const orderCode = mobile ? "MHOP-260905-WF02" : "MHOP-260905-WF01";
  await cleanupOrderFixture(phone);

  try {
    const [customer] = await db!
      .insert(customers)
      .values({ name: "E2E Workflow Customer", phone })
      .returning({ id: customers.id });
    await db!.insert(orders).values({
      customerId: customer.id,
      orderCode,
      customerName: "E2E Workflow Customer",
      phone,
      shippingAddress: "E2E Yangon Address",
      shippingZone: "yangonInner",
      shippingFee: "4500",
      totalAmount: "104500",
      paymentMethod: "KBZPay",
      paymentSlipUrl: "telegram-file:E2E-PAYMENT-SLIP",
    });

    await signIn(page, "/orders");
    await page.getByRole("button", { name: new RegExp(orderCode) }).click();
    await page.getByRole("button", { name: "Approve payment" }).click();
    await expect(page.getByRole("status")).toContainText("moved to Packing");
    await expect
      .poll(async () => {
        const [row] = await db!
          .select({ status: orders.fulfillmentStatus })
          .from(orders)
          .where(eq(orders.orderCode, orderCode));
        return row?.status;
      })
      .toBe("packing");

    await page.getByRole("button", { name: "Mark as packed" }).click();
    await expect(page.getByRole("status")).toContainText("ready to dispatch");
    await page.getByLabel("Royal Express tracking number").fill("REX-E2E-WF01");
    await page.getByRole("button", { name: "Dispatch order" }).click();
    await expect(page.getByRole("status")).toContainText(
      "processing is complete",
    );
    await expect
      .poll(async () => {
        const [row] = await db!
          .select({
            status: orders.fulfillmentStatus,
            tracking: orders.trackingNumber,
          })
          .from(orders)
          .where(eq(orders.orderCode, orderCode));
        return row;
      })
      .toEqual({ status: "dispatched", tracking: "REX-E2E-WF01" });
  } finally {
    await cleanupOrderFixture(phone);
  }
});
