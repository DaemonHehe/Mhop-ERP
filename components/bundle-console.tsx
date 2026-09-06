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
        <div
          className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <form onSubmit={save} className="card my-8 w-full max-w-2xl p-6">
            <div className="flex justify-between">
              <div>
                <p className="eyebrow">Bundle Sets</p>
                <h2 className="display mt-1 text-2xl font-bold">
                  {editor.id ? "Edit bundle" : "Create bundle"}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setEditor(null)}
                className="grid h-9 w-9 place-items-center rounded-full border"
              >
                <X size={15} />
              </button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                  className="grid grid-cols-[1fr_90px_36px] gap-2"
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
                    className="grid h-11 place-items-center rounded-xl border text-[#b5421c] disabled:opacity-30"
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
            <button
              disabled={pending}
              className="mt-5 w-full rounded-xl bg-black py-3 text-xs font-bold text-white disabled:opacity-40"
            >
              {pending
                ? "Saving…"
                : editor.id
                  ? "Save bundle"
                  : "Publish bundle"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
