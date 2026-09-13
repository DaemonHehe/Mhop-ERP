import { describe, expect, it } from "vitest";
import {
  calculateRoyalDelivery,
  calculateRequiredDeposit,
  findDestinationByCity,
  getAllDestinations,
  getDestinationsByState,
  getStateDeliveryFee,
  isLocationSuspended,
  SUSPENDED_DELIVERY_NOTICE,
  SUSPENDED_CITIES,
  CHECKOUT_CITIES,
  DELIVERABLE_DESTINATIONS_BY_STATE,
} from "@/lib/shipping/royal-rates";
import { DESTINATIONS_BY_STATE } from "@/lib/shipping/destinations-data";
import {
  formatDepositRequestReceipt,
  formatCustomerReceipt,
  formatManagerOrderAlert,
} from "@/lib/services/receipt-summary";
import { evaluateWarrantyPolicy } from "@/lib/warranty-policy";
import { getErpSnapshot } from "@/lib/services/erp.service";
import {
  calculateSettlementAfterOrderDeletion,
  shouldRestoreOrderInventory,
} from "@/lib/services/order.service";
import { orderSchema } from "@/lib/validation/schemas";

describe("Deposit + COD Orders and Royal Express Settlement", () => {
  describe("Permanent order deletion accounting", () => {
    it("restores inventory only when it was not already restored by cancellation or return", () => {
      for (const status of ["new", "packing", "packed", "dispatched", "delivered"])
        expect(shouldRestoreOrderInventory(status)).toBe(true);
      expect(shouldRestoreOrderInventory("cancelled")).toBe(false);
      expect(shouldRestoreOrderInventory("returned")).toBe(false);
    });

    it("recalculates a Royal batch after its order allocation is removed", () => {
      const result = calculateSettlementAfterOrderDeletion(
        [
          { allocatedCollected: 245_000, allocatedCourierFee: 4_500 },
          { allocatedCollected: "120000", allocatedCourierFee: "4050" },
        ],
        356_450,
        0,
      );

      expect(result).toEqual({
        totalCollected: 365_000,
        totalCourierFees: 8_550,
        discrepancyAmount: 0,
      });
    });

    it("keeps transferred bank money visible as a discrepancy when no allocations remain", () => {
      expect(calculateSettlementAfterOrderDeletion([], 240_500, 0)).toEqual({
        totalCollected: 0,
        totalCourierFees: 0,
        discrepancyAmount: 240_500,
      });
    });
  });

  describe("Prompt Reference Financial Example", () => {
    it("matches the exact user specification for products, delivery, deposit, COD, courier deduction, and payout", () => {
      // Products: 250,000 MMK
      const productsSubtotal = 250_000;
      // Admin charges flat price for Mandalay region: 5,500 MMK
      // Royal base courier cost for Mandalay: 4,500 MMK
      const deliveryCalc = calculateRoyalDelivery({
        cityName: "Mandalay",
        packedWeightKg: 1.5,
        isDigitalOnly: false,
      });

      expect(deliveryCalc.customerDeliveryFee).toBe(5500);
      expect(deliveryCalc.expectedCourierCost).toBe(4500);

      // Order total: 250,000 + 5,500 = 255,500 MMK
      const orderTotal = productsSubtotal + deliveryCalc.customerDeliveryFee;
      expect(orderTotal).toBe(255_500);

      // Default required deposit: 5,000 MMK
      const requiredDeposit = calculateRequiredDeposit(orderTotal, false);
      expect(requiredDeposit).toBe(5_000);

      // Customer pays Royal on delivery (COD): 255,500 - 5,000 = 250,500 MMK
      const customerCodToRoyal = orderTotal - requiredDeposit;
      expect(customerCodToRoyal).toBe(250_500);

      // Expected Royal deduction: 4,500 MMK
      const expectedRoyalDeduction = deliveryCalc.expectedCourierCost;
      expect(expectedRoyalDeduction).toBe(4500);

      // Expected Royal transfer to shop: 250,500 - 4,500 = 246,000 MMK
      const expectedRoyalTransfer = customerCodToRoyal - expectedRoyalDeduction;
      expect(expectedRoyalTransfer).toBe(246_000);

      // Customer balance becomes zero once customer pays Royal, while Royal payout is an internal transfer
      const customerBalanceAfterCod = customerCodToRoyal - customerCodToRoyal;
      expect(customerBalanceAfterCod).toBe(0);
    });
  });

  describe("Flat Regional Delivery Rates Covering Royal Express", () => {
    it("charges the admin flat price for each state and region covering Royal cost", () => {
      expect(getStateDeliveryFee("Ayeyarwady")).toBe(5500);
      expect(getStateDeliveryFee("Bago")).toBe(5500);
      expect(getStateDeliveryFee("Chin")).toBe(9000);
      expect(getStateDeliveryFee("Kachin")).toBe(10000);
      expect(getStateDeliveryFee("Kayah")).toBe(7500);
      expect(getStateDeliveryFee("Kayar")).toBe(7500);
      expect(getStateDeliveryFee("Kayin")).toBe(8000);
      expect(getStateDeliveryFee("Mandalay")).toBe(5500);
      expect(getStateDeliveryFee("Magway")).toBe(5500);
      expect(getStateDeliveryFee("Mon")).toBe(5500);
      expect(getStateDeliveryFee("Nay Pyi Taw")).toBe(5000);
      expect(getStateDeliveryFee("Naypyidaw")).toBe(5000);
      expect(getStateDeliveryFee("Sagaing")).toBe(6000);
      expect(getStateDeliveryFee("Shan")).toBe(5500);
      expect(getStateDeliveryFee("Tanintharyi")).toBe(9000);
      expect(getStateDeliveryFee("Yangon")).toBe(4500);
    });

    it("verifies Yangon rates: admin charges 4,500 covering Royal cost of 3,400 / 4,050", () => {
      const yangonCity = calculateRoyalDelivery({ cityName: "Yangon" });
      expect(yangonCity.customerDeliveryFee).toBe(4500);
      expect(yangonCity.expectedCourierCost).toBe(3400);

      const hlegu = calculateRoyalDelivery({ cityName: "Hlegu" });
      expect(hlegu.customerDeliveryFee).toBe(4500);
      expect(hlegu.expectedCourierCost).toBe(4050);
    });

    it("drops weight calculations: flat rate applies regardless of weight", () => {
      const rate1kg = calculateRoyalDelivery({
        cityName: "Mandalay",
        packedWeightKg: 1.0,
      });
      expect(rate1kg.customerDeliveryFee).toBe(5500);
      expect(rate1kg.expectedCourierCost).toBe(4500);
      expect(rate1kg.nextKgRate).toBe(0);
      expect(rate1kg.additionalKg).toBe(0);

      const rate4kg = calculateRoyalDelivery({
        cityName: "Mandalay",
        packedWeightKg: 4.0,
      });
      expect(rate4kg.customerDeliveryFee).toBe(5500);
      expect(rate4kg.expectedCourierCost).toBe(4500);
      expect(rate4kg.additionalKg).toBe(0);

      const rate10kg = calculateRoyalDelivery({
        cityName: "Taunggyi",
        packedWeightKg: 10.0,
      });
      expect(rate10kg.customerDeliveryFee).toBe(5500);
      expect(rate10kg.expectedCourierCost).toBe(4500);
    });
  });

  describe("Suspended Delivery Routes & Customer Notice", () => {
    it("identifies all specified restricted locations as suspended", () => {
      // Entire Rakhine State
      expect(isLocationSuspended(null, "RKE")).toBe(true);
      expect(isLocationSuspended(null, "Rakhine")).toBe(true);
      expect(isLocationSuspended("Sittwe")).toBe(true);
      expect(isLocationSuspended("Kyaukpyu")).toBe(true);
      expect(isLocationSuspended("Thandwe")).toBe(true);

      // The 6 specific restricted cities
      expect(isLocationSuspended("Myitkyina")).toBe(true);
      expect(isLocationSuspended("Myawaddy")).toBe(true);
      expect(isLocationSuspended("Tachileik")).toBe(true);
      expect(isLocationSuspended("Kengtung")).toBe(true);
      expect(isLocationSuspended("Lashio")).toBe(true);
      expect(isLocationSuspended("Loilem")).toBe(true);

      // Normal accessible cities should not be suspended
      expect(isLocationSuspended("Yangon")).toBe(false);
      expect(isLocationSuspended("Mandalay")).toBe(false);
      expect(isLocationSuspended("Taunggyi")).toBe(false);
      expect(isLocationSuspended("Mawlamyine")).toBe(false);
      expect(isLocationSuspended("Pathein")).toBe(false);
    });

    it("verifies the exact Burmese warning notice string", () => {
      expect(SUSPENDED_DELIVERY_NOTICE).toContain("ရခိုင်ပြည်နယ်");
      expect(SUSPENDED_DELIVERY_NOTICE).toContain("မြစ်ကြီးနား");
      expect(SUSPENDED_DELIVERY_NOTICE).toContain("မြ၀တီ");
      expect(SUSPENDED_DELIVERY_NOTICE).toContain("တာချီလိတ်");
      expect(SUSPENDED_DELIVERY_NOTICE).toContain("ကျိုင်းတုံ");
      expect(SUSPENDED_DELIVERY_NOTICE).toContain("လားရှိုး");
      expect(SUSPENDED_DELIVERY_NOTICE).toContain("လွိုင်လင်");
      expect(SUSPENDED_DELIVERY_NOTICE).toContain("လမ်းခရီးအခက်အခဲများကြောင့်ပို့ဆောင်လို့မရနိုင်ပါ");
    });

    it("filters out suspended cities and Rakhine from DELIVERABLE_DESTINATIONS_BY_STATE", () => {
      const states = DELIVERABLE_DESTINATIONS_BY_STATE.map((g) => g.stateCode);
      expect(states).not.toContain("RKE");

      const allDeliverableCities = DELIVERABLE_DESTINATIONS_BY_STATE.flatMap((g) =>
        g.cities.map((c) => c.toCity.toLowerCase()),
      );

      for (const city of SUSPENDED_CITIES) {
        expect(allDeliverableCities).not.toContain(city);
      }
    });
  });

  describe("Destinations Catalog & Regional Grouping", () => {
    it("contains all 227 destinations grouped across 15 states and regions", () => {
      const allDestinations = getAllDestinations();
      expect(allDestinations.length).toBe(227);

      const statesMap = getDestinationsByState();
      const stateKeys = Object.keys(statesMap);
      expect(stateKeys.length).toBe(15);
      expect(DESTINATIONS_BY_STATE.length).toBe(15);
    });

    it("correctly looks up destination cities case-insensitively and returns flat admin rates", () => {
      const mawlamyine = findDestinationByCity("Mawlamyine");
      expect(mawlamyine).toBeDefined();
      expect(mawlamyine?.customerRate).toBe(5500);
      expect(mawlamyine?.courierCost).toBe(4050);

      const taunggyi = findDestinationByCity("taunggyi");
      expect(taunggyi).toBeDefined();
      expect(taunggyi?.customerRate).toBe(5500);
      expect(taunggyi?.courierCost).toBe(4500);
    });

    it("handles unlisted destinations by requiring custom manual admin quotes", () => {
      const unlisted = calculateRoyalDelivery({
        cityName: "Unknown Remote Village",
        packedWeightKg: 1.0,
        isDigitalOnly: false,
      });
      expect(unlisted.isCustomQuoteRequired).toBe(true);
      expect(unlisted.customerDeliveryFee).toBe(0);

      const customQuoted = calculateRoyalDelivery({
        cityName: "Unknown Remote Village",
        packedWeightKg: 1.0,
        customDeliveryFee: 7000,
        customCourierCost: 6500,
        isDigitalOnly: false,
      });
      expect(customQuoted.customerDeliveryFee).toBe(7000);
      expect(customQuoted.expectedCourierCost).toBe(6500);
      expect(customQuoted.isCustomQuoteRequired).toBe(false);
    });
  });

  describe("Required Deposit Calculation Rules", () => {
    it("defaults physical gadgets to 5,000 MMK deposit", () => {
      const deposit = calculateRequiredDeposit(255_000, false);
      expect(deposit).toBe(5_000);
    });

    it("caps deposit at order total if order is under 5,000 MMK", () => {
      const deposit = calculateRequiredDeposit(3_500, false);
      expect(deposit).toBe(3_500);
    });

    it("requires 100% prepayment for digital products (PUBG accounts)", () => {
      const deposit = calculateRequiredDeposit(450_000, true);
      expect(deposit).toBe(450_000);
    });

    it("allows admin custom deposit override without violating cap", () => {
      const custom15k = calculateRequiredDeposit(255_000, false, 15_000);
      expect(custom15k).toBe(15_000);

      const customOverTotal = calculateRequiredDeposit(50_000, false, 90_000);
      expect(customOverTotal).toBe(50_000);
    });
  });

  describe("Receipts & Customer Communication Breakdown", () => {
    it("keeps the first receipt focused on the deposit and defers COD until approval", () => {
      const receiptText = formatDepositRequestReceipt({
        orderCode: "MHOP-260912-DPST",
        customerName: "Aung Aung",
        phone: "09791112222",
        shippingAddress: "No. 45, Strand Road",
        shippingFee: 5000,
        totalAmount: 255000,
        subtotal: 250000,
        requiredDeposit: 10000,
        codAmount: 245000,
        paymentMethod: "kbzpay",
        items: [
          {
            name: "Black Shark Cooler",
            quantity: 1,
            unitPrice: 250000,
          },
        ],
      });

      expect(receiptText).toContain("စရန်ငွေတောင်းခံလွှာ");
      expect(receiptText).toContain("255,000 MMK");
      expect(receiptText).toContain("10,000 MMK");
      expect(receiptText).not.toContain("245,000 MMK");
      expect(receiptText).toContain("အဓိကပြေစာ");
    });

    it("generates deposit confirmation receipt when deposit is pending or verified", () => {
      const receiptText = formatCustomerReceipt({
        orderCode: "MHOP-260908-EX01",
        customerName: "Aung Aung",
        phone: "09791112222",
        shippingAddress: "No. 45, Strand Road",
        shippingFee: 5000,
        totalAmount: 255000,
        subtotal: 250000,
        requiredDeposit: 10000,
        codAmount: 245000,
        destinationCity: "Mawlamyine",
        destinationState: "Mon",
        customerPaymentStatus: "deposit_verified",
        paymentMethod: "kbzpay",
        items: [
          { name: "Black Shark Cooler", quantity: 1, unitPrice: 250000, sku: "BS-01" },
        ],
      });

      expect(receiptText).toContain("စရန်ငွေပြေစာ (Deposit Confirmation)");
      expect(receiptText).toContain("250,000 MMK");
      expect(receiptText).toContain("5,000 MMK");
      expect(receiptText).toContain("255,000 MMK");
      expect(receiptText).toContain("10,000 MMK");
      expect(receiptText).toContain("245,000 MMK");
      expect(receiptText).toContain("စရန်ငွေ 10,000 MMK လက်ခံအတည်ပြုပြီးပါပြီခင်ဗျာ");
      expect(receiptText).toContain("COD (ပစ္စည်းရောက်မှ ပေးချေရန်)");
    });

    it("generates final paid receipt when Royal Express COD is collected", () => {
      const receiptText = formatCustomerReceipt({
        orderCode: "MHOP-260908-EX01",
        customerName: "Aung Aung",
        phone: "09791112222",
        shippingAddress: "No. 45, Strand Road",
        shippingFee: 5000,
        totalAmount: 255000,
        subtotal: 250000,
        requiredDeposit: 10000,
        codAmount: 245000,
        destinationCity: "Mawlamyine",
        customerPaymentStatus: "cod_collected",
        paymentMethod: "kbzpay",
        items: [
          { name: "Black Shark Cooler", quantity: 1, unitPrice: 250000, sku: "BS-01" },
        ],
      });

      expect(receiptText).toContain("အရောင်းပြေစာ (Paid Receipt)");
      expect(receiptText).toContain("ပေးချေပြီးငွေ (Paid in Full): 255,000 MMK");
      expect(receiptText).toContain("ကျန်ရှိငွေ (Balance Due): <b>0 MMK</b>");
    });

    it("generates manager alert with destination and Royal payout expectations", () => {
      const alertText = formatManagerOrderAlert({
        orderCode: "MHOP-260908-EX01",
        customerName: "Aung Aung",
        phone: "09791112222",
        shippingAddress: "No. 45, Strand Road",
        shippingFee: 5000,
        totalAmount: 255000,
        subtotal: 250000,
        requiredDeposit: 10000,
        codAmount: 245000,
        destinationCity: "Mawlamyine",
        destinationState: "Mon",
        expectedCourierCost: 4500,
        paymentMethod: "kbzpay",
        items: [
          { name: "Black Shark Cooler", quantity: 1, unitPrice: 250000, sku: "BS-01" },
        ],
      });

      expect(alertText).toContain("Mawlamyine");
      expect(alertText).toContain("(Mon)");
      expect(alertText).toContain("Required Deposit: <b>10,000 MMK</b>");
      expect(alertText).toContain("COD to collect on delivery: <b>245,000 MMK</b>");
    });
  });

  describe("Warranty Policy Downstream Integration", () => {
    it("activates warranty only upon delivery after COD is collected", () => {
      const deliveredDate = new Date("2026-09-08T10:00:00Z");

      // While in transit (even if deposit verified), warranty is pending delivery
      const pendingFulfillment = evaluateWarrantyPolicy({
        paymentStatus: "deposit_verified",
        fulfillmentStatus: "dispatched",
        deliveredAt: null,
        orderCreatedAt: new Date("2026-09-01T10:00:00Z"),
        warrantyMonths: 6,
      });
      expect(pendingFulfillment.eligible).toBe(false);

      // Once delivered and COD is collected, warranty activates
      const activePolicy = evaluateWarrantyPolicy({
        paymentStatus: "cod_collected",
        fulfillmentStatus: "delivered",
        deliveredAt: deliveredDate,
        orderCreatedAt: new Date("2026-09-01T10:00:00Z"),
        warrantyMonths: 6,
        now: new Date("2026-09-15T10:00:00Z"),
      });
      expect(activePolicy.eligible).toBe(true);
      expect(activePolicy.status).toBe("Active");
    });
  });

  describe("ERP & Finance Royal COD Tracking", () => {
    it("calculates expected Royal COD payment as COD amount minus courier cost", async () => {
      const snapshot = await getErpSnapshot();
      expect(snapshot.expectedRoyalPayment).toBe(
        Math.max(0, snapshot.expectedRoyalCod - snapshot.expectedRoyalCourierCost),
      );
      expect(snapshot.expectedRoyalPayment).toBeGreaterThan(0);
      expect(snapshot.unsettledRoyalOrdersCount).toBeGreaterThan(0);
    });
  });

  describe("Checkout Cities Flat Rates", () => {
    it("provides exactly the 14 regional checkout cities specified by the user", () => {
      expect(CHECKOUT_CITIES).toHaveLength(14);
      const cityMap = Object.fromEntries(CHECKOUT_CITIES.map((c) => [c.name, c.fee]));

      expect(cityMap["Ayyarwaddy"]).toBe(5500);
      expect(cityMap["Bago"]).toBe(5500);
      expect(cityMap["Chin"]).toBe(9000);
      expect(cityMap["Kachin"]).toBe(10000);
      expect(cityMap["Kayar"]).toBe(7500);
      expect(cityMap["Kayin"]).toBe(8000);
      expect(cityMap["Mandalay"]).toBe(5500);
      expect(cityMap["Magway"]).toBe(5500);
      expect(cityMap["Mon"]).toBe(5500);
      expect(cityMap["Nay Pyi Taw"]).toBe(5000);
      expect(cityMap["Sagaing"]).toBe(6000);
      expect(cityMap["Shan"]).toBe(5500);
      expect(cityMap["Tanintharyi"]).toBe(9000);
      expect(cityMap["Yangon"]).toBe(4500);
    });

    it("resolves delivery fee and courier cost accurately for all 14 checkout cities", () => {
      for (const { name, fee } of CHECKOUT_CITIES) {
        const quote = calculateRoyalDelivery({ destinationCity: name });
        expect(quote.customerDeliveryFee).toBe(fee);
        expect(quote.expectedCourierCost).toBeGreaterThan(0);
        expect(quote.destinationCity).toBe(name);
      }
    });
  });

  describe("Checkout Payment Methods: COD vs Full-Prepaid", () => {
    it("validates COD and Full-Prepaid as valid payment methods in orderSchema", () => {
      const codResult = orderSchema.safeParse({
        customerName: "Kyaw Kyaw",
        phone: "0912345678",
        shippingAddress: "No. 123 Bogyoke St",
        destinationCity: "Yangon",
        paymentMethod: "COD",
        items: [{ productId: "p1", quantity: 1 }],
      });
      expect(codResult.success).toBe(true);

      const prepaidResult = orderSchema.safeParse({
        customerName: "Kyaw Kyaw",
        phone: "0912345678",
        shippingAddress: "No. 123 Bogyoke St",
        destinationCity: "Yangon",
        paymentMethod: "Full-Prepaid",
        items: [{ productId: "p1", quantity: 1 }],
      });
      expect(prepaidResult.success).toBe(true);
    });

    it("calculates 5,000 MMK deposit for COD and sets remaining balance as COD amount", () => {
      const orderTotal = 65000;
      const isDigitalOnly = false;
      const paymentMethod: string = "COD";

      const isFullPrepaid = paymentMethod === "Full-Prepaid" || isDigitalOnly;
      const requiredDeposit = isFullPrepaid
        ? orderTotal
        : calculateRequiredDeposit(orderTotal, isDigitalOnly);
      const codAmount = Math.max(0, orderTotal - requiredDeposit);

      expect(requiredDeposit).toBe(5000);
      expect(codAmount).toBe(60000);
    });

    it("calculates 100% full prepayment and zero COD for Full-Prepaid physical orders", () => {
      const orderTotal = 65000;
      const isDigitalOnly = false;
      const paymentMethod: string = "Full-Prepaid";

      const isFullPrepaid = paymentMethod === "Full-Prepaid" || isDigitalOnly;
      const requiredDeposit = isFullPrepaid
        ? orderTotal
        : calculateRequiredDeposit(orderTotal, isDigitalOnly);
      const codAmount = Math.max(0, orderTotal - requiredDeposit);

      expect(requiredDeposit).toBe(65000);
      expect(codAmount).toBe(0);
    });

    it("enforces 100% full prepayment for digital items even if COD is selected", () => {
      const orderTotal = 150000;
      const isDigitalOnly = true;
      const paymentMethod: string = "COD";

      const isFullPrepaid = paymentMethod === "Full-Prepaid" || isDigitalOnly;
      const requiredDeposit = isFullPrepaid
        ? orderTotal
        : calculateRequiredDeposit(orderTotal, isDigitalOnly);
      const codAmount = Math.max(0, orderTotal - requiredDeposit);

      expect(requiredDeposit).toBe(150000);
      expect(codAmount).toBe(0);
    });
  });
});

