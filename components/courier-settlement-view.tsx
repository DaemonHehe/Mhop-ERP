"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Coins,
  History,
  MapPin,
  Plus,
  Search,
  Truck,
  X,
} from "lucide-react";
import { formatMMK } from "@/lib/data";
import type {
  SettlementBatchItem,
  UnsettledOrderItem,
} from "@/lib/services/settlement.service";
import {
  createSettlementBatchAction,
  reverseSettlementBatchAction,
} from "@/app/actions/store";

interface CourierSettlementViewProps {
  unsettledOrders: UnsettledOrderItem[];
  settlementBatches: SettlementBatchItem[];
}

interface AllocationRow {
  orderId: string;
  orderCode: string;
  customerName: string;
  destinationCity: string | null;
  expectedCod: number;
  expectedCourierFee: number;
  allocatedCollected: number;
  allocatedCourierFee: number;
}

const BANK_ACCOUNTS = [
  { value: "KBZ Bank - 0123456789012 (Ko Ko Kyaw)", label: "KBZ Bank - 0123456789012 (Ko Ko Kyaw)" },
  { value: "KBZPay Merchant - 09798888123 (Ko Ko Kyaw)", label: "KBZPay Merchant - 09798888123 (Ko Ko Kyaw)" },
  { value: "CB Bank - 0021-xxxx-xxxx", label: "CB Bank (Company Account)" },
  { value: "AYA Bank - 2000-xxxx-xxxx", label: "AYA Bank" },
  { value: "WavePay - 09798888123", label: "WavePay Merchant" },
  { value: "Cash at Yangon Counter", label: "Cash (Office / Counter)" },
] as const;

