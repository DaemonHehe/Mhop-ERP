import { getCustomers } from "./customer.service";
import { getOrders } from "./order.service";
import { getInventory } from "./stock.service";

export type GlobalSearchResultType = "Product" | "Order" | "Customer";

export interface GlobalSearchResult {
  id: string;
  type: GlobalSearchResultType;
  label: string;
  meta: string;
  href: string;
}

const normalize = (value: string | null | undefined) =>
  (value || "").trim().toLocaleLowerCase();

const matches = (query: string, values: Array<string | null | undefined>) =>
  values.some((value) => normalize(value).includes(query));

export async function searchBusiness(
  rawQuery: string,
): Promise<GlobalSearchResult[]> {
  const query = normalize(rawQuery).slice(0, 80);
  if (query.length < 2) return [];

  const [inventory, orders, customers] = await Promise.all([
    getInventory(),
    getOrders(),
    getCustomers(),
  ]);

  const productResults = inventory
    .filter((product) =>
      matches(query, [
        product.name,
        product.brand,
        product.sku,
        product.category,
        product.subcategory,
      ]),
    )
    .slice(0, 5)
    .map<GlobalSearchResult>((product) => ({
      id: product.variantId,
      type: "Product",
      label: product.name,
      meta: `${product.sku} · ${product.stock} in stock`,
      href: "/inventory",
    }));

  const orderResults = orders
    .filter((order) =>
      matches(query, [
        order.orderCode,
        order.id,
        order.customer,
        order.phone,
        order.item,
      ]),
    )
    .slice(0, 5)
    .map<GlobalSearchResult>((order) => ({
      id: order.id,
      type: "Order",
      label: order.orderCode || order.id,
      meta: `${order.customer} · ${order.fulfillment}`,
      href: "/orders",
    }));

  const customerResults = customers
    .filter((customer) =>
      matches(query, [
        customer.name,
        customer.phone,
        customer.telegramUserId,
        customer.primaryAddress,
        customer.source,
      ]),
    )
    .slice(0, 5)
    .map<GlobalSearchResult>((customer) => ({
      id: `${customer.phone}-${customer.name}`,
      type: "Customer",
      label: customer.name,
      meta: `${customer.phone} · ${customer.orders} order${customer.orders === 1 ? "" : "s"}`,
      href: "/customers",
    }));

  return [...productResults, ...orderResults, ...customerResults].slice(0, 12);
}
