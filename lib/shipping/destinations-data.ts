export interface ShippingDestinationItem {
  srNo: number;
  stateCode: string;
  stateName: string;
  fromCity: string;
  toCity: string;
  zone: string;
  normalPrice: number;
  customerRate?: number;
  courierCost: number;
  nextKgRate: number;
}

export const STATE_NAMES: Record<string, string> = {
  AYA: "Ayeyarwady",
  BGO: "Bago",
  CHIN: "Chin",
  KACHIN: "Kachin",
  KAYAR: "Kayah",
  KAYIN: "Kayin",
  MDY: "Mandalay",
  MGY: "Magway",
  MON: "Mon",
  NPW: "Naypyidaw",
  RKE: "Rakhine",
  SGG: "Sagaing",
  SHAN: "Shan",
  TNT: "Tanintharyi",
  YGN: "Yangon",
};

export const ROYAL_DESTINATIONS: ShippingDestinationItem[] = [
  // --- Page 1: Ayeyarwady (1–38) & Bago (39–47) ---
  { srNo: 1, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Hinthada", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 2, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Maubin", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 3, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Mawlamyinegyun", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 4, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Myaungmya", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 5, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Nyaungtone", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 6, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Pathein", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 7, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Pyapon", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 8, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Wakema", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 9, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Kyaiklat", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 10, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Pantanaw", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 11, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Zalun", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 12, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Bogale", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 13, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Labutta", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 14, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Danubyu", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 15, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Ngathaingchaung", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 16, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Yegyi", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 17, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Kyonpyaw", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 18, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Ahtaung", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 19, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Kyaunggon", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 20, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Thabaung", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 21, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Chaung Thar", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 22, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Myanaung", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 23, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Kyangin", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 24, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Paungde", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 25, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Einme", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 26, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Dedaye", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 27, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Kangyidaunt", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 28, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Ngapudaw", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 29, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Ingapu", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 30, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Lemyethna", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 31, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Kyonemangay", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 32, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Htugyi", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 33, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Pyinywa", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 34, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Darka", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 35, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Ngwesaung", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 36, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Atthoke", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 37, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "Sar Ma Lauk", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 38, stateCode: "AYA", stateName: "Ayeyarwady", fromCity: "Yangon", toCity: "KwinKauk", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 39, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Bago", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 40, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Nyaunglebin", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 41, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Daik-U", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 42, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Phyu", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 43, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Pyay", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 44, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Taungoo", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 45, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Tharyarwaddy", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 46, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Thonese", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 47, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Gyobingauk", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },

  // --- Page 2: Bago (48–79), Chin (80), Kachin (81–89), Kayah (90), Kayin (91–94) ---
  { srNo: 48, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Nattalin", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 49, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Yae Ni", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 50, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Letpadan", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 51, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Thanatpin", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 52, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Lower MinHla", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 53, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Kaytumaddy", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 54, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "ShweDaung", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 55, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Inntakaw", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 56, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Waw", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 57, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Kyauktaga", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 58, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Yedashay", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 59, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Zigon", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 60, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Oktwin", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 61, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "OkeShitPin", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 62, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Penwegon", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 63, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "HpaYarGyi", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 64, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Monyo", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 65, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Paungtale", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 66, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Okpho", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 67, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Thegon", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 68, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Shwegyin", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 69, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Pyuntasa", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 70, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Innma", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 71, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Kanyutkwin", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 72, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Tharkaya", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 73, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Myohla", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 74, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Kawa", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 75, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Sitkwin", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 76, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Oaethaekone", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 77, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Shwelaung", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 78, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "NyaungChayHtauk", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 79, stateCode: "BGO", stateName: "Bago", fromCity: "Yangon", toCity: "Swar", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 80, stateCode: "CHIN", stateName: "Chin", fromCity: "Yangon", toCity: "Hakha", zone: "G", normalPrice: 8500, courierCost: 7650, nextKgRate: 2700 },
  { srNo: 81, stateCode: "KACHIN", stateName: "Kachin", fromCity: "Yangon", toCity: "Myitkyina", zone: "I", normalPrice: 10000, courierCost: 9000, nextKgRate: 2700 },
  { srNo: 82, stateCode: "KACHIN", stateName: "Kachin", fromCity: "Yangon", toCity: "Mogaung", zone: "H", normalPrice: 9500, courierCost: 8550, nextKgRate: 2700 },
  { srNo: 83, stateCode: "KACHIN", stateName: "Kachin", fromCity: "Yangon", toCity: "Mohnyin", zone: "H", normalPrice: 9500, courierCost: 8550, nextKgRate: 2700 },
  { srNo: 84, stateCode: "KACHIN", stateName: "Kachin", fromCity: "Yangon", toCity: "Hpakan", zone: "I", normalPrice: 10000, courierCost: 9000, nextKgRate: 2700 },
  { srNo: 85, stateCode: "KACHIN", stateName: "Kachin", fromCity: "Yangon", toCity: "Bhamaw", zone: "H", normalPrice: 9500, courierCost: 8550, nextKgRate: 2700 },
  { srNo: 86, stateCode: "KACHIN", stateName: "Kachin", fromCity: "Yangon", toCity: "Waingmaw", zone: "H", normalPrice: 9500, courierCost: 8550, nextKgRate: 2700 },
  { srNo: 87, stateCode: "KACHIN", stateName: "Kachin", fromCity: "Yangon", toCity: "Danai", zone: "I", normalPrice: 10000, courierCost: 9000, nextKgRate: 2700 },
  { srNo: 88, stateCode: "KACHIN", stateName: "Kachin", fromCity: "Yangon", toCity: "Namti", zone: "H", normalPrice: 9500, courierCost: 8550, nextKgRate: 2700 },
  { srNo: 89, stateCode: "KACHIN", stateName: "Kachin", fromCity: "Yangon", toCity: "Momauk", zone: "H", normalPrice: 9500, courierCost: 8550, nextKgRate: 2700 },
  { srNo: 90, stateCode: "KAYAR", stateName: "Kayah", fromCity: "Yangon", toCity: "Loikaw", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 91, stateCode: "KAYIN", stateName: "Kayin", fromCity: "Yangon", toCity: "Hpa-An", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 92, stateCode: "KAYIN", stateName: "Kayin", fromCity: "Yangon", toCity: "Myawaddy", zone: "F", normalPrice: 8000, courierCost: 7200, nextKgRate: 2250 },
  { srNo: 93, stateCode: "KAYIN", stateName: "Kayin", fromCity: "Yangon", toCity: "Kawkareik", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 94, stateCode: "KAYIN", stateName: "Kayin", fromCity: "Yangon", toCity: "Hlaingbwe", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },

  // --- Page 3: Kayin (95), Mandalay (96–127), Magway (128–141) ---
  { srNo: 95, stateCode: "KAYIN", stateName: "Kayin", fromCity: "Yangon", toCity: "Myaingkalay", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 96, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Bagan", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 97, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Nyaung-U", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 98, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Kyaukse", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 99, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Mandalay", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 100, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Meiktila", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 101, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Wundwin", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 102, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Mahlaing", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 103, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Myingyan", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 104, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Pyawbwe", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 105, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Pyin Oo Lwin", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 106, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Yamethin", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 107, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Kyaukpadaung", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 108, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Sintgaing", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 109, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Kume", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 110, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Thazi", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 111, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Madaya", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 112, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Myitthar", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 113, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Paukkaung", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 114, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Ohn Chaw", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 115, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Taungtha", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 116, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Anesakhan", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 117, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Amarapura", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 118, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Myintnge", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 119, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Natoegyi", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 120, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Han Myint Mo", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 121, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Tada-U", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 122, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Zeepingyi", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 123, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Patheingyi", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 124, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Padaung", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 125, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Palaik", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 126, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Pyinyaung", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 127, stateCode: "MDY", stateName: "Mandalay", fromCity: "Yangon", toCity: "Mogok", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 128, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Aunglan", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 129, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Chauk", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 130, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Magway", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 131, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Minbu", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 132, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Pakokku", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 133, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Yesagyo", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 134, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Taungdwingyi", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 135, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Thayed", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 136, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Yenanchaung", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 137, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Pwintbyu", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 138, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "NatMauk", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 139, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Salin", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 140, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "SinHpyuKyun", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 141, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Satthwar", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },

  // --- Page 4: Magway (142–152), Mon (153–167), Naypyidaw (168–171), Rakhine (172–180), Sagaing (181–188) ---
  { srNo: 142, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Myothit", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 143, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Kamma", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 144, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Mindone", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 145, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Ngape", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 146, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Upper Minhla", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 147, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Saku", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 148, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Salay", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 149, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Seik Phyu", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 150, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "Kamma (Pakokku)", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 151, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "SinBaungWe", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 152, stateCode: "MGY", stateName: "Magway", fromCity: "Yangon", toCity: "ThitYarGyauk", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 153, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Mawlamyine", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 154, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Bilin", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 155, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Mudon", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 156, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Thaton", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 157, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Ye", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 158, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Thanbyuzayat", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 159, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Kyaikto", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 160, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Paung", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 161, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Mottama", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 162, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Kyaikmaraw", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 163, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Kyaikkhami", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 164, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Kyaikkaw", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 165, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Chaungzone", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 166, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "Thein Za Yat", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 167, stateCode: "MON", stateName: "Mon", fromCity: "Yangon", toCity: "ZinKyaik", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 168, stateCode: "NPW", stateName: "Naypyidaw", fromCity: "Yangon", toCity: "Naypyidaw", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 169, stateCode: "NPW", stateName: "Naypyidaw", fromCity: "Yangon", toCity: "Tatkon", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 170, stateCode: "NPW", stateName: "Naypyidaw", fromCity: "Yangon", toCity: "Tharwuthti", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 171, stateCode: "NPW", stateName: "Naypyidaw", fromCity: "Yangon", toCity: "Zeyawaddy", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 172, stateCode: "RKE", stateName: "Rakhine", fromCity: "Yangon", toCity: "Sittwe", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 173, stateCode: "RKE", stateName: "Rakhine", fromCity: "Yangon", toCity: "Toungup", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 174, stateCode: "RKE", stateName: "Rakhine", fromCity: "Yangon", toCity: "Thandwe", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 175, stateCode: "RKE", stateName: "Rakhine", fromCity: "Yangon", toCity: "Kyaukpyu", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 176, stateCode: "RKE", stateName: "Rakhine", fromCity: "Yangon", toCity: "Min Pyar", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 177, stateCode: "RKE", stateName: "Rakhine", fromCity: "Yangon", toCity: "Ann", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 178, stateCode: "RKE", stateName: "Rakhine", fromCity: "Yangon", toCity: "Kyauktaw", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 179, stateCode: "RKE", stateName: "Rakhine", fromCity: "Yangon", toCity: "Mrauk-U", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 180, stateCode: "RKE", stateName: "Rakhine", fromCity: "Yangon", toCity: "Ramree", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 181, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Kalay", zone: "D", normalPrice: 6000, courierCost: 5400, nextKgRate: 1800 },
  { srNo: 182, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Monywa", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 183, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Sagaing", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 184, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Shwebo", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 185, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Tamu", zone: "D", normalPrice: 6000, courierCost: 5400, nextKgRate: 1800 },
  { srNo: 186, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Katha", zone: "D", normalPrice: 6000, courierCost: 5400, nextKgRate: 1800 },
  { srNo: 187, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Kawlin", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 188, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Tigyaing", zone: "D", normalPrice: 6000, courierCost: 5400, nextKgRate: 1800 },

  // --- Page 5: Sagaing (189–191), Shan (192–214), Tanintharyi (215–217), Yangon (218–227) ---
  { srNo: 189, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Myinmu", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 190, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Seikkhun", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 191, stateCode: "SGG", stateName: "Sagaing", fromCity: "Yangon", toCity: "Indaw", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 192, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Aungpan", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 193, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Kalaw", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 194, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Lashio", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 195, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Kyaukme", zone: "D", normalPrice: 6000, courierCost: 5400, nextKgRate: 1800 },
  { srNo: 196, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Hsipaw", zone: "D", normalPrice: 6000, courierCost: 5400, nextKgRate: 1800 },
  { srNo: 197, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Muse", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 198, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Taunggyi", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 199, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Yatsauk", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 200, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Pinlaung", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 201, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Kengtung", zone: "J", normalPrice: 10500, courierCost: 9450, nextKgRate: 2700 },
  { srNo: 202, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Tachileik", zone: "J", normalPrice: 10500, courierCost: 9450, nextKgRate: 2700 },
  { srNo: 203, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Nyaungshwe", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 204, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Ayetharyar", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 205, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Hopong", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 206, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Pindaya", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 207, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Loilem", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 208, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "HeHoe", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 209, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Ywangan", zone: "C", normalPrice: 5500, courierCost: 4950, nextKgRate: 1800 },
  { srNo: 210, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Namhkam", zone: "D", normalPrice: 6000, courierCost: 5400, nextKgRate: 1800 },
  { srNo: 211, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Namtu", zone: "D", normalPrice: 6000, courierCost: 5400, nextKgRate: 1800 },
  { srNo: 212, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Kutkai", zone: "D", normalPrice: 6000, courierCost: 5400, nextKgRate: 1800 },
  { srNo: 213, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Shwenyaung", zone: "B", normalPrice: 5000, courierCost: 4500, nextKgRate: 1800 },
  { srNo: 214, stateCode: "SHAN", stateName: "Shan", fromCity: "Yangon", toCity: "Nawnghkio", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 215, stateCode: "TNT", stateName: "Tanintharyi", fromCity: "Yangon", toCity: "Dawei", zone: "E", normalPrice: 7000, courierCost: 6300, nextKgRate: 2250 },
  { srNo: 216, stateCode: "TNT", stateName: "Tanintharyi", fromCity: "Yangon", toCity: "Myeik", zone: "F", normalPrice: 8000, courierCost: 7200, nextKgRate: 2250 },
  { srNo: 217, stateCode: "TNT", stateName: "Tanintharyi", fromCity: "Yangon", toCity: "Kawthoung", zone: "I", normalPrice: 10000, courierCost: 9000, nextKgRate: 2700 },
  { srNo: 218, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Yangon", zone: "0", normalPrice: 4000, courierCost: 3400, nextKgRate: 1700 },
  { srNo: 219, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Hlegu", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 220, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Thongwa", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 221, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Hmawbi", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 222, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Taikkyi", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 223, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Twantay", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 224, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Kyauktan", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 225, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Kungyangone", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 226, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Ahpyauk", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
  { srNo: 227, stateCode: "YGN", stateName: "Yangon", fromCity: "Yangon", toCity: "Kawhmu", zone: "A", normalPrice: 4500, courierCost: 4050, nextKgRate: 1800 },
];

export const STATE_DELIVERY_FEES: Record<string, number> = {
  Ayeyarwady: 5500,
  Bago: 5500,
  Chin: 9000,
  Kachin: 10000,
  Kayah: 7500,
  Kayin: 8000,
  Mandalay: 5500,
  Magway: 5500,
  Mon: 5500,
  Naypyidaw: 5000,
  Sagaing: 6000,
  Shan: 5500,
  Tanintharyi: 9000,
  Yangon: 4500,
};

export interface CheckoutCityOption {
  name: string;
  fee: number;
}

export const CHECKOUT_CITIES: CheckoutCityOption[] = [
  { name: "Ayyarwaddy", fee: 5500 },
  { name: "Bago", fee: 5500 },
  { name: "Chin", fee: 9000 },
  { name: "Kachin", fee: 10000 },
  { name: "Kayar", fee: 7500 },
  { name: "Kayin", fee: 8000 },
  { name: "Mandalay", fee: 5500 },
  { name: "Magway", fee: 5500 },
  { name: "Mon", fee: 5500 },
  { name: "Nay Pyi Taw", fee: 5000 },
  { name: "Sagaing", fee: 6000 },
  { name: "Shan", fee: 5500 },
  { name: "Tanintharyi", fee: 9000 },
  { name: "Yangon", fee: 4500 },
];

export function getStateDeliveryFee(stateOrCode?: string | null): number {
  if (!stateOrCode) return 4500;
  const clean = stateOrCode.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (clean === "aya" || clean.includes("ayeyarwady") || clean.includes("ayyarwaddy")) return 5500;
  if (clean === "bgo" || clean.includes("bago")) return 5500;
  if (clean === "chin") return 9000;
  if (clean === "kachin") return 10000;
  if (clean === "kayar" || clean.includes("kayah")) return 7500;
  if (clean === "kayin") return 8000;
  if (clean === "mdy" || clean.includes("mandalay")) return 5500;
  if (clean === "mgy" || clean.includes("magway")) return 5500;
  if (clean === "mon") return 5500;
  if (clean === "npw" || clean.includes("naypyi") || clean.includes("naypyitaw")) return 5000;
  if (clean === "sgg" || clean.includes("sagaing")) return 6000;
  if (clean === "shan") return 5500;
  if (clean === "tnt" || clean.includes("tanintharyi")) return 9000;
  if (clean === "ygn" || clean.includes("yangon")) return 4500;
  return STATE_DELIVERY_FEES[stateOrCode] ?? 5500;
}

export const SUSPENDED_DELIVERY_NOTICE =
  "ရခိုင်ပြည်နယ် နှင့် မြစ်ကြီးနား ၊ မြ၀တီ ၊ တာချီလိတ်၊ကျိုင်းတုံ၊ လားရှိုး၊ လွိုင်လင်    မြို့လေးတွေကိုတော့လမ်းခရီးအခက်အခဲများကြောင့်ပို့ဆောင်လို့မရနိုင်ပါ";

export const SUSPENDED_CITIES = new Set([
  "myitkyina",
  "myawaddy",
  "tachileik",
  "kengtung",
  "lashio",
  "loilem",
]);

export function isLocationSuspended(city?: string | null, state?: string | null): boolean {
  if (state) {
    const cleanState = state.trim().toLowerCase();
    if (cleanState === "rke" || cleanState.includes("rakhine")) {
      return true;
    }
  }
  if (city) {
    const cleanCity = city.trim().toLowerCase();
    if (SUSPENDED_CITIES.has(cleanCity)) {
      return true;
    }
    const baseCity = cleanCity.split("(")[0].trim();
    if (SUSPENDED_CITIES.has(baseCity)) {
      return true;
    }
    const dest = ROYAL_DESTINATIONS.find(
      (x) =>
        x.toCity.toLowerCase() === cleanCity ||
        `${x.toCity} (${x.stateName})`.toLowerCase() === cleanCity,
    );
    if (dest && (dest.stateCode === "RKE" || dest.stateName.toLowerCase() === "rakhine")) {
      return true;
    }
  }
  return false;
}

export function getDestinationsByState(): Record<string, ShippingDestinationItem[]> {
  const grouped: Record<string, ShippingDestinationItem[]> = {};
  for (const item of ROYAL_DESTINATIONS) {
    if (!grouped[item.stateName]) {
      grouped[item.stateName] = [];
    }
    grouped[item.stateName].push(item);
  }
  return grouped;
}

export const DESTINATIONS_BY_STATE: {
  stateName: string;
  stateCode: string;
  cities: ShippingDestinationItem[];
}[] = Object.entries(getDestinationsByState()).map(([stateName, cities]) => ({
  stateName,
  stateCode: cities[0]?.stateCode || "",
  cities,
}));

export const DELIVERABLE_DESTINATIONS_BY_STATE = DESTINATIONS_BY_STATE
  .filter((group) => group.stateCode !== "RKE" && group.stateName.toLowerCase() !== "rakhine")
  .map((group) => {
    const fee = getStateDeliveryFee(group.stateName);
    return {
      ...group,
      deliveryFee: fee,
      cities: group.cities
        .filter((c) => !SUSPENDED_CITIES.has(c.toCity.toLowerCase()))
        .map((c) => ({
          ...c,
          normalPrice: fee,
          customerRate: fee,
        })),
    };
  })
  .filter((group) => group.cities.length > 0);

export function findDestinationByCity(
  cityName: string,
): (ShippingDestinationItem & { customerRate: number }) | undefined {
  if (!cityName) return undefined;
  const clean = cityName.trim().toLowerCase();

  // 1. Direct match by toCity or toCity (stateName)
  const d = ROYAL_DESTINATIONS.find(
    (x) =>
      x.toCity.toLowerCase() === clean ||
      `${x.toCity} (${x.stateName})`.toLowerCase() === clean,
  );
  if (d) {
    const adminFee = getStateDeliveryFee(d.stateName);
    return { ...d, normalPrice: adminFee, customerRate: adminFee };
  }

  // 2. Match by State / Region name (e.g. from CHECKOUT_CITIES: "Ayyarwaddy", "Chin", "Shan", etc.)
  const matchedCheckout = CHECKOUT_CITIES.find(
    (c) =>
      c.name.toLowerCase() === clean ||
      c.name.toLowerCase().replace(/[\s_-]+/g, "") === clean.replace(/[\s_-]+/g, ""),
  );

  const matchedState = DESTINATIONS_BY_STATE.find((group) => {
    const sName = group.stateName.toLowerCase();
    const cleanNorm = clean.replace(/[\s_-]+/g, "");
    const sNorm = sName.replace(/[\s_-]+/g, "");
    return (
      clean === sName ||
      cleanNorm === sNorm ||
      (cleanNorm.includes("ayyarwaddy") && sNorm.includes("ayeyarwady")) ||
      (cleanNorm.includes("kayar") && sNorm.includes("kayah")) ||
      (cleanNorm.includes("naypyi") && sNorm.includes("naypyi"))
    );
  });

  if (matchedState && matchedState.cities.length > 0) {
    const rep = matchedState.cities[0];
    const adminFee = matchedCheckout ? matchedCheckout.fee : getStateDeliveryFee(matchedState.stateName);
    return {
      ...rep,
      toCity: cityName.trim(),
      stateName: matchedState.stateName,
      normalPrice: adminFee,
      customerRate: adminFee,
    };
  }

  return undefined;
}


