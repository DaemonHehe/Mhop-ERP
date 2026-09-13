export const clientConfig = {
  developer: { name: "Daemon" },
  brand: {
    name: "MH OP",
    fullName: "Mh Op Mobile Gaming One Stop Service",
    tagline: "100% Authentic and Official Store Direct Products",
    vibe: ["Modern Minimalist", "Warm & Friendly", "Youthful & Trendy"],
    language: "my",
    politenessMarker: "ခင်ဗျာ",
  },
  telegram: {
    displayName: "Mh Op Store Virtual Assistance",
    handle: "@Mhopassistant_bot",
    operationsGroup: "Mh Op Operations Group",
    welcome:
      "မင်္ဂလာပါ။ MH OP Store မှ ကြိုဆိုပါတယ်။\n\nMobile Gadgets များနဲ့ PUBG Mobile Account များကို စျေးနှုန်းမှန်ကန်စွာနဲ့ 100% authentic အာမခံဖြင့် ရရှိနိုင်ပါမယ်ခင်ဗျာ။\n\nအောက်ပါ Menu မှတဆင့် စတင်ကြည့်ရှုနိုင်ပါသည်—\n• /catalog — ရရှိနိုင်သော Gadgets များနှင့် Account စျေးနှုန်းများ ကြည့်ရန်\n• /support — Customer Service နှင့် တိုက်ရိုက်ဆက်သွယ်ရန်\n• Payment Slip ပုံပေးပို့၍ အော်ဒါအတည်ပြုရန်",
    slipAcknowledgment:
      "ကျေးဇူးတင်ပါတယ်ခင်ဗျာ။ လူကြီးမင်းပေးပို့ထားသော Payment Slip ကို Admin Team မှ စစ်ဆေးနေပါပြီ။\n\nငွေလွှဲအတည်ပြုပြီးပါက Tracking Code နှင့် Delivery အချက်အလက်များကို အကြောင်းကြားပေးပါမည်။",
  },
  payments: {
    kbzPay: {
      label: "KBZPay (KPay)",
      holder: "Ko Ko Kyaw",
      account: "09798888123",
    },
    wavePay: {
      label: "WavePay",
      holder: "OS Official",
      account: "09798888123",
    },
    bank: { label: "KBZ Bank", holder: "Ko Ko Kyaw", account: "0123456789012" },
  },
  shipping: {
    courier: "Royal Express",
    defaultDeposit: 5000,
    zones: {
      yangonInner: {
        label: "Yangon (Inner)",
        fee: 4500,
        freeAbove: 50000,
        leadTime: "1–2 days",
      },
      yangonOuter: {
        label: "Yangon (Outer)",
        fee: 5000,
        freeAbove: 60000,
        leadTime: "1–2 days",
      },
      otherCities: {
        label: "Other Cities",
        fee: 5000,
        freeAbove: 70000,
        leadTime: "2–4 days",
      },
    },
  },
  automation: {
    cartReminderMinutes: 15,
    followUpDays: "21–30",
    discountPercent: 10,
  },
  admin: { email: "admin@decantos.com" },
  receipt: {
    storeName: "Mh OP Gadget Store",
    telegram: "@Mhopassistant_bot",
    viber: "09772601762",
    tiktok: "Mh Op",
    voucherTitle: "အရောင်းဘောက်ချာ",
    warrantyTerms: [
      "Warranty Claim ပြုလုပ်ရန် Product Box၊ Accessories နှင့် Packaging များ အပြည့်အစုံ၊ ဝယ်ယူပြေစာနှင့်အတူ ပြန်လည်ယူဆောင်လာရန် လိုအပ်ပါသည်။",
      "Liquid Damage၊ မမှန်ကန်စွာအသုံးပြုခြင်း (Misuse or Abuse)၊ ပြုတ်ကျ/ထိခိုက်မှု (Physical Damage) နှင့် ခွင့်ပြုချက်မရှိသော ပြုပြင်ပြောင်းလဲမှုများကို Warranty မပါဝင်ပါ။",
      "Third-party Accessories သို့မဟုတ် Software ကြောင့်ဖြစ်သော Damage နှင့် Serial Number ဖျက်ထားခြင်း/မဖတ်နိုင်ခြင်းများကို Warranty မပေးပါ။",
      "ပစ္စည်းလက်ခံရရှိချိန်တွင် Packaging နှင့် ပစ္စည်းအခြေအနေကို Video ရိုက်ကူးထားပါ။ Claim ပြုလုပ်ရာတွင် အဆိုပါ Video ကို တောင်းခံနိုင်ပါသည်။",
    ],
  },
} as const;

export type ShippingZone = keyof typeof clientConfig.shipping.zones;
export function calculateShipping(subtotal: number, zone: ShippingZone) {
  const rule = clientConfig.shipping.zones[zone];
  return subtotal >= rule.freeAbove ? 0 : rule.fee;
}

export function calculateOrderShipping(
  subtotal: number,
  zone: ShippingZone,
  digitalOnly: boolean,
) {
  return digitalOnly ? 0 : calculateShipping(subtotal, zone);
}

export {
  calculateRoyalDelivery,
  calculateRequiredDeposit,
  type DeliveryQuoteInput,
  type DeliveryRateSnapshot,
} from "./shipping/royal-rates";
export {
  ROYAL_DESTINATIONS,
  CHECKOUT_CITIES,
  getDestinationsByState,
  findDestinationByCity,
  type ShippingDestinationItem,
  type CheckoutCityOption,
} from "./shipping/destinations-data";
