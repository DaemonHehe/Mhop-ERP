"use client";

import { useRef, useState, useTransition } from "react";
import {
  CheckCircle2,
  Clock3,
  Plus,
  ShieldCheck,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import {
  createWarrantyTicket,
  resolveWarrantyTicketAction,
  updateTicketStatusAction,
  type InventoryItem,
} from "@/app/actions/store";
import { formatMMK } from "@/lib/data";

interface Ticket {
  id: string;
  ticketCode: string;
  customerName: string;
  category: string;
  priority: string;
  status: string;
  messageText: string | null;
  serialNumber: string | null;
  productName: string;
  sku: string;
  warrantyExpiresAt: Date | null;
  resolution: string | null;
  resolutionCost: number;
  refundAmount: number;
}

const columns = [
  {
    key: "received",
    label: "Claim received",
    icon: Clock3,
    statuses: ["claim_received"],
  },
  {
    key: "inspection",
    label: "Inspection",
    icon: ShieldCheck,
    statuses: ["inspection"],
  },
  {
    key: "resolved",
    label: "Repair / replacement",
    icon: Wrench,
    statuses: ["repaired", "replaced"],
  },
  {
    key: "closed",
    label: "Closed",
    icon: CheckCircle2,
    statuses: ["dispatched", "refunded", "rejected"],
  },
] as const;
const field =
  "h-11 w-full rounded-xl border bg-white px-3 text-sm outline-none focus:border-black";

export function WarrantyBoard({
  tickets,
  products,
}: {
  tickets: Ticket[];
  products: InventoryItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [resolving, setResolving] = useState<Ticket | null>(null);
  const [resolutionType, setResolutionType] = useState<
    "repair" | "replacement" | "refund" | "rejected"
  >("repair");
  const [notice, setNotice] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const replacements = products.filter(
    (product) => product.category === "Gaming Gadgets" && product.stock > 0,
  );

  const run = (
    work: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    close?: () => void,
  ) =>
    startTransition(async () => {
      try {
        const result = await work();
        setNotice(
          result.ok
            ? { kind: "ok", text: success }
            : { kind: "error", text: result.error || "Operation failed." },
        );
        if (result.ok) close?.();
      } catch {
        setNotice({
          kind: "error",
          text: "Connection interrupted. No changes were applied.",
        });
      }
    });

  const create = (form: FormData) =>
    startTransition(async () => {
      try {
        const result = await createWarrantyTicket(form);
        if (result.ok) {
          setNotice({
            kind: "ok",
            text: `${result.data?.ticketCode || "Warranty claim"} passed policy checks and was created.`,
          });
          formRef.current?.reset();
          setCreating(false);
        } else setNotice({ kind: "error", text: result.error });
      } catch {
        setNotice({
          kind: "error",
          text: "Connection interrupted. No claim was created.",
        });
      }
    });

  const resolve = (form: FormData) => {
    if (!resolving) return;
    run(
      () =>
        resolveWarrantyTicketAction(resolving.id, {
          resolution: resolutionType,
          resolutionCost: Number(form.get("resolutionCost") || 0),
          refundAmount: Number(form.get("refundAmount") || 0),
          replacementVariantId:
            String(form.get("replacementVariantId") || "") || undefined,
        }),
      `${resolving.ticketCode} resolved as ${resolutionType}. ERP and stock were updated together.`,
      () => setResolving(null),
    );
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {notice ? (
          <p
            role="status"
            className={`rounded-xl border px-4 py-3 text-xs font-bold ${notice.kind === "error" ? "bg-[#fff0eb] text-[#9c3212]" : "bg-[#effbdd] text-[#416b17]"}`}
          >
            {notice.text}
          </p>
        ) : (
          <span />
        )}
        <button
          onClick={() => setCreating(true)}
          className="pill min-h-11 bg-black px-4 text-white"
        >
          <Plus size={14} />
          New warranty claim
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {columns.map(({ key, label, icon: Icon, statuses }) => {
          const visible = tickets.filter((ticket) =>
            (statuses as readonly string[]).includes(ticket.status),
          );
          return (
            <section key={key} className="rounded-2xl bg-[#eae7df] p-3">
              <div className="flex items-center justify-between px-1 py-2">
                <div className="flex items-center gap-2">
                  <Icon size={15} />
                  <h2 className="text-xs font-bold">{label}</h2>
                </div>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-[10px] font-bold">
                  {visible.length}
                </span>
              </div>
              <div className="mt-2 space-y-2">
                {visible.map((ticket) => (
                  <article key={ticket.id} className="card p-4">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono text-[10px] font-bold">
                        {ticket.ticketCode}
                      </span>
                      <span className="text-[10px] uppercase text-[#77776f]">
                        {ticket.priority}
                      </span>
                    </div>
                    <h3 className="mt-3 text-sm font-bold">
                      {ticket.productName}
                    </h3>
                    <p className="mt-1 text-xs text-[#77776f]">
                      {ticket.messageText || ticket.category}
                    </p>
                    <p className="mt-2 break-all font-mono text-[10px] text-[#77776f]">
                      {ticket.sku} ·{" "}
                      {ticket.serialNumber || "Non-serialized item"}
                    </p>
                    {ticket.warrantyExpiresAt && (
                      <p className="mt-2 text-[10px] font-bold text-[#4d791c]">
                        Covered until{" "}
                        {new Date(ticket.warrantyExpiresAt).toLocaleDateString(
                          "en-GB",
                        )}
                      </p>
                    )}
                    {(ticket.resolutionCost > 0 || ticket.refundAmount > 0) && (
                      <p className="mt-2 text-[10px] text-[#77776f]">
                        Cost {formatMMK(ticket.resolutionCost)}
                        {ticket.refundAmount > 0
                          ? ` · Refund ${formatMMK(ticket.refundAmount)}`
                          : ""}
                      </p>
                    )}
                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <span className="text-[10px] font-bold capitalize text-[#77776f]">
                        {ticket.status.replaceAll("_", " ")}
                      </span>
                      {ticket.status === "claim_received" && (
                        <button
                          disabled={pending || ticket.id.startsWith("demo-")}
                          onClick={() =>
                            run(
                              () =>
                                updateTicketStatusAction(
                                  ticket.id,
                                  "inspection",
                                ),
                              "Claim moved to inspection.",
                            )
                          }
                          className="min-h-10 rounded-xl px-3 text-[10px] font-bold disabled:opacity-30"
                        >
                          Inspect →
                        </button>
                      )}
                      {ticket.status === "inspection" && (
                        <button
                          disabled={pending || ticket.id.startsWith("demo-")}
                          onClick={() => setResolving(ticket)}
                          className="min-h-10 rounded-xl bg-black px-3 text-[10px] font-bold text-white disabled:opacity-30"
                        >
                          Resolve
                        </button>
                      )}
                      {["repaired", "replaced"].includes(ticket.status) && (
                        <button
                          disabled={pending || ticket.id.startsWith("demo-")}
                          onClick={() =>
                            run(
                              () =>
                                updateTicketStatusAction(
                                  ticket.id,
                                  "dispatched",
                                ),
                              "Resolved item dispatched to customer.",
                            )
                          }
                          className="min-h-10 rounded-xl px-3 text-[10px] font-bold disabled:opacity-30"
                        >
                          <Truck size={12} className="mr-1 inline" />
                          Dispatch
                        </button>
                      )}
                    </div>
                  </article>
                ))}
                {!visible.length && (
                  <p className="px-3 py-6 text-center text-xs text-[#898a81]">
                    No claims
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {creating && (
        <Modal title="New warranty claim" onClose={() => setCreating(false)}>
          <form ref={formRef} action={create}>
            <p className="text-xs leading-5 text-[#77776f]">
              Payment and delivery must be completed. The SKU must belong to the
              order; serial/IMEI is optional for ordinary accessories.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                name="orderCode"
                label="Order code"
                placeholder="MHOP-260829-AB12"
              />
              <Field name="phone" label="Purchase phone" />
              <Field name="sku" label="Product SKU" />
              <Field
                name="serialNumber"
                label="Serial or IMEI (optional)"
                required={false}
              />
              <Select
                name="category"
                label="Issue category"
                options={["DOA", "battery", "display", "charging", "other"]}
              />
              <Select
                name="priority"
                label="Priority"
                options={["low", "normal", "high", "urgent"]}
              />
            </div>
            <label className="mt-4 block text-xs font-bold">
              Issue details
              <textarea
                name="messageText"
                maxLength={2000}
                className="mt-1.5 min-h-28 w-full rounded-xl border bg-white p-3 text-sm"
              />
            </label>
            <button
              disabled={pending}
              className="mt-5 min-h-12 w-full rounded-xl bg-black text-xs font-bold text-white disabled:opacity-40"
            >
              {pending
                ? "Checking policy…"
                : "Verify coverage and create claim"}
            </button>
          </form>
        </Modal>
      )}

      {resolving && (
        <Modal
          title={`Resolve ${resolving.ticketCode}`}
          onClose={() => setResolving(null)}
        >
          <form action={resolve}>
            <label className="text-xs font-bold">
              Resolution
              <select
                value={resolutionType}
                onChange={(event) =>
                  setResolutionType(event.target.value as typeof resolutionType)
                }
                className={`${field} mt-1.5`}
              >
                <option value="repair">Repair</option>
                <option value="replacement">Replacement</option>
                <option value="refund">Customer refund</option>
                <option value="rejected">Reject claim</option>
              </select>
            </label>
            {resolutionType === "replacement" && (
              <label className="mt-4 block text-xs font-bold">
                Replacement stock
                <select
                  required
                  name="replacementVariantId"
                  className={`${field} mt-1.5`}
                >
                  <option value="">Select available product</option>
                  {replacements.map((product) => (
                    <option key={product.variantId} value={product.variantId}>
                      {product.name} · {product.sku} · {product.stock} stock
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[10px] font-normal text-[#77776f]">
                  Its cost price is booked automatically and one unit is removed
                  from stock.
                </span>
              </label>
            )}
            {(resolutionType === "repair" ||
              resolutionType === "replacement") && (
              <Field
                name="resolutionCost"
                label={
                  resolutionType === "replacement"
                    ? "Additional service cost (MMK)"
                    : "Repair cost (MMK)"
                }
                type="number"
                defaultValue="0"
              />
            )}
            {resolutionType === "refund" && (
              <Field
                name="refundAmount"
                label="Refund amount (MMK)"
                type="number"
              />
            )}
            {resolutionType === "rejected" && (
              <p className="mt-4 rounded-xl bg-[#fff8dc] p-3 text-xs">
                The claim closes without changing stock or booking a warranty
                cost.
              </p>
            )}
            <button
              disabled={pending}
              className="mt-5 min-h-12 w-full rounded-xl bg-black text-xs font-bold text-white disabled:opacity-40"
            >
              {pending ? "Applying resolution…" : "Apply resolution"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="card my-8 w-full max-w-2xl p-5 sm:p-6">
        <div className="mb-5 flex justify-between gap-3">
          <div>
            <p className="eyebrow">Warranty policy</p>
            <h2 className="display mt-1 text-2xl font-bold">{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border"
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  required = true,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <label className="mt-4 block text-xs font-bold sm:mt-0">
      {label}
      <input
        required={required}
        type={type}
        min={type === "number" ? 0 : undefined}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`${field} mt-1.5`}
      />
    </label>
  );
}

function Select({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: string[];
}) {
  return (
    <label className="text-xs font-bold">
      {label}
      <select name={name} className={`${field} mt-1.5`}>
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