export function CourierSettlementView({
  unsettledOrders,
  settlementBatches,
}: CourierSettlementViewProps) {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [batchToReverse, setBatchToReverse] = useState<SettlementBatchItem | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Create Batch Form States
  const [bankAccount, setBankAccount] = useState<string>(BANK_ACCOUNTS[0].value);
  const [customBankAccount, setCustomBankAccount] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [settlementDate, setSettlementDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [bankReceivedAmount, setBankReceivedAmount] = useState<string>("");
  const [otherFees, setOtherFees] = useState<string>("0");
  const [notes, setNotes] = useState("");
  const [allocationRows, setAllocationRows] = useState<AllocationRow[]>([]);

  // High-level summary metrics
  const metrics = useMemo(() => {
    const totalPendingCod = unsettledOrders.reduce((sum, o) => sum + o.codAmount, 0);
    const totalPendingCourierCost = unsettledOrders.reduce(
      (sum, o) => sum + o.expectedCourierCost,
      0,
    );
    const totalSettledRevenue = settlementBatches
      .filter((b) => b.status === "completed" || b.status === "discrepancy")
      .reduce((sum, b) => sum + b.bankReceivedAmount, 0);
    const totalBatchesCount = settlementBatches.length;
    const totalDiscrepancy = settlementBatches
      .filter((b) => b.status === "completed" || b.status === "discrepancy")
      .reduce((sum, b) => sum + Math.abs(b.discrepancyAmount), 0);

    return {
      unsettledCount: unsettledOrders.length,
      totalPendingCod,
      totalPendingCourierCost,
      expectedNetPayout: totalPendingCod - totalPendingCourierCost,
      totalSettledRevenue,
      totalBatchesCount,
      totalDiscrepancy,
    };
  }, [unsettledOrders, settlementBatches]);

  // Filtered unsettled orders
  const filteredUnsettled = useMemo(() => {
    if (!searchQuery.trim()) return unsettledOrders;
    const q = searchQuery.toLowerCase().trim();
    return unsettledOrders.filter(
      (o) =>
        o.orderCode.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q)) ||
        (o.destinationCity && o.destinationCity.toLowerCase().includes(q)) ||
        o.phone.includes(q),
    );
  }, [unsettledOrders, searchQuery]);

  // Handle Select All / Deselect All
  const handleToggleSelectAll = () => {
    if (selectedOrderIds.size === filteredUnsettled.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredUnsettled.map((o) => o.id)));
    }
  };

  const handleToggleSelectOrder = (id: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Open Create Batch Modal with selected orders initialized
  const handleOpenCreateModal = () => {
    const selected = unsettledOrders.filter((o) => selectedOrderIds.has(o.id));
    if (selected.length === 0) {
      setNotice({ kind: "error", text: "Please select at least one order to settle." });
      return;
    }

    const rows: AllocationRow[] = selected.map((o) => ({
      orderId: o.id,
      orderCode: o.orderCode,
      customerName: o.customerName,
      destinationCity: o.destinationCity,
      expectedCod: o.codAmount,
      expectedCourierFee: o.expectedCourierCost,
      allocatedCollected: o.codAmount,
      allocatedCourierFee: o.expectedCourierCost,
    }));

    const sumCod = rows.reduce((s, r) => s + r.allocatedCollected, 0);
    const sumFees = rows.reduce((s, r) => s + r.allocatedCourierFee, 0);
    const expectedNet = sumCod - sumFees;

    setAllocationRows(rows);
    setBankReceivedAmount(String(expectedNet));
    setOtherFees("0");
    setTransferReference(`REX-TRF-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}`);
    setNotice(null);
    setIsCreateModalOpen(true);
  };

  // Live Batch Calculation inside modal
  const batchCalculation = useMemo(() => {
    const totalCollected = allocationRows.reduce((sum, r) => sum + (Number(r.allocatedCollected) || 0), 0);
    const totalCourierFees = allocationRows.reduce((sum, r) => sum + (Number(r.allocatedCourierFee) || 0), 0);
    const fees = Number(otherFees) || 0;
    const calculatedNet = totalCollected - totalCourierFees - fees;
    const received = Number(bankReceivedAmount) || 0;
    const discrepancy = received - calculatedNet;

    return {
      totalCollected,
      totalCourierFees,
      otherFees: fees,
      calculatedNet,
      bankReceived: received,
      discrepancy,
      isExactMatch: Math.abs(discrepancy) < 0.01,
    };
  }, [allocationRows, otherFees, bankReceivedAmount]);

  // Update per-row allocation override
  const handleUpdateAllocation = (
    orderId: string,
    field: "allocatedCollected" | "allocatedCourierFee",
    val: number,
  ) => {
    setAllocationRows((prev) =>
      prev.map((r) => (r.orderId === orderId ? { ...r, [field]: val } : r)),
    );
  };

  // Submit Settlement Batch
  const handleSubmitBatch = () => {
    if (!transferReference.trim()) {
      setNotice({ kind: "error", text: "Bank transfer reference / slip number is required." });
      return;
    }
    const finalBankAccount = bankAccount === "Other" ? customBankAccount.trim() : bankAccount;
    if (!finalBankAccount) {
      setNotice({ kind: "error", text: "Bank account is required." });
      return;
    }

    startTransition(async () => {
      setNotice(null);
      const res = await createSettlementBatchAction({
        courierName: "Royal Express",
        bankAccount: finalBankAccount,
        transferReference: transferReference.trim(),
        settlementDate: new Date(settlementDate),
        bankReceivedAmount: Number(bankReceivedAmount) || 0,
        otherFees: Number(otherFees) || 0,
        notes: notes.trim() || undefined,
        allocations: allocationRows.map((r) => ({
          orderId: r.orderId,
          allocatedCollected: Number(r.allocatedCollected) || 0,
          allocatedCourierFee: Number(r.allocatedCourierFee) || 0,
        })),
      });

      if (!res.ok) {
        setNotice({ kind: "error", text: res.error || "Failed to record settlement batch." });
      } else {
        setNotice({
          kind: "success",
          text: `Settlement batch ${res.data?.batchCode || "record"} successfully recorded! Funds allocated and customer/shop ledgers updated.`,
        });
        setIsCreateModalOpen(false);
        setSelectedOrderIds(new Set());
        setActiveTab("history");
      }
    });
  };

  // Handle Reverse Batch
  const handleConfirmReverse = () => {
    if (!batchToReverse) return;
    if (!reverseReason.trim()) {
      setNotice({ kind: "error", text: "Reversal reason is required." });
      return;
    }

    startTransition(async () => {
      setNotice(null);
      const res = await reverseSettlementBatchAction(batchToReverse.id, reverseReason.trim());
      if (!res.ok) {
        setNotice({ kind: "error", text: res.error || "Failed to reverse settlement batch." });
      } else {
        setNotice({
          kind: "success",
          text: `Batch ${batchToReverse.batchCode} reversed. Orders returned to unsettled status.`,
        });
        setIsReverseModalOpen(false);
        setBatchToReverse(null);
        setReverseReason("");
      }
    });
  };

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          className={`flex items-start justify-between rounded-xl border p-4 text-sm font-semibold ${
            notice.kind === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : "border-rose-300 bg-rose-50 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.kind === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="eyebrow flex items-center gap-1.5 text-[#77776f]">
            <Truck size={14} /> Pending in Field (Royal)
          </p>
          <p className="display mt-1 text-2xl font-black text-black">
            {formatMMK(metrics.totalPendingCod)}
          </p>
          <p className="mt-1 text-xs text-[#77776f]">
            {metrics.unsettledCount} orders awaiting courier payout
          </p>
        </div>

        <div className="card p-4">
          <p className="eyebrow flex items-center gap-1.5 text-[#77776f]">
            <Coins size={14} /> Expected Net Payout
          </p>
          <p className="display mt-1 text-2xl font-black text-emerald-700">
            {formatMMK(metrics.expectedNetPayout)}
          </p>
          <p className="mt-1 text-xs text-[#77776f]">
            After Royal deductions ({formatMMK(metrics.totalPendingCourierCost)})
          </p>
        </div>

        <div className="card p-4">
          <p className="eyebrow flex items-center gap-1.5 text-[#77776f]">
            <Building2 size={14} /> Total Settled Revenue
          </p>
          <p className="display mt-1 text-2xl font-black text-black">
            {formatMMK(metrics.totalSettledRevenue)}
          </p>
          <p className="mt-1 text-xs text-[#77776f]">
            Across {metrics.totalBatchesCount} completed payout batches
          </p>
        </div>

        <div className="card p-4">
          <p className="eyebrow flex items-center gap-1.5 text-[#77776f]">
            <AlertCircle size={14} /> Discrepancies
          </p>
          <p
            className={`display mt-1 text-2xl font-black ${
              metrics.totalDiscrepancy > 0 ? "text-amber-700" : "text-neutral-700"
            }`}
          >
            {formatMMK(metrics.totalDiscrepancy)}
          </p>
          <p className="mt-1 text-xs text-[#77776f]">
            {metrics.totalDiscrepancy > 0 ? "Cumulative batch variations" : "All batches balanced"}
          </p>
        </div>
      </div>

      {/* Tabs & Controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Navigation Segments */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === "pending"
                  ? "bg-black text-white shadow-xs"
                  : "border border-[#dedbd0] bg-white text-[#626258] hover:border-black"
              }`}
            >
              <Truck size={14} />
              <span>Pending Settlements</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === "pending" ? "bg-white/20" : "bg-[#f1efe8]"
                }`}
              >
                {unsettledOrders.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === "history"
                  ? "bg-black text-white shadow-xs"
                  : "border border-[#dedbd0] bg-white text-[#626258] hover:border-black"
              }`}
            >
              <History size={14} />
              <span>Settlement Batches History</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  activeTab === "history" ? "bg-white/20" : "bg-[#f1efe8]"
                }`}
              >
                {settlementBatches.length}
              </span>
            </button>
          </div>

          {/* Action on Pending Tab: Create Batch Button */}
          {activeTab === "pending" && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[#77776f]">
                {selectedOrderIds.size} selected
              </span>
              <button
                type="button"
                disabled={selectedOrderIds.size === 0 || pending}
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 rounded-xl bg-[#c7f36b] px-4 py-2 text-xs font-bold text-black transition hover:bg-[#b8e55e] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Plus size={14} /> Record Royal Settlement ({selectedOrderIds.size})
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Pending Settlements Table */}
        {activeTab === "pending" && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search size={14} className="absolute left-3 top-3 text-[#999]" />
                <input
                  type="text"
                  placeholder="Search by order code, customer, city, or tracking..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-xl border border-[#dedbd0] bg-white pl-9 pr-3 text-xs outline-none focus:border-black"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSelectAll}
                  className="rounded-lg border border-[#dedbd0] bg-[#faf9f5] px-3 py-1.5 text-xs font-bold text-[#444] transition hover:bg-[#eae7dd]"
                >
                  {selectedOrderIds.size === filteredUnsettled.length && filteredUnsettled.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#dedbd0]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#f5f4ee] font-extrabold uppercase text-[#77776f]">
                  <tr>
                    <th className="w-10 px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={
                          selectedOrderIds.size === filteredUnsettled.length &&
                          filteredUnsettled.length > 0
                        }
                        onChange={handleToggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-3 py-3">Order</th>
                    <th className="px-3 py-3">Customer</th>
                    <th className="px-3 py-3">Destination</th>
                    <th className="px-3 py-3">Tracking</th>
                    <th className="px-3 py-3 text-right">COD Amount</th>
                    <th className="px-3 py-3 text-right">Royal Fee</th>
                    <th className="px-3 py-3 text-right">Net Payout</th>
                    <th className="px-3 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eee]">
                  {filteredUnsettled.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-sm text-[#77776f]">
                        No pending unsettled orders found.
                      </td>
                    </tr>
                  ) : (
                    filteredUnsettled.map((order) => {
                      const isSelected = selectedOrderIds.has(order.id);
                      const netPayout = order.codAmount - order.expectedCourierCost;
                      return (
                        <tr
                          key={order.id}
                          className={`transition ${
                            isSelected ? "bg-sky-50/50" : "hover:bg-[#fafaf7]"
                          }`}
                        >
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectOrder(order.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <Link
                              href={`/orders/${order.id}`}
                              className="font-mono font-bold text-black hover:underline"
                            >
                              {order.orderCode}
                            </Link>
                            <p className="text-[10px] text-[#77776f]">
                              {new Date(order.createdAt).toLocaleDateString("en-GB", {
                                timeZone: "Asia/Yangon",
                              })}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-black">{order.customerName}</p>
                            <p className="text-[10px] text-[#77776f]">{order.phone}</p>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-1 rounded bg-[#f0eee6] px-2 py-0.5 text-[11px] font-medium text-[#55534c]">
                              <MapPin size={10} /> {order.destinationCity || "Yangon"}
                            </span>
                            {order.destinationState && (
                              <span className="block text-[10px] text-[#77776f]">
                                {order.destinationState}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {order.trackingNumber ? (
                              <span className="font-mono font-bold text-emerald-800">
                                {order.trackingNumber}
                              </span>
                            ) : (
                              <span className="italic text-[#999]">No tracking</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-bold text-sky-900">
                            {formatMMK(order.codAmount)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono text-neutral-600">
                            {formatMMK(order.expectedCourierCost)}
                          </td>
                          <td className="px-3 py-3 text-right font-mono font-extrabold text-emerald-700">
                            {formatMMK(netPayout)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                order.customerPaymentStatus === "cod_collected"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              {order.customerPaymentStatus === "cod_collected"
                                ? "COD Paid"
                                : order.fulfillmentStatus}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Settlement Batches History */}
        {activeTab === "history" && (
          <div className="mt-5 overflow-x-auto rounded-xl border border-[#dedbd0]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#f5f4ee] font-extrabold uppercase text-[#77776f]">
                <tr>
                  <th className="px-3 py-3">Batch Code</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="px-3 py-3">Bank & Reference</th>
                  <th className="px-3 py-3 text-center">Orders</th>
                  <th className="px-3 py-3 text-right">Total COD</th>
                  <th className="px-3 py-3 text-right">Royal Fees</th>
                  <th className="px-3 py-3 text-right">Bank Received</th>
                  <th className="px-3 py-3 text-center">Discrepancy</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee]">
                {settlementBatches.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-sm text-[#77776f]">
                      No settlement batches recorded yet.
                    </td>
                  </tr>
                ) : (
                  settlementBatches.map((batch) => {
                    const hasDiscrepancy = Math.abs(batch.discrepancyAmount) > 0.01;
                    const isReversed = batch.status === "reversed";
                    return (
                      <tr key={batch.id} className="hover:bg-[#fafaf7]">
                        <td className="px-3 py-3 font-mono font-bold text-black">
                          {batch.batchCode}
                        </td>
                        <td className="px-3 py-3 text-[#555]">
                          {new Date(batch.settlementDate).toLocaleDateString("en-GB", {
                            timeZone: "Asia/Yangon",
                          })}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-black">{batch.bankAccount}</p>
                          <p className="font-mono text-[10px] text-[#77776f]">
                            Ref: {batch.transferReference}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-center font-bold">
                          {batch.orderCount ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-bold text-black">
                          {formatMMK(batch.totalCollected)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-neutral-600">
                          {formatMMK(batch.totalCourierFees)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono font-extrabold text-emerald-800">
                          {formatMMK(batch.bankReceivedAmount)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {hasDiscrepancy ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-900">
                              <AlertCircle size={10} />
                              {batch.discrepancyAmount > 0 ? "+" : ""}
                              {formatMMK(batch.discrepancyAmount)}
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-emerald-700">0 MMK</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isReversed
                                ? "bg-rose-100 text-rose-800"
                                : hasDiscrepancy
                                ? "bg-amber-100 text-amber-900"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {batch.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {!isReversed && (
                            <button
                              type="button"
                              onClick={() => {
                                setBatchToReverse(batch);
                                setReverseReason("");
                                setIsReverseModalOpen(true);
                              }}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 transition hover:bg-rose-100"
                            >
                              Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Record Royal Settlement Batch */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[#dedbd0] bg-white text-black shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b bg-[#171813] px-6 py-4 text-white">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                  Royal Express Payout Settlement
                </p>
                <h3 className="display text-lg font-bold">
                  Record Courier Payout Batch ({allocationRows.length} orders)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 space-y-5 overflow-y-auto p-6 text-xs">
              {/* Bank and Payment Info */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[#444]">
                    Receiving Bank Account
                  </label>
                  <select
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-[#dedbd0] bg-white px-3 text-xs font-semibold outline-none focus:border-black"
                  >
                    {BANK_ACCOUNTS.map((acc) => (
                      <option key={acc.value} value={acc.value}>
                        {acc.label}
                      </option>
                    ))}
                    <option value="Other">Other Bank Account...</option>
                  </select>
                  {bankAccount === "Other" && (
                    <input
                      type="text"
                      placeholder="Enter custom bank name and account"
                      value={customBankAccount}
                      onChange={(e) => setCustomBankAccount(e.target.value)}
                      className="mt-2 h-10 w-full rounded-xl border border-[#dedbd0] px-3 text-xs outline-none focus:border-black"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#444]">
                    Bank Transfer Reference / Slip No.
                  </label>
                  <input
                    type="text"
                    value={transferReference}
                    onChange={(e) => setTransferReference(e.target.value)}
                    placeholder="e.g. REX-TRF-260908-01"
                    className="mt-1 h-10 w-full rounded-xl border border-[#dedbd0] px-3 text-xs font-mono font-bold outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#444]">
                    Settlement Date
                  </label>
                  <input
                    type="date"
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-xl border border-[#dedbd0] px-3 text-xs font-semibold outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#444]">
                    Actual Bank Received Amount (MMK)
                  </label>
                  <input
                    type="number"
                    value={bankReceivedAmount}
                    onChange={(e) => setBankReceivedAmount(e.target.value)}
                    placeholder="e.g. 240500"
                    className="mt-1 h-10 w-full rounded-xl border border-[#dedbd0] px-3 font-mono text-sm font-black text-emerald-900 outline-none focus:border-black"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#444]">
                    Other Royal Deductions / Fees (Optional)
                  </label>
                  <input
                    type="number"
                    value={otherFees}
                    onChange={(e) => setOtherFees(e.target.value)}
                    placeholder="0"
                    className="mt-1 h-10 w-full rounded-xl border border-[#dedbd0] px-3 font-mono text-xs outline-none focus:border-black"
                  />
                </div>
              </div>

              {/* Order Allocations Breakdown Table */}
              <div>
                <p className="eyebrow text-[#77776f]">Allocations Breakdown</p>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-[#dedbd0]">
                  <table className="w-full text-left text-[11px]">
                    <thead className="sticky top-0 bg-[#f5f4ee] font-extrabold uppercase text-[#77776f]">
                      <tr>
                        <th className="px-3 py-2">Order</th>
                        <th className="px-3 py-2">Customer & City</th>
                        <th className="px-3 py-2 text-right">Collected COD</th>
                        <th className="px-3 py-2 text-right">Royal Fee</th>
                        <th className="px-3 py-2 text-right">Net Payout</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eee]">
                      {allocationRows.map((row) => {
                        const net =
                          (Number(row.allocatedCollected) || 0) -
                          (Number(row.allocatedCourierFee) || 0);
                        return (
                          <tr key={row.orderId} className="hover:bg-[#fafaf7]">
                            <td className="px-3 py-2 font-mono font-bold">
                              {row.orderCode}
                            </td>
                            <td className="px-3 py-2">
                              {row.customerName} ({row.destinationCity || "Yangon"})
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                value={row.allocatedCollected}
                                onChange={(e) =>
                                  handleUpdateAllocation(
                                    row.orderId,
                                    "allocatedCollected",
                                    Number(e.target.value),
                                  )
                                }
                                className="h-7 w-24 rounded border border-[#dedbd0] px-1.5 text-right font-mono text-xs font-bold outline-none focus:border-black"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                value={row.allocatedCourierFee}
                                onChange={(e) =>
                                  handleUpdateAllocation(
                                    row.orderId,
                                    "allocatedCourierFee",
                                    Number(e.target.value),
                                  )
                                }
                                className="h-7 w-20 rounded border border-[#dedbd0] px-1.5 text-right font-mono text-xs outline-none focus:border-black"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-emerald-800">
                              {formatMMK(net)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Calculation Summary Card */}
              <div className="rounded-xl border border-[#dedbd0] bg-[#faf9f5] p-4 text-xs">
                <div className="grid grid-cols-2 gap-y-2 sm:grid-cols-4">
                  <div>
                    <span className="text-[#77776f]">Total Collected:</span>
                    <p className="font-mono font-bold">{formatMMK(batchCalculation.totalCollected)}</p>
                  </div>
                  <div>
                    <span className="text-[#77776f]">Courier Fees:</span>
                    <p className="font-mono font-bold text-neutral-700">
                      -{formatMMK(batchCalculation.totalCourierFees)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#77776f]">Calculated Net:</span>
                    <p className="font-mono font-bold text-emerald-800">
                      {formatMMK(batchCalculation.calculatedNet)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#77776f]">Bank Received:</span>
                    <p className="font-mono font-black text-black">
                      {formatMMK(batchCalculation.bankReceived)}
                    </p>
                  </div>
                </div>

                {/* Discrepancy Indicator */}
                <div
                  className={`mt-3 flex items-center justify-between rounded-lg border p-2.5 ${
                    batchCalculation.isExactMatch
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-amber-300 bg-amber-50 text-amber-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-bold">
                    {batchCalculation.isExactMatch ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <AlertCircle size={16} />
                    )}
                    {batchCalculation.isExactMatch
                      ? "Exact Match (0 MMK Discrepancy)"
                      : "Discrepancy Detected"}
                  </span>
                  <span className="font-mono font-black">
                    {batchCalculation.discrepancy > 0 ? "+" : ""}
                    {formatMMK(batchCalculation.discrepancy)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-[#444]">
                  Internal Settlement Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Royal monthly payout batch #14 for week 35..."
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-[#dedbd0] p-2.5 text-xs outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t bg-[#f7f5ee] px-6 py-3.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-xl border border-[#dedbd0] bg-white px-4 py-2 text-xs font-bold transition hover:bg-[#eee]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || allocationRows.length === 0}
                onClick={handleSubmitBatch}
                className="rounded-xl bg-black px-5 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-neutral-800 disabled:opacity-40"
              >
                {pending ? "Recording..." : "Confirm & Record Settlement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reverse Settlement Batch */}
      {isReverseModalOpen && batchToReverse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-2xl border border-[#dedbd0] bg-white p-6 shadow-2xl">
            <h3 className="display text-lg font-bold text-rose-950">
              Reverse Settlement Batch {batchToReverse.batchCode}?
            </h3>
            <p className="mt-2 text-xs text-[#666]">
              Reversing this batch will return all associated orders to unsettled status and
              adjust shop revenue and courier-held balances accordingly. This action cannot be
              undone.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-[#444]">
                Reason for reversal (Audit Log)
              </label>
              <textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="e.g. Entered incorrect bank received amount / Wrong order included..."
                rows={3}
                className="mt-1 w-full rounded-xl border border-[#dedbd0] p-2.5 text-xs outline-none focus:border-black"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setIsReverseModalOpen(false);
                  setBatchToReverse(null);
                }}
                className="rounded-xl border border-[#dedbd0] bg-white px-4 py-2 text-xs font-bold transition hover:bg-[#eee]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || !reverseReason.trim()}
                onClick={handleConfirmReverse}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-700 disabled:opacity-40"
              >
                {pending ? "Reversing..." : "Confirm Reversal"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
