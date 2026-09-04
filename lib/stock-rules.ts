export type StockLifecycle =
  "in_stock" | "reserved" | "sold" | "rma_under_repair" | "written_off";

export function availabilityDelta(
  before: StockLifecycle,
  after: StockLifecycle,
) {
  if (before === after) return 0;
  if (before === "in_stock") return -1;
  if (after === "in_stock") return 1;
  return 0;
}

export function canDeleteAccount(status: StockLifecycle) {
  return status === "in_stock";
}
