export type Condition =
  | "Brand New Sealed"
  | "Open Box Grade A+"
  | "Refurbished Grade A"
  | "Grade B"
  | "Verified Digital Account";
export type Category = "Gaming Gadgets" | "PUBG Accounts";
export type Subcategory =
  | "Gaming Headphones"
  | "Cooling Fans"
  | "Controllers"
  | "Charging Gear"
  | "Gaming Earbuds"
  | "Starter Accounts"
  | "Competitive Accounts"
  | "Collector Accounts";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  subcategory: Subcategory;
  image: string;
  tagline: string;
  specs: { label: string; value: string }[];
  price: number;
  cost: number;
  stock: number;
  sku: string;
  color: string;
  storage?: string;
  ram?: string;
  condition: Condition;
  warranty: number;
}

export interface Order {
  id: string;
  customer: string;
  channel: "Web" | "Telegram" | "POS";
  amount: number;
  payment: "Verified" | "Pending" | "Rejected";
  fulfillment: "New" | "Packing" | "Dispatched" | "Delivered";
  item: string;
  created: string;
}
