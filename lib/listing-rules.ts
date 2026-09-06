export function canPurchaseListing(item: { category: string; stock: number; listingStatus?: string }, quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1) return false;
  return item.category === "PUBG Accounts"
    ? quantity === 1 && item.listingStatus === "available"
    : item.stock >= quantity;
}
