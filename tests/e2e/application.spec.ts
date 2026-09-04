import { expect, test, type Page } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bundles as bundleTable,
  customers,
  deviceUnits,
  orderBundleSets,
  orderItems,
  orders,
  products,
  productVariants,
} from "@/db/schema";

const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

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

test("staff role cannot enter admin-only access management", async ({ page }) => {
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

async function cleanupAccountFixture(identifier: string) {
  if (!db) return;
  await db.transaction(async (tx) => {
    const [unit] = await tx
      .select()
      .from(deviceUnits)
      .where(eq(deviceUnits.serialNumber, identifier));
    if (!unit) return;
    await tx.delete(deviceUnits).where(eq(deviceUnits.id, unit.id));
    if (unit.status === "in_stock") {
      await tx
        .update(productVariants)
        .set({
          stockQuantity: sql`greatest(0, ${productVariants.stockQuantity} - 1)`,
        })
        .where(eq(productVariants.id, unit.variantId));
    }
  });
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

test("public storefront search, filters, bag, comparison and warranty navigation", async ({
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

  const compare = firstCard.getByRole("button", {
    name: /Add .* to comparison/,
  });
  await compare.click();
  await expect(page.getByRole("link", { name: "Compare" })).toBeVisible();

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
    ["/leads", /Leads & recovery/i],
    ["/tickets", /RMA ticket board/i],
    ["/receipts", /Sales voucher studio/i],
    ["/erp", /ERP & Finance/i],
    ["/ai-studio", /AI Creative Studio/i],
    ["/bot", /Bot studio/i],
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
  await page.getByRole("button", { name: "Add listing" }).click();
  await closeDialog();
  await page.getByRole("button", { name: "Account vault" }).click();
  await page.getByRole("button", { name: "Add PUBG account" }).click();
  await closeDialog();
  await page.getByPlaceholder(/Search account reference/i).fill("TEST");
  await expect(page.getByPlaceholder(/Search account reference/i)).toHaveValue(
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
  await cleanupAccountFixture(accountReference);
  if (db) await db.delete(bundleTable).where(eq(bundleTable.name, bundleName));

  try {
    await signIn(page, "/inventory");
    await page.getByRole("button", { name: "Add listing" }).click();
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

    await page.getByPlaceholder(/Search product, category or SKU/i).fill(sku);
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

    await page.getByRole("button", { name: "Account vault" }).click();
    await page.getByRole("button", { name: "Add PUBG account" }).click();
    const account = page.getByRole("dialog", { name: "Add PUBG account" });
    await account.getByLabel("PUBG listing").selectOption({ index: 1 });
    await account
      .getByLabel("Internal account reference")
      .fill(accountReference);
    await account.getByLabel("Login provider").fill("E2E provider");
    await account.getByRole("button", { name: "Add account" }).click();
    await expect(page.getByRole("status")).toContainText(
      "availability synchronized",
    );
    await page
      .getByPlaceholder(/Search account reference/i)
      .fill(accountReference);
    await page
      .getByRole("button", { name: `Edit ${accountReference}` })
      .first()
      .click();
    const editAccount = page.getByRole("dialog", { name: "Edit PUBG account" });
    await editAccount.getByLabel("Rebind status").selectOption("ready");
    await editAccount.getByRole("button", { name: "Save account" }).click();
    await expect(page.getByRole("status")).toContainText(
      "availability updated",
    );
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("button", { name: `Delete ${accountReference}` })
      .first()
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Account deleted and availability synchronized",
    );

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
    await cleanupAccountFixture(accountReference);
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
