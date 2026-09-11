"use client";
import { FormEvent, useState, useTransition } from "react";
import { Layers3, Pencil, Plus, Trash2, X } from "lucide-react";
import { formatMMK } from "@/lib/data";
import type { InventoryItem } from "@/app/actions/store";
import type { BundleInput, BundleSet } from "@/app/actions/bundles";
import {
  createBundleAction,
  deleteBundleAction,
  updateBundleAction,
} from "@/app/actions/bundles";
import { ModalPortal } from "@/components/modal-portal";
type Draft = {
  name: string;
  description: string;
  bundlePrice: string;
  items: { sku: string; quantity: string }[];
};
const field = "h-11 w-full rounded-xl border px-3 text-sm";
export function BundleConsole({
  bundles,
  products,
}: {
  bundles: BundleSet[];
  products: InventoryItem[];
}) {
  const [editor, setEditor] = useState<{ id?: string; draft: Draft } | null>(
      null,
    ),
    [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null),
    [pending, startTransition] = useTransition();
  const run = (
    work: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    close?: () => void,
  ) =>
    startTransition(async () => {
      setNotice(null);
      try {
        const r = await work();
        setNotice({
          ok: r.ok,
          text: r.ok ? success : r.error || "Operation failed",
        });
        if (r.ok) close?.();
      } catch {
        setNotice({
          ok: false,
          text: "Connection interrupted. No changes were applied.",
        });
      }
    });
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!editor) return;
    const input: BundleInput = editor.draft;
    run(
      () =>
        editor.id
          ? updateBundleAction(editor.id, input)
          : createBundleAction(input),
      editor.id
        ? "Bundle updated across the storefront and checkout."
        : "Bundle created and published.",
      () => setEditor(null),
    );
  };
  const edit = (bundle: BundleSet) =>
    setEditor({
      id: bundle.id,
      draft: {
        name: bundle.name,
        description: bundle.description,
        bundlePrice: String(bundle.bundlePrice),
        items: bundle.items.map((x) => ({
          sku: x.sku,
          quantity: String(x.quantity),
        })),
      },
    });
  const newBundle = () =>
    setEditor({
      draft: {
        name: "",
        description: "",
        bundlePrice: "",
        items: [
          { sku: products[0]?.sku || "", quantity: "1" },
          { sku: products[1]?.sku || products[0]?.sku || "", quantity: "1" },
        ],
      },
    });
  const draftRetail = editor
    ? editor.draft.items.reduce(
        (sum, line) =>
          sum +
          (products.find((p) => p.sku === line.sku)?.price || 0) *
            Number(line.quantity || 0),
        0,
      )
    : 0;
  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          disabled={products.length < 2}
          onClick={newBundle}
          className="rounded-full bg-[#c7f36b] px-5 py-3 text-xs font-bold disabled:opacity-40"
        >
          <Plus size={14} className="mr-1 inline" />
          Create bundle set
        </button>
      </div>
      {notice && (
        <div
          role="status"
          className={`mb-4 rounded-xl border p-3 text-xs font-bold ${notice.ok ? "bg-[#effbdd] text-[#416b17]" : "bg-[#fff0eb] text-[#9c3212]"}`}
        >
          {notice.text}
        </div>
      )}
      <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {bundles.map((bundle) => (
          <article className="card min-w-0 p-4" key={bundle.id}>
            <div className="flex items-center justify-between gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#c7f36b]">
                <Layers3 size={16} />
              </span>
              <span
                className={`pill truncate px-2.5 py-1 text-[10px] ${bundle.available ? "bg-[#effbdd]" : "bg-[#fff0eb] text-[#9c3212]"}`}
              >
                {bundle.available} sets available
              </span>
            </div>
            <h2 className="display mt-3 truncate text-lg font-bold">
              {bundle.name}
            </h2>
            <p className="mt-1.5 max-h-10 overflow-hidden text-xs leading-5 text-[#777]">
              {bundle.description}
            </p>
            <div className="mt-3 max-h-32 space-y-1.5 overflow-y-auto pr-1">
              {bundle.items.map((item) => (
                <div
                  key={item.sku}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-lg bg-[#f1efe8] px-2.5 py-2 text-[11px]"
                >
                  <span className="min-w-0 truncate">
                    <b>{item.quantity}×</b> {item.name}
                  </span>
                  <code className="max-w-24 shrink-0 truncate text-[9px] text-[#777]">
                    {item.sku}
                  </code>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-end justify-between border-t pt-3">
              <div>
                <p className="text-[10px] text-[#777] line-through">
                  {formatMMK(bundle.retailValue)}
                </p>
                <p className="display text-lg font-bold">
                  {formatMMK(bundle.bundlePrice)}
                </p>
                <p className="text-[10px] font-bold text-[#45830d]">
                  Save {formatMMK(bundle.savings)}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  aria-label={`Edit ${bundle.name}`}
                  onClick={() => edit(bundle)}
                  className="grid h-8 w-8 place-items-center rounded-full border"
                >
                  <Pencil size={14} />
                </button>
                <button
                  aria-label={`Delete ${bundle.name}`}
                  onClick={() =>
                    confirm(`Remove ${bundle.name} from the storefront?`) &&
                    run(
                      () => deleteBundleAction(bundle.id),
                      "Bundle removed from all sales surfaces.",
                    )
                  }
                  className="grid h-8 w-8 place-items-center rounded-full border text-[#b5421c]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!bundles.length && (
        <div className="card p-12 text-center text-sm text-[#777]">
          No bundle sets yet. Combine two or more active catalog items to
          publish one.
        </div>
      )}
      {editor && (
        <ModalPortal isOpen={Boolean(editor)} onClose={() => setEditor(null)}>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm transition-opacity"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setEditor(null);
            }}
          >
            <form
              onSubmit={save}
              className="card flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#e5e4dc] bg-white p-4 sm:p-6">
                <div>
                  <p className="eyebrow">Bundle Sets</p>
                  <h2 className="display mt-0.5 text-xl sm:text-2xl font-bold">
                    {editor.id ? "Edit bundle" : "Create bundle"}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setEditor(null)}
                  className="grid h-9 w-9 place-items-center rounded-full border border-[#d6d4c8] bg-white text-[#555] hover:bg-[#f0eee4] transition"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold">
                    Name
                    <input
                      required
                      className={`${field} mt-1.5`}
                      value={editor.draft.name}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          draft: { ...editor.draft, name: e.target.value },
                        })
                      }
                    />
                  </label>
                  <label className="text-xs font-bold">
                    Bundle price (MMK)
                    <input
                      required
                      type="number"
                      min="1"
                      max={draftRetail || undefined}
                      className={`${field} mt-1.5`}
                      value={editor.draft.bundlePrice}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          draft: { ...editor.draft, bundlePrice: e.target.value },
                        })
                      }
                    />
                  </label>
                </div>
                <label className="mt-4 block text-xs font-bold">
                  Description
                  <textarea
                    required
                    maxLength={1000}
                    className="mt-1.5 min-h-20 w-full rounded-xl border p-3 text-sm"
                    value={editor.draft.description}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        draft: { ...editor.draft, description: e.target.value },
                      })
                    }
                  />
                </label>
                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold">Bundle items</p>
                    <p className="text-[10px] text-[#777]">
                      Combined retail: {formatMMK(draftRetail)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={editor.draft.items.length >= 12}
                    onClick={() =>
                      setEditor({
                        ...editor,
                        draft: {
                          ...editor.draft,
                          items: [
                            ...editor.draft.items,
                            { sku: products[0]?.sku || "", quantity: "1" },
                          ],
                        },
                      })
                    }
                    className="pill"
                  >
                    <Plus size={13} />
                    Add line
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {editor.draft.items.map((line, index) => (
                    <div
                      className="grid grid-cols-[1fr_75px_38px] sm:grid-cols-[1fr_90px_40px] gap-2"
                      key={index}
                    >
                      <select
                        required
                        className={field}
                        value={line.sku}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            draft: {
                              ...editor.draft,
                              items: editor.draft.items.map((x, i) =>
                                i === index ? { ...x, sku: e.target.value } : x,
                              ),
                            },
                          })
                        }
                      >
                        {products.map((p) => (
                          <option key={p.sku} value={p.sku}>
                            {p.name} · {p.sku} · {p.stock} stock
                          </option>
                        ))}
                      </select>
                      <input
                        aria-label="Quantity"
                        required
                        type="number"
                        min="1"
                        max="100"
                        className={field}
                        value={line.quantity}
                        onChange={(e) =>
                          setEditor({
                            ...editor,
                            draft: {
                              ...editor.draft,
                              items: editor.draft.items.map((x, i) =>
                                i === index
                                  ? { ...x, quantity: e.target.value }
                                  : x,
                              ),
                            },
                          })
                        }
                      />
                      <button
                        type="button"
                        aria-label="Remove line"
                        disabled={editor.draft.items.length <= 2}
                        onClick={() =>
                          setEditor({
                            ...editor,
                            draft: {
                              ...editor.draft,
                              items: editor.draft.items.filter(
                                (_, i) => i !== index,
                              ),
                            },
                          })
                        }
                        className="grid h-11 place-items-center rounded-xl border text-[#b5421c] disabled:opacity-30 hover:bg-[#fff0eb] transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                {draftRetail > 0 && Number(editor.draft.bundlePrice) > 0 && (
                  <p className="mt-4 rounded-xl bg-[#effbdd] p-3 text-xs font-bold text-[#416b17]">
                    Customer savings:{" "}
                    {formatMMK(
                      Math.max(0, draftRetail - Number(editor.draft.bundlePrice)),
                    )}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t border-[#e5e4dc] bg-[#f8f7f2] p-3.5 sm:p-5">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="rounded-xl border border-[#d6d4c8] bg-white px-4 py-2.5 text-xs font-bold text-[#555] hover:bg-[#f0eee4] transition min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  disabled={pending}
                  className="rounded-xl bg-black px-6 py-2.5 text-xs font-bold text-white disabled:opacity-40 shadow-sm transition min-h-[42px]"
                >
                  {pending
                    ? "Saving…"
                    : editor.id
                      ? "Save bundle"
                      : "Publish bundle"}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
