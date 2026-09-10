"use client";
import { FormEvent, useState, useTransition } from "react";
import Link from "next/link";
import {
  Banknote,
  CheckCircle2,
  Pencil,
  Plus,
  ReceiptText,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { formatMMK } from "@/lib/data";
import type { InventoryItem } from "@/app/actions/store";
import { MonthlyReportButton } from "./monthly-report-button";
import type {
  ErpSnapshot,
  ExpenseInput,
  ExpenseRecord,
  PurchaseInput,
  PurchaseRecord,
  SupplierInput,
  SupplierRecord,
} from "@/app/actions/erp";
import {
  cancelPurchaseAction,
  createExpenseAction,
  createPurchaseAction,
  createSupplierAction,
  deleteExpenseAction,
  deleteSupplierAction,
  receivePurchaseAction,
  updateExpenseAction,
  updateSupplierAction,
} from "@/app/actions/erp";

const field = "h-11 w-full rounded-xl border px-3 text-sm";
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="card my-8 w-full max-w-xl p-6">
        <div className="mb-5 flex justify-between">
          <div>
            <p className="eyebrow">ERP workspace</p>
            <h2 className="display mt-1 text-2xl font-bold">{title}</h2>
          </div>
          <button
            aria-label="Close"
            onClick={close}
            className="grid h-9 w-9 place-items-center rounded-full border"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Label({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold">
      <span className="mb-1.5 block">{name}</span>
      {children}
    </label>
  );
}
type Notice = { kind: "success" | "error"; text: string };
const today = () => new Date().toISOString().slice(0, 10);

export function ErpConsole({
  snapshot,
  suppliers,
  purchases,
  expenses,
  products,
}: {
  snapshot: ErpSnapshot;
  suppliers: SupplierRecord[];
  purchases: PurchaseRecord[];
  expenses: ExpenseRecord[];
  products: InventoryItem[];
}) {
  const [tab, setTab] = useState<"purchases" | "suppliers" | "expenses">(
      "purchases",
    ),
    [notice, setNotice] = useState<Notice | null>(null),
    [pending, startTransition] = useTransition();
  const [supplier, setSupplier] = useState<{
    id?: string;
    draft: {
      name: string;
      phone: string;
      email: string;
      address: string;
      notes: string;
    };
  } | null>(null);
  const [purchase, setPurchase] = useState<{
    supplierId: string;
    variantId: string;
    quantity: string;
    unitCost: string;
    notes: string;
  } | null>(null);
  const [expense, setExpense] = useState<{
    id?: string;
    draft: {
      category: string;
      description: string;
      amount: string;
      paymentMethod: string;
      expenseDate: string;
    };
  } | null>(null);
  const gadgets = products.filter((p) => p.category === "Gaming Gadgets");
  const run = (
    work: () => Promise<{ ok: boolean; error?: string }>,
    message: string,
    close?: () => void,
  ) =>
    startTransition(async () => {
      setNotice(null);
      try {
        const result = await work();
        setNotice(
          result.ok
            ? { kind: "success", text: message }
            : { kind: "error", text: result.error || "Operation failed" },
        );
        if (result.ok) close?.();
      } catch {
        setNotice({
          kind: "error",
          text: "Connection interrupted. No changes were applied; try again.",
        });
      }
    });
  const saveSupplier = (e: FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
    const input: SupplierInput = supplier.draft;
    run(
      () =>
        supplier.id
          ? updateSupplierAction(supplier.id, input)
          : createSupplierAction(input),
      supplier.id ? "Supplier updated." : "Supplier created.",
      () => setSupplier(null),
    );
  };
  const savePurchase = (e: FormEvent) => {
    e.preventDefault();
    if (!purchase) return;
    const input: PurchaseInput = purchase;
    run(
      () => createPurchaseAction(input),
      "Purchase order created. Stock will change only when it is received.",
      () => setPurchase(null),
    );
  };
  const saveExpense = (e: FormEvent) => {
    e.preventDefault();
    if (!expense) return;
    const input: ExpenseInput = {
      ...expense.draft,
      category: expense.draft.category as ExpenseInput["category"],
      paymentMethod: expense.draft
        .paymentMethod as ExpenseInput["paymentMethod"],
    };
    run(
      () =>
        expense.id
          ? updateExpenseAction(expense.id, input)
          : createExpenseAction(input),
      expense.id
        ? "Expense updated and reports recalculated."
        : "Expense recorded and reports recalculated.",
      () => setExpense(null),
    );
  };
  const metrics = [
    ["Verified sales", snapshot.sales, Banknote],
    ["Gross profit", snapshot.grossProfit, ShoppingCart],
    ["Operating expenses", snapshot.expenses, ReceiptText],
    ["Net profit", snapshot.netProfit, CheckCircle2],
  ] as const;
  return (
    <>
      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value, Icon]) => (
          <div className="card p-5" key={label}>
            <div className="flex justify-between">
              <p className="text-xs font-semibold text-[#77776f]">{label}</p>
              <Icon size={16} />
            </div>
            <p className="display mt-6 text-2xl font-bold">
              {formatMMK(value)}
            </p>
          </div>
        ))}
      </section>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4 border-sky-200 bg-sky-50/40 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="eyebrow text-sky-900 flex items-center gap-1.5 font-bold">
                <Truck size={13} className="text-sky-700" /> Expected payment from Royal COD
              </p>
              <Link
                href="/erp/settlements"
                className="text-[11px] font-bold text-sky-700 hover:underline flex items-center gap-0.5"
                title="View Royal Express settlements"
              >
                Settlements →
              </Link>
            </div>
            <p className="display mt-2 text-2xl font-black text-sky-950">
              {formatMMK(snapshot.expectedRoyalPayment)}
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[10px] text-sky-800/90 font-medium">
            <span>
              COD: <strong>{formatMMK(snapshot.expectedRoyalCod)}</strong>
            </span>
            <span>−</span>
            <span>
              Royal fee: <strong>{formatMMK(snapshot.expectedRoyalCourierCost)}</strong>
            </span>
            {snapshot.unsettledRoyalOrdersCount > 0 && (
              <>
                <span>·</span>
                <span className="font-bold text-sky-950">
                  {snapshot.unsettledRoyalOrdersCount} {snapshot.unsettledRoyalOrdersCount === 1 ? "order" : "orders"}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Inventory asset value</p>
          <p className="display mt-2 text-2xl font-bold">
            {formatMMK(snapshot.inventoryValue)}
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Warranty and refunds</p>
          <p className="display mt-2 text-2xl font-bold">
            {formatMMK(snapshot.warrantyCost + snapshot.refunds)}
          </p>
          <p className="mt-1 text-[10px] text-[#777]">
            {formatMMK(snapshot.warrantyCost)} service cost ·{" "}
            {formatMMK(snapshot.refunds)} refunded
          </p>
        </div>
        <div className="card p-4">
          <p className="eyebrow">Open purchase orders</p>
          <p className="display mt-2 text-2xl font-bold">
            {snapshot.openPurchases}
          </p>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full overflow-x-auto rounded-full border bg-white/60 p-1">
          {[
            ["purchases", "Purchasing"],
            ["suppliers", "Suppliers"],
            ["expenses", "Expenses"],
          ].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setTab(v as typeof tab)}
              className={`rounded-full px-4 py-2 text-xs font-bold ${tab === v ? "bg-black text-white" : ""}`}
            >
              {l}
            </button>
          ))}
          <Link
            href="/erp/settlements"
            className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-[#77776f] transition hover:text-black"
          >
            <Truck size={13} /> Courier Settlements
            {snapshot.expectedRoyalPayment > 0 && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                {formatMMK(snapshot.expectedRoyalPayment)}
              </span>
            )}
            <span>→</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <MonthlyReportButton variant="pill" />
          <button
            disabled={
              pending ||
              (tab === "purchases" && (!suppliers.length || !gadgets.length))
            }
            onClick={() =>
              tab === "suppliers"
                ? setSupplier({
                    draft: {
                      name: "",
                      phone: "",
                      email: "",
                      address: "",
                      notes: "",
                    },
                  })
                : tab === "purchases"
                  ? setPurchase({
                      supplierId: suppliers[0]?.id || "",
                      variantId: gadgets[0]?.variantId || "",
                      quantity: "1",
                      unitCost: String(gadgets[0]?.cost || 0),
                      notes: "",
                    })
                  : setExpense({
                      draft: {
                        category: "Marketing",
                        description: "",
                        amount: "",
                        paymentMethod: "KBZPay",
                        expenseDate: today(),
                      },
                    })
            }
            className="rounded-full bg-[#c7f36b] px-5 py-3 text-xs font-bold disabled:opacity-40"
          >
            <Plus size={14} className="mr-1 inline" />
            Add{" "}
            {tab === "purchases"
              ? "purchase"
              : tab === "suppliers"
                ? "supplier"
                : "expense"}
          </button>
        </div>
      </div>
      {notice && (
        <div
          role="status"
          className={`mb-4 rounded-xl border p-3 text-xs font-bold ${notice.kind === "error" ? "bg-[#fff0eb] text-[#9c3212]" : "bg-[#effbdd] text-[#416b17]"}`}
        >
          {notice.text}
        </div>
      )}
      {tab === "purchases" && (
        <>
          <div className="space-y-3 md:hidden">
            {purchases.map((purchaseOrder) => (
              <article className="card p-4" key={purchaseOrder.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-bold">
                      {purchaseOrder.code}
                    </p>
                    <p className="mt-1 truncate font-bold">
                      {purchaseOrder.product}
                    </p>
                    <p className="mt-1 text-xs text-[#777]">
                      {purchaseOrder.supplier} · {purchaseOrder.quantity} units
                    </p>
                  </div>
                  <span className="pill shrink-0 capitalize">
                    {purchaseOrder.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <p className="font-bold">
                    {formatMMK(purchaseOrder.totalCost)}
                  </p>
                  {purchaseOrder.status === "ordered" && (
                    <div className="flex gap-2">
                      <button
                        disabled={pending}
                        onClick={() =>
                          run(
                            () => receivePurchaseAction(purchaseOrder.id),
                            "Purchase received; cost and stock updated together.",
                          )
                        }
                        className="min-h-11 rounded-xl bg-black px-4 text-xs font-bold text-white"
                      >
                        Receive
                      </button>
                      <button
                        disabled={pending}
                        onClick={() =>
                          confirm(`Cancel ${purchaseOrder.code}?`) &&
                          run(
                            () => cancelPurchaseAction(purchaseOrder.id),
                            "Purchase cancelled.",
                          )
                        }
                        className="min-h-11 rounded-xl border px-4 text-xs font-bold"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
            {!purchases.length && (
              <div className="card p-8 text-center text-sm text-[#777]">
                No purchase orders yet.
              </div>
            )}
          </div>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Purchase",
                    "Supplier",
                    "Item",
                    "Qty",
                    "Total",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b px-5 py-3 text-[10px] uppercase tracking-wider text-[#77776f]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="px-5 py-4 font-mono text-xs">{p.code}</td>
                    <td className="px-5 py-4 font-bold">{p.supplier}</td>
                    <td className="px-5 py-4">
                      {p.product}
                      <p className="font-mono text-[10px] text-[#777]">
                        {p.sku}
                      </p>
                    </td>
                    <td className="px-5 py-4">{p.quantity}</td>
                    <td className="px-5 py-4 font-bold">
                      {formatMMK(p.totalCost)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="pill capitalize">{p.status}</span>
                    </td>
                    <td className="px-5 py-4">
                      {p.status === "ordered" && (
                        <div className="flex gap-2">
                          <button
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => receivePurchaseAction(p.id),
                                "Purchase received; cost and stock updated together.",
                              )
                            }
                            className="rounded-full bg-black px-3 py-2 text-[10px] font-bold text-white"
                          >
                            Receive
                          </button>
                          <button
                            disabled={pending}
                            onClick={() =>
                              confirm(`Cancel ${p.code}?`) &&
                              run(
                                () => cancelPurchaseAction(p.id),
                                "Purchase cancelled.",
                              )
                            }
                            className="rounded-full border px-3 py-2 text-[10px] font-bold"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!purchases.length && (
              <p className="p-10 text-center text-sm text-[#777]">
                No purchase orders yet.
              </p>
            )}
          </div>
        </>
      )}
      {tab === "suppliers" && (
        <>
          <div className="space-y-3 md:hidden">
            {suppliers.map((supplierRecord) => (
              <article className="card p-4" key={supplierRecord.id}>
                <p className="font-bold">{supplierRecord.name}</p>
                <p className="mt-2 text-xs leading-5 text-[#777]">
                  {supplierRecord.phone || "No phone"}
                  <br />
                  {supplierRecord.email || "No email"}
                  <br />
                  {supplierRecord.address || "No address"}
                </p>
                <div className="mt-4 flex justify-end gap-2 border-t pt-3">
                  <button
                    aria-label="Edit supplier"
                    onClick={() =>
                      setSupplier({
                        id: supplierRecord.id,
                        draft: {
                          name: supplierRecord.name,
                          phone: supplierRecord.phone || "",
                          email: supplierRecord.email || "",
                          address: supplierRecord.address || "",
                          notes: supplierRecord.notes || "",
                        },
                      })
                    }
                    className="grid h-11 w-11 place-items-center rounded-xl border"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    aria-label="Delete supplier"
                    onClick={() =>
                      confirm(`Archive ${supplierRecord.name}?`) &&
                      run(
                        () => deleteSupplierAction(supplierRecord.id),
                        "Supplier archived.",
                      )
                    }
                    className="grid h-11 w-11 place-items-center rounded-xl border text-[#b5421c]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
            {!suppliers.length && (
              <div className="card p-8 text-center text-sm text-[#777]">
                Add a supplier before creating purchase orders.
              </div>
            )}
          </div>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr>
                  {["Supplier", "Phone", "Email", "Address", "Actions"].map(
                    (h) => (
                      <th
                        key={h}
                        className="border-b px-5 py-3 text-[10px] uppercase tracking-wider text-[#777]"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id} className="border-b">
                    <td className="px-5 py-4 font-bold">{s.name}</td>
                    <td className="px-5 py-4">{s.phone || "—"}</td>
                    <td className="px-5 py-4">{s.email || "—"}</td>
                    <td className="px-5 py-4">{s.address || "—"}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <button
                          aria-label="Edit supplier"
                          onClick={() =>
                            setSupplier({
                              id: s.id,
                              draft: {
                                name: s.name,
                                phone: s.phone || "",
                                email: s.email || "",
                                address: s.address || "",
                                notes: s.notes || "",
                              },
                            })
                          }
                          className="grid h-8 w-8 place-items-center rounded-full border"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          aria-label="Delete supplier"
                          onClick={() =>
                            confirm(`Archive ${s.name}?`) &&
                            run(
                              () => deleteSupplierAction(s.id),
                              "Supplier archived.",
                            )
                          }
                          className="grid h-8 w-8 place-items-center rounded-full border text-[#b5421c]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!suppliers.length && (
              <p className="p-10 text-center text-sm text-[#777]">
                Add a supplier before creating purchase orders.
              </p>
            )}
          </div>
        </>
      )}
      {tab === "expenses" && (
        <>
          <div className="space-y-3 md:hidden">
            {expenses.map((expenseRecord) => (
              <article className="card p-4" key={expenseRecord.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] font-bold">
                      {expenseRecord.code}
                    </p>
                    <p className="mt-1 break-words font-bold">
                      {expenseRecord.description}
                    </p>
                    <p className="mt-2 text-xs text-[#777]">
                      {expenseRecord.category} · {expenseRecord.paymentMethod} ·{" "}
                      {new Date(expenseRecord.expenseDate).toLocaleDateString(
                        "en-GB",
                      )}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold">
                    {formatMMK(expenseRecord.amount)}
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t pt-3">
                  <button
                    aria-label="Edit expense"
                    onClick={() =>
                      setExpense({
                        id: expenseRecord.id,
                        draft: {
                          category: expenseRecord.category,
                          description: expenseRecord.description,
                          amount: String(expenseRecord.amount),
                          paymentMethod: expenseRecord.paymentMethod,
                          expenseDate: new Date(expenseRecord.expenseDate)
                            .toISOString()
                            .slice(0, 10),
                        },
                      })
                    }
                    className="grid h-11 w-11 place-items-center rounded-xl border"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    aria-label="Delete expense"
                    onClick={() =>
                      confirm(`Delete ${expenseRecord.code}?`) &&
                      run(
                        () => deleteExpenseAction(expenseRecord.id),
                        "Expense deleted and reports recalculated.",
                      )
                    }
                    className="grid h-11 w-11 place-items-center rounded-xl border text-[#b5421c]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
            {!expenses.length && (
              <div className="card p-8 text-center text-sm text-[#777]">
                No expenses recorded.
              </div>
            )}
          </div>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr>
                  {[
                    "Expense",
                    "Date",
                    "Category",
                    "Description",
                    "Payment",
                    "Amount",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="border-b px-5 py-3 text-[10px] uppercase tracking-wider text-[#777]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((x) => (
                  <tr key={x.id} className="border-b">
                    <td className="px-5 py-4 font-mono text-xs">{x.code}</td>
                    <td className="px-5 py-4">
                      {new Date(x.expenseDate).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-4">
                      <span className="pill">{x.category}</span>
                    </td>
                    <td className="px-5 py-4">{x.description}</td>
                    <td className="px-5 py-4">{x.paymentMethod}</td>
                    <td className="px-5 py-4 font-bold">
                      {formatMMK(x.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <button
                          aria-label="Edit expense"
                          onClick={() =>
                            setExpense({
                              id: x.id,
                              draft: {
                                category: x.category,
                                description: x.description,
                                amount: String(x.amount),
                                paymentMethod: x.paymentMethod,
                                expenseDate: new Date(x.expenseDate)
                                  .toISOString()
                                  .slice(0, 10),
                              },
                            })
                          }
                          className="grid h-8 w-8 place-items-center rounded-full border"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          aria-label="Delete expense"
                          onClick={() =>
                            confirm(`Delete ${x.code}?`) &&
                            run(
                              () => deleteExpenseAction(x.id),
                              "Expense deleted and reports recalculated.",
                            )
                          }
                          className="grid h-8 w-8 place-items-center rounded-full border text-[#b5421c]"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!expenses.length && (
              <p className="p-10 text-center text-sm text-[#777]">
                No expenses recorded.
              </p>
            )}
          </div>
        </>
      )}
      {supplier && (
        <Modal
          title={supplier.id ? "Edit supplier" : "Add supplier"}
          close={() => setSupplier(null)}
        >
          <form onSubmit={saveSupplier} className="space-y-4">
            <Label name="Supplier name">
              <input
                required
                className={field}
                value={supplier.draft.name}
                onChange={(e) =>
                  setSupplier({
                    ...supplier,
                    draft: { ...supplier.draft, name: e.target.value },
                  })
                }
              />
            </Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label name="Phone">
                <input
                  className={field}
                  value={supplier.draft.phone}
                  onChange={(e) =>
                    setSupplier({
                      ...supplier,
                      draft: { ...supplier.draft, phone: e.target.value },
                    })
                  }
                />
              </Label>
              <Label name="Email">
                <input
                  type="email"
                  className={field}
                  value={supplier.draft.email}
                  onChange={(e) =>
                    setSupplier({
                      ...supplier,
                      draft: { ...supplier.draft, email: e.target.value },
                    })
                  }
                />
              </Label>
            </div>
            <Label name="Address">
              <textarea
                className="min-h-20 w-full rounded-xl border p-3 text-sm"
                value={supplier.draft.address}
                onChange={(e) =>
                  setSupplier({
                    ...supplier,
                    draft: { ...supplier.draft, address: e.target.value },
                  })
                }
              />
            </Label>
            <Label name="Notes">
              <textarea
                className="min-h-20 w-full rounded-xl border p-3 text-sm"
                value={supplier.draft.notes}
                onChange={(e) =>
                  setSupplier({
                    ...supplier,
                    draft: { ...supplier.draft, notes: e.target.value },
                  })
                }
              />
            </Label>
            <button
              disabled={pending}
              className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white"
            >
              Save supplier
            </button>
          </form>
        </Modal>
      )}
      {purchase && (
        <Modal title="Create purchase order" close={() => setPurchase(null)}>
          <form onSubmit={savePurchase} className="space-y-4">
            <Label name="Supplier">
              <select
                required
                className={field}
                value={purchase.supplierId}
                onChange={(e) =>
                  setPurchase({ ...purchase, supplierId: e.target.value })
                }
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Label>
            <Label name="Gadget listing">
              <select
                required
                className={field}
                value={purchase.variantId}
                onChange={(e) => {
                  const item = gadgets.find(
                    (p) => p.variantId === e.target.value,
                  );
                  setPurchase({
                    ...purchase,
                    variantId: e.target.value,
                    unitCost: String(item?.cost || 0),
                  });
                }}
              >
                {gadgets.map((p) => (
                  <option key={p.variantId} value={p.variantId}>
                    {p.name} · {p.sku}
                  </option>
                ))}
              </select>
            </Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label name="Quantity">
                <input
                  required
                  type="number"
                  min="1"
                  className={field}
                  value={purchase.quantity}
                  onChange={(e) =>
                    setPurchase({ ...purchase, quantity: e.target.value })
                  }
                />
              </Label>
              <Label name="Unit cost (MMK)">
                <input
                  required
                  type="number"
                  min="0"
                  className={field}
                  value={purchase.unitCost}
                  onChange={(e) =>
                    setPurchase({ ...purchase, unitCost: e.target.value })
                  }
                />
              </Label>
            </div>
            <Label name="Notes">
              <textarea
                className="min-h-20 w-full rounded-xl border p-3 text-sm"
                value={purchase.notes}
                onChange={(e) =>
                  setPurchase({ ...purchase, notes: e.target.value })
                }
              />
            </Label>
            <p className="rounded-xl bg-[#fff8dc] p-3 text-xs">
              Creating a PO does not alter stock. Use Receive after the physical
              quantity is checked.
            </p>
            <button
              disabled={pending}
              className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white"
            >
              Create purchase order
            </button>
          </form>
        </Modal>
      )}
      {expense && (
        <Modal
          title={expense.id ? "Edit expense" : "Record expense"}
          close={() => setExpense(null)}
        >
          <form onSubmit={saveExpense} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Label name="Category">
                <select
                  className={field}
                  value={expense.draft.category}
                  onChange={(e) =>
                    setExpense({
                      ...expense,
                      draft: { ...expense.draft, category: e.target.value },
                    })
                  }
                >
                  {[
                    "Rent",
                    "Payroll",
                    "Delivery",
                    "Marketing",
                    "Utilities",
                    "Software",
                    "Maintenance",
                    "Tax",
                    "Other",
                  ].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Label>
              <Label name="Date">
                <input
                  required
                  type="date"
                  className={field}
                  value={expense.draft.expenseDate}
                  onChange={(e) =>
                    setExpense({
                      ...expense,
                      draft: { ...expense.draft, expenseDate: e.target.value },
                    })
                  }
                />
              </Label>
            </div>
            <Label name="Description">
              <input
                required
                className={field}
                value={expense.draft.description}
                onChange={(e) =>
                  setExpense({
                    ...expense,
                    draft: { ...expense.draft, description: e.target.value },
                  })
                }
              />
            </Label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Label name="Amount (MMK)">
                <input
                  required
                  type="number"
                  min="1"
                  className={field}
                  value={expense.draft.amount}
                  onChange={(e) =>
                    setExpense({
                      ...expense,
                      draft: { ...expense.draft, amount: e.target.value },
                    })
                  }
                />
              </Label>
              <Label name="Payment method">
                <select
                  className={field}
                  value={expense.draft.paymentMethod}
                  onChange={(e) =>
                    setExpense({
                      ...expense,
                      draft: {
                        ...expense.draft,
                        paymentMethod: e.target.value,
                      },
                    })
                  }
                >
                  {["Cash", "KBZPay", "WavePay", "Bank Transfer", "Other"].map(
                    (x) => (
                      <option key={x}>{x}</option>
                    ),
                  )}
                </select>
              </Label>
            </div>
            <button
              disabled={pending}
              className="w-full rounded-xl bg-black py-3 text-xs font-bold text-white"
            >
              Save expense
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
