"use client";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Image as ImageIcon, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { formatMMK } from "@/lib/data";
import { ImageUpload } from "@/components/image-upload";
import type {
  CatalogItemInput,
  InventoryItem,
} from "@/app/actions/store";
import {
  createCatalogItemAction,
  deleteCatalogItemAction,
  updateCatalogItemAction,
} from "@/app/actions/store";

type CatalogDraft = {
  name: string;
  brand: string;
  category: "Gaming Gadgets" | "PUBG Accounts";
  subcategory: string;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  sku: string;
  color: string;
  price: string;
  costPrice: string;
  warrantyMonths: string;
  stockQuantity: string;
  lowStockThreshold: string;
  listingStatus: "available" | "reserved" | "sold" | "withdrawn";
};
const emptyCatalog: CatalogDraft = {
  name: "",
  brand: "",
  category: "Gaming Gadgets",
  subcategory: "Gaming Headphones",
  description: "",
  imageUrl: "",
  imageUrls: [],
  sku: "",
  color: "",
  price: "",
  costPrice: "",
  warrantyMonths: "6",
  stockQuantity: "0",
  lowStockThreshold: "3",
  listingStatus: "available",
};
const inputClass = "h-11 w-full rounded-xl border px-3 text-sm outline-none";

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <ModalPortal onClose={onClose}>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4 md:p-6 backdrop-blur-sm transition-opacity duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-3xl flex-col rounded-3xl border border-[#dedbd1] bg-[#fffef9] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#eee] bg-white p-4 sm:px-6 sm:py-4">
            <div>
              <p className="eyebrow text-xs">Products & Stock</p>
              <h2 className="display mt-0.5 text-lg sm:text-xl font-bold text-[#1f1f1d]">{title}</h2>
              {subtitle && <p className="text-xs text-[#777] mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full border border-[#dedbd1] text-[#777] hover:bg-[#f1efe8] hover:text-black transition"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-[#555]">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

export function InventoryConsole({
  items,
}: {
  items: InventoryItem[];
}) {
  const [category, setCategory] = useState<CatalogDraft["category"]>("Gaming Gadgets");
  const [query, setQuery] = useState(""),
    [notice, setNotice] = useState<{
      kind: "success" | "error";
      text: string;
    } | null>(null),
    [pending, startTransition] = useTransition();
  const [catalogEditor, setCatalogEditor] = useState<{
      id?: string;
      draft: CatalogDraft;
    } | null>(null);
  const filtered = useMemo(
    () =>
      items.filter((p) => p.category === category &&
        `${p.name} ${p.sku} ${p.brand} ${p.category} ${p.subcategory}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query, category],
  );
  const showResult = (
    result: { ok: boolean; error?: string },
    success: string,
  ) =>
    setNotice(
      result.ok
        ? { kind: "success", text: success }
        : {
            kind: "error",
            text: result.error || "The operation could not be completed.",
          },
    );
  const safely = (
    work: () => Promise<{ ok: boolean; error?: string }>,
    success: string,
    close?: () => void,
  ) =>
    startTransition(async () => {
      setNotice(null);
      try {
        const result = await work();
        showResult(result, success);
        if (result.ok) close?.();
      } catch {
        setNotice({
          kind: "error",
          text: "The request was interrupted. Check your connection and try again.",
        });
      }
    });
  const editCatalog = (item: InventoryItem) => {
    const rawImage = item.image === "/placeholder.svg" ? "" : item.image;
    const initialImages =
      item.images && item.images.length > 0
        ? item.images
        : rawImage
          ? [rawImage]
          : [];

    setCatalogEditor({
      id: item.variantId,
      draft: {
        name: item.name,
        brand: item.brand,
        category: item.category as CatalogDraft["category"],
        subcategory: item.subcategory,
        description: item.description,
        imageUrl: rawImage,
        imageUrls: initialImages,
        sku: item.sku,
        color: item.color || "",
        price: String(item.price),
        costPrice: String(item.cost),
        warrantyMonths: String(item.warranty),
        stockQuantity: item.category === "PUBG Accounts" ? "0" : String(item.stock),
        listingStatus: (item.listingStatus || "available") as CatalogDraft["listingStatus"],
        lowStockThreshold: String(item.lowStockThreshold),
      },
    });
  };
  const saveCatalog = (event: FormEvent) => {
    event.preventDefault();
    if (!catalogEditor) return;
    const { id, draft } = catalogEditor;
    const primaryImg =
      draft.imageUrl ||
      (draft.imageUrls && draft.imageUrls[0]) ||
      "";
    const allImgs =
      draft.imageUrls && draft.imageUrls.length > 0
        ? draft.imageUrls
        : primaryImg
          ? [primaryImg]
          : [];
    const payload: CatalogItemInput = {
      ...draft,
      imageUrl: primaryImg,
      imageUrls: allImgs,
    };
    safely(
      () =>
        id
          ? updateCatalogItemAction(id, payload)
          : createCatalogItemAction(payload),
      id
        ? "Listing updated across staff and customer views."
        : "Listing created and published.",
      () => setCatalogEditor(null),
    );
  };
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Product categories">
        {(["Gaming Gadgets", "PUBG Accounts"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={category === value}
            onClick={() => { setCategory(value); setQuery(""); setNotice(null); }}
            className={`min-h-11 rounded-full border px-4 py-2 text-xs font-bold ${category === value ? "border-black bg-black text-white" : "bg-white/60"}`}>
            {value === "Gaming Gadgets" ? "Gadget products" : "PUBG accounts"}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{category === "PUBG Accounts" ? "PUBG accounts" : "Gadget stock"}</h2>
        <button onClick={() => setCatalogEditor({ draft: { ...emptyCatalog, category,
          subcategory: category === "PUBG Accounts" ? "Starter Accounts" : emptyCatalog.subcategory,
          brand: category === "PUBG Accounts" ? "PUBG Mobile" : "",
          warrantyMonths: category === "PUBG Accounts" ? "0" : emptyCatalog.warrantyMonths } })}
          disabled={pending} className="rounded-full bg-[#c7f36b] px-5 py-3 text-xs font-bold disabled:opacity-40">
          <Plus size={15} className="mr-1.5 inline" />{category === "PUBG Accounts" ? "Add PUBG account" : "Add gadget"}
        </button>
      </div>
      <div className="card mb-4 p-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-[#f1efe8] px-3">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={category === "Gaming Gadgets" ? "Search gadgets, brand or SKU…" : "Search PUBG accounts or reference…"}
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
      </div>
      {notice && (
        <div
          role="status"
          className={`mb-3 rounded-xl border px-4 py-3 text-xs font-semibold ${notice.kind === "error" ? "border-[#ffc7b4] bg-[#fff0eb] text-[#9c3212]" : "border-[#cce99a] bg-[#f2fbdf] text-[#416c17]"}`}
        >
          {notice.text}
        </div>
      )}
      {(
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((product) => (
              <article className="card p-4" key={product.variantId}>
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={product.image}
                      alt={product.name}
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                      }}
                      className="h-14 w-14 rounded-xl object-cover bg-[#f1efe8]"
                    />
                    {product.images && product.images.length > 1 && (
                      <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-md bg-black/80 px-1 py-0.5 text-[8px] font-bold text-white shadow-xs">
                        <ImageIcon size={8} /> {product.images.length}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{product.name}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-[#77776f]">
                      {product.sku}
                    </p>
                    <p className="mt-2 text-sm font-bold">
                      {formatMMK(product.price)}
                    </p>
                  </div>
                  <span
                    className={`pill shrink-0 py-1 ${product.stock <= product.lowStockThreshold ? "bg-[#fff0eb] text-[#b5421c]" : "bg-[#effbdd] text-[#406b16]"}`}
                  >
                    {category === "PUBG Accounts" ? product.listingStatus : `${product.stock} stock`}
                  </span>
                </div>
                <div className="mt-4 flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-[11px] text-[#77776f]">
                    {product.subcategory}
                  </span>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      aria-label={`Edit ${product.name}`}
                      disabled={pending}
                      onClick={() => editCatalog(product)}
                      className="grid h-11 w-11 place-items-center rounded-xl border"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      aria-label={`Delete ${product.name}`}
                      disabled={pending}
                      onClick={() => {
                        if (
                          confirm(
                            `Remove ${product.name} from every sales surface?`,
                          )
                        )
                          safely(
                            () => deleteCatalogItemAction(product.variantId),
                            "Listing removed from all sales surfaces.",
                          );
                      }}
                      className="grid h-11 w-11 place-items-center rounded-xl border text-[#b5421c]"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!filtered.length && (
              <div className="card p-8 text-center text-sm text-[#77776f]">
                No matching listings.
              </div>
            )}
          </div>
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1060px] text-left text-sm">
              <thead className="border-b">
                <tr>
                  {[
                    "Product / variant",
                    "Category",
                    "SKU",
                    "Retail",
                    "Cost",
                    ...(category === "PUBG Accounts" ? [] : ["Stock"]),
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-[10px] uppercase tracking-wider text-[#77776f]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.variantId} className="border-b last:border-0">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={p.image}
                            alt={p.name}
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = "/placeholder.svg";
                            }}
                            className="h-12 w-12 rounded-xl object-cover bg-[#f1efe8]"
                          />
                          {p.images && p.images.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 flex items-center gap-0.5 rounded-md bg-black/80 px-1 py-0.5 text-[8px] font-bold text-white shadow-xs">
                              <ImageIcon size={8} /> {p.images.length}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold">{p.name}</p>
                          <p className="text-xs text-[#77776f]">{p.brand}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-md bg-[#f1efe8] px-2 py-1 text-[11px] font-semibold">
                        {p.subcategory}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">{p.sku}</td>
                    <td className="px-5 py-4 font-semibold">
                      {formatMMK(p.price)}
                    </td>
                    <td className="px-5 py-4 text-[#77776f]">
                      {formatMMK(p.cost)}
                    </td>
                    {category !== "PUBG Accounts" && <td className="px-5 py-4">
                      <span className="display text-xl font-bold">
                        {p.stock}
                      </span>
                    </td>}
                    <td className="px-5 py-4">
                      <span
                        className={`pill py-1 ${p.stock <= p.lowStockThreshold ? "bg-[#fff0eb] text-[#b5421c]" : "bg-[#effbdd] text-[#406b16]"}`}
                      >
                        {category !== "PUBG Accounts" && p.stock <= p.lowStockThreshold && (
                          <AlertTriangle size={12} />
                        )}{" "}
                        {category === "PUBG Accounts" ? p.listingStatus : p.stock <= p.lowStockThreshold ? "Low" : "Healthy"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <button
                          aria-label={`Edit ${p.name}`}
                          disabled={pending}
                          onClick={() => editCatalog(p)}
                          className="grid h-8 w-8 place-items-center rounded-full border"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          aria-label={`Delete ${p.name}`}
                          disabled={pending}
                          onClick={() => {
                            if (
                              confirm(
                                `Remove ${p.name} from every sales surface?`,
                              )
                            )
                              safely(
                                () => deleteCatalogItemAction(p.variantId),
                                "Listing removed from all sales surfaces.",
                              );
                          }}
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
            {!filtered.length && (
              <p className="p-10 text-center text-sm text-[#77776f]">
                No matching listings.
              </p>
            )}
          </div>
        </>
      )}

      {catalogEditor && (
        <Modal
          title={
            catalogEditor.id
              ? catalogEditor.draft.category === "PUBG Accounts"
                ? "Edit PUBG Account"
                : "Edit Gadget Product"
              : catalogEditor.draft.category === "PUBG Accounts"
                ? "Add PUBG Account"
                : "Add Gadget Product"
          }
          subtitle={
            catalogEditor.draft.category === "PUBG Accounts"
              ? "Digital account specifications, verification screenshots, and pricing"
              : "Physical gadget inventory details, pricing, warranty, and image"
          }
          onClose={() => setCatalogEditor(null)}
        >
          <form onSubmit={saveCatalog}>
            <div className="grid gap-4 md:grid-cols-2">
              {category === "PUBG Accounts" && <>
                <Field label="Sale status"><select className={inputClass} value={catalogEditor.draft.listingStatus}
                  disabled={catalogEditor.draft.listingStatus === "reserved"}
                  onChange={(e) => setCatalogEditor({ ...catalogEditor, draft: { ...catalogEditor.draft, listingStatus: e.target.value as CatalogDraft['listingStatus'] } })}>
                  <option value="available">Available</option><option value="reserved" disabled>Reserved by an order</option><option value="sold">Sold</option><option value="withdrawn">Withdrawn</option>
                </select></Field>
              </>}
              <Field label="Name">
                <input
                  required
                  maxLength={180}
                  className={inputClass}
                  value={catalogEditor.draft.name}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: { ...catalogEditor.draft, name: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="SKU">
                <input
                  required
                  pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,79}"
                  className={inputClass}
                  value={catalogEditor.draft.sku}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: {
                        ...catalogEditor.draft,
                        sku: e.target.value.toUpperCase(),
                      },
                    })
                  }
                />
              </Field>
              <Field label="Category">
                <select
                  disabled
                  className={inputClass}
                  value={catalogEditor.draft.category}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: {
                        ...catalogEditor.draft,
                        category: e.target.value as CatalogDraft["category"],
                        stockQuantity: "0",
                      },
                    })
                  }
                >
                  <option>Gaming Gadgets</option>
                  <option>PUBG Accounts</option>
                </select>
              </Field>
              <Field label="Subcategory">
                <input
                  required
                  className={inputClass}
                  value={catalogEditor.draft.subcategory}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: {
                        ...catalogEditor.draft,
                        subcategory: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label="Brand">
                <input
                  required
                  className={inputClass}
                  value={catalogEditor.draft.brand}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: { ...catalogEditor.draft, brand: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Retail price (MMK)">
                <input
                  required
                  min="0"
                  type="number"
                  className={inputClass}
                  value={catalogEditor.draft.price}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: { ...catalogEditor.draft, price: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Cost price (MMK)">
                <input
                  required
                  min="0"
                  type="number"
                  className={inputClass}
                  value={catalogEditor.draft.costPrice}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: {
                        ...catalogEditor.draft,
                        costPrice: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              {category !== "PUBG Accounts" && <>
              <Field label="Stock quantity">
                <input
                  required
                  disabled={catalogEditor.draft.category === "PUBG Accounts"}
                  min="0"
                  type="number"
                  className={inputClass}
                  value={catalogEditor.draft.stockQuantity}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: {
                        ...catalogEditor.draft,
                        stockQuantity: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label="Low-stock alert at">
                <input
                  required
                  min="0"
                  type="number"
                  className={inputClass}
                  value={catalogEditor.draft.lowStockThreshold}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: {
                        ...catalogEditor.draft,
                        lowStockThreshold: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              </>}
              <Field label="Warranty months">
                <input
                  required
                  min="0"
                  max="120"
                  type="number"
                  className={inputClass}
                  value={catalogEditor.draft.warrantyMonths}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: {
                        ...catalogEditor.draft,
                        warrantyMonths: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label="Color / region">
                <input
                  className={inputClass}
                  value={catalogEditor.draft.color}
                  onChange={(e) =>
                    setCatalogEditor({
                      ...catalogEditor,
                      draft: { ...catalogEditor.draft, color: e.target.value },
                    })
                  }
                />
              </Field>
              <div className="md:col-span-2">
                {catalogEditor.draft.category === "PUBG Accounts" ? (
                  <ImageUpload
                    mode="multiple"
                    label="PUBG Account Screenshots"
                    hint="Upload multiple screenshots of the account (Lobby, RP, Gun Skins, Outfits, Stats). The first screenshot is the cover photo."
                    value={catalogEditor.draft.imageUrls || []}
                    onChange={(urls: string[]) => {
                      setCatalogEditor({
                        ...catalogEditor,
                        draft: {
                          ...catalogEditor.draft,
                          imageUrls: urls,
                          imageUrl: urls[0] || "",
                        },
                      });
                    }}
                  />
                ) : (
                  <ImageUpload
                    mode="single"
                    label="Gadget Product Image"
                    hint="Upload an authentic photo of the gadget or product packaging."
                    value={catalogEditor.draft.imageUrl || ""}
                    onChange={(url: string) => {
                      setCatalogEditor({
                        ...catalogEditor,
                        draft: {
                          ...catalogEditor.draft,
                          imageUrl: url,
                          imageUrls: url ? [url] : [],
                        },
                      });
                    }}
                  />
                )}
              </div>
              <div className="md:col-span-2">
                <Field label="Description">
                  <textarea
                    maxLength={1000}
                    className="min-h-24 w-full rounded-xl border p-3 text-sm"
                    value={catalogEditor.draft.description}
                    onChange={(e) =>
                      setCatalogEditor({
                        ...catalogEditor,
                        draft: {
                          ...catalogEditor.draft,
                          description: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t border-[#eee] pt-4">
              <button
                type="button"
                onClick={() => setCatalogEditor(null)}
                className="rounded-xl border border-[#dedbd1] px-5 py-2.5 text-xs font-bold text-[#555] hover:bg-[#f1efe8] transition min-h-[42px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="rounded-xl bg-black px-6 py-2.5 text-xs font-bold text-white hover:bg-black/80 disabled:opacity-40 shadow-sm transition min-h-[42px]"
              >
                {pending
                  ? "Saving…"
                  : catalogEditor.id
                    ? "Save changes"
                    : "Create listing"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
