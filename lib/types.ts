export type Condition =
  | "Brand New Sealed"
  | "Open Box Grade A+"
  | "Refurbished Grade A"
  | "Grade B"
  | "Verified Digital Account"
  | "Brand New Preorder";
export type Category = "Gaming Gadgets" | "PUBG Accounts" | "Preorder Items";
export type Subcategory =
  | "Gaming Headphones"
  | "Cooling Fans"
  | "Controllers"
  | "Charging Gear"
  | "Gaming Earbuds"
  | "Starter Accounts"
  | "Competitive Accounts"
  | "Collector Accounts"
  | "Upcoming Releases"
  | "Preorder Gadgets"
  | "Special Editions"
  | "Custom Orders"
  | string;

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  subcategory: Subcategory;
  waitingTime?: string | null;
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
  sortOrder?: number;
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
