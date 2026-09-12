export function canPurchaseListing(item: { category: string; stock: number; listingStatus?: string }, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) return false;
  if (item.category === "PUBG Accounts") {
    return quantity === 1 && item.listingStatus === "available";
  }
  if (item.category === "Preorder Items") {
    return item.listingStatus !== "withdrawn";
  }
  return item.stock >= quantity;
}
