"use client";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Image as ImageIcon,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { ModalPortal } from "@/components/modal-portal";
import { formatMMK, CANONICAL_SUBCATEGORIES } from "@/lib/data";
import { ImageUpload } from "@/components/image-upload";
import type {
  CatalogItemInput,
  InventoryItem,
} from "@/app/actions/store";
import {
  createCatalogItemAction,
  deleteCatalogItemAction,
  reorderProductsAction,
  updateCatalogItemAction,
} from "@/app/actions/store";

export { CANONICAL_SUBCATEGORIES };

type CatalogDraft = {
  name: string;
  brand: string;
  category: "Gaming Gadgets" | "PUBG Accounts" | "Preorder Items";
  subcategory: string;
  waitingTime: string;
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
  waitingTime: "",
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
  const router = useRouter();
  const [itemList, setItemList] = useState<InventoryItem[]>(items);
  useEffect(() => {
    setItemList(items);
  }, [items]);

  const [category, setCategory] = useState<CatalogDraft["category"]>("Gaming Gadgets");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("All");
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
  const [customSubcategoryMode, setCustomSubcategoryMode] = useState(false);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [reorderItems, setReorderItems] = useState<InventoryItem[]>([]);
  const [isReorderingSaving, setIsReorderingSaving] = useState(false);

  const currentCategorySubcategories = useMemo(() => {
    const canonical = CANONICAL_SUBCATEGORIES[category] || [];
    const fromItems = Array.from(
      new Set(
        itemList
          .filter((p) => p.category === category && p.subcategory)
          .map((p) => p.subcategory.trim()),
      ),
    );
    return Array.from(new Set([...canonical, ...fromItems]));
  }, [category, itemList]);

  const editorSubcategoryOptions = useMemo(() => {
    if (!catalogEditor) return [];
    const cat = catalogEditor.draft.category;
    const canonical = CANONICAL_SUBCATEGORIES[cat] || [];
    const fromItems = Array.from(
      new Set(
        itemList
          .filter((p) => p.category === cat && p.subcategory)
          .map((p) => p.subcategory.trim()),
      ),
    );
    return Array.from(new Set([...canonical, ...fromItems]));
  }, [catalogEditor, itemList]);

  const filtered = useMemo(
    () =>
      itemList.filter((p) => {
        const matchesCategory = p.category === category;
        const matchesSubcategory =
          subCategoryFilter === "All" || p.subcategory === subCategoryFilter;
        const matchesQuery =
          `${p.name} ${p.sku} ${p.brand} ${p.category} ${p.subcategory}`
            .toLowerCase()
            .includes(query.toLowerCase());
        return matchesCategory && matchesSubcategory && matchesQuery;
      }),
    [itemList, query, category, subCategoryFilter],
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
        if (result.ok) {
          close?.();
          router.refresh();
        }
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
    const canonical =
      CANONICAL_SUBCATEGORIES[item.category as CatalogDraft["category"]] || [];
    setCustomSubcategoryMode(!canonical.includes(item.subcategory));

    setCatalogEditor({
      id: item.variantId,
      draft: {
        name: item.name,
        brand: item.brand,
        category: item.category as CatalogDraft["category"],
        subcategory: item.subcategory,
        waitingTime: item.waitingTime || "",
        description: item.description,
        imageUrl: rawImage,
        imageUrls: initialImages,
        sku: item.sku,
        color: item.color || "",
        price: String(item.price),
        costPrice: String(item.cost),
        warrantyMonths: String(item.warranty),
        stockQuantity:
          item.category === "Gaming Gadgets" ? String(item.stock) : "0",
        listingStatus: (item.listingStatus || "available") as CatalogDraft["listingStatus"],
        lowStockThreshold:
          item.category === "Gaming Gadgets" ? String(item.lowStockThreshold) : "0",
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

    // Optimistically update existing item
    if (id) {
      setItemList((prev) =>
        prev.map((item) =>
          item.variantId === id
            ? {
                ...item,
                name: draft.name,
                brand: draft.brand,
                category: draft.category,
                subcategory: draft.subcategory,
                waitingTime: draft.waitingTime || null,
                description: draft.description || "",
                image: primaryImg || item.image,
                images: allImgs,
                sku: draft.sku,
                color: draft.color || null,
                price: Number(draft.price),
                cost: Number(draft.costPrice),
                warranty: Number(draft.warrantyMonths),
                stock:
                  draft.category === "Gaming Gadgets"
                    ? Number(draft.stockQuantity)
                    : 0,
                lowStockThreshold:
                  draft.category === "Gaming Gadgets"
                    ? Number(draft.lowStockThreshold)
                    : 0,
                listingStatus: draft.listingStatus,
              }
            : item,
        ),
      );
    }

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

  const removeListing = (product: InventoryItem) => {
    if (confirm(`Remove ${product.name} from every sales surface?`)) {
      setItemList((prev) => prev.filter((item) => item.variantId !== product.variantId));
      safely(
        () => deleteCatalogItemAction(product.variantId),
        "Listing removed from all sales surfaces.",
      );
    }
  };

  const openReorderModal = () => {
    const seen = new Set<string>();
    const list: InventoryItem[] = [];
    for (const item of itemList) {
      if (item.category === category && !seen.has(item.id)) {
        seen.add(item.id);
        list.push(item);
      }
    }
    setReorderItems(list);
    setReorderModalOpen(true);
  };

  const moveReorderItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= reorderItems.length) return;
    setReorderItems((prev) => {
      const next = [...prev];
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  };

  const handleSaveReorder = async () => {
    setIsReorderingSaving(true);
    const orderedIds = reorderItems.map((p) => p.id);

    // Optimistically update itemList state
    const orderMap = new Map<string, number>();
    orderedIds.forEach((id, idx) => orderMap.set(id, idx));

    setItemList((prev) => {
      const next = [...prev];
      next.sort((a, b) => {
        const orderA = orderMap.has(a.id)
          ? orderMap.get(a.id)!
          : (a.sortOrder ?? 9999);
        const orderB = orderMap.has(b.id)
          ? orderMap.get(b.id)!
          : (b.sortOrder ?? 9999);
        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name);
      });
      return next;
    });

    try {
      const result = await reorderProductsAction(orderedIds);
      if (result.ok) {
        showResult(
          result,
          "Display order saved successfully. Storefront updated!",
        );
        setReorderModalOpen(false);
        router.refresh();
      } else {
        showResult(result, "");
      }
    } catch {
      setNotice({
        kind: "error",
        text: "Failed to save reordering. Please try again.",
      });
    } finally {
      setIsReorderingSaving(false);
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2" aria-label="Product categories">
        {(["Gaming Gadgets", "PUBG Accounts", "Preorder Items"] as const).map((value) => (
          <button key={value} type="button" aria-pressed={category === value}
            onClick={() => { setCategory(value); setSubCategoryFilter("All"); setQuery(""); setNotice(null); }}
            className={`min-h-11 rounded-full border px-4 py-2 text-xs font-bold transition ${category === value ? "border-black bg-black text-white" : "bg-white/60 text-[#555] hover:bg-white"}`}>
            {value === "Gaming Gadgets" ? "Gadget products" : value === "PUBG Accounts" ? "PUBG accounts" : "Preorder items"}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5" aria-label="Subcategory filters">
        {["All", ...currentCategorySubcategories].map((sub) => (
          <button
            key={sub}
            type="button"
            aria-pressed={subCategoryFilter === sub}
            onClick={() => setSubCategoryFilter(sub)}
            className={`min-h-9 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              subCategoryFilter === sub
                ? "border-black bg-black text-white"
                : "border-[#dedbd1] bg-[#fffef9] text-[#555] hover:bg-[#f1efe8]"
            }`}
          >
            {sub}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {category === "PUBG Accounts"
            ? "PUBG accounts"
            : category === "Preorder Items"
              ? "Preorder items"
              : "Gadget stock"}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openReorderModal}
            className="flex items-center gap-1.5 rounded-full border border-[#dcd9cf] bg-white px-4 py-2.5 text-xs font-bold text-[#333] shadow-2xs transition hover:border-black hover:bg-[#f2efe8] active:scale-95"
            title="Custom sort the display order for the storefront"
          >
            <ArrowUpDown size={14} className="text-[#666]" />
            <span>
              Reorder{" "}
              {category === "Gaming Gadgets"
                ? "gadgets"
                : category === "Preorder Items"
                  ? "preorders"
                  : "accounts"}
            </span>
          </button>
          <button
            onClick={() => {
              setCustomSubcategoryMode(false);
              setCatalogEditor({
                draft: {
                  ...emptyCatalog,
                  category,
                  subcategory:
                    category === "PUBG Accounts"
                      ? "Starter Accounts"
                      : category === "Preorder Items"
                        ? "Upcoming Releases"
                        : emptyCatalog.subcategory,
                  brand: category === "PUBG Accounts" ? "PUBG Mobile" : "",
                  waitingTime: category === "Preorder Items" ? "7-14 business days" : "",
                  stockQuantity: "0",
                  lowStockThreshold: "0",
                  warrantyMonths: category === "PUBG Accounts" ? "0" : emptyCatalog.warrantyMonths,
                },
              });
            }}
            disabled={pending}
            className="rounded-full bg-[#c7f36b] px-5 py-2.5 text-xs font-bold text-black transition hover:bg-[#b8e65a] disabled:opacity-40"
          >
            <Plus size={15} className="mr-1.5 inline" />
            {category === "PUBG Accounts"
              ? "Add PUBG account"
              : category === "Preorder Items"
                ? "Add preorder item"
                : "Add gadget"}
          </button>
        </div>
      </div>
      <div className="card mb-4 p-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-[#f1efe8] px-3">
          <Search size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              category === "Gaming Gadgets"
                ? "Search gadgets, brand or SKU…"
                : category === "Preorder Items"
                  ? "Search preorder items, brand or SKU…"
                  : "Search PUBG accounts or reference…"
            }
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
            {filtered.map((product, index) => (
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
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-[#f1efe8] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#666]">
                        #{product.sortOrder !== undefined ? product.sortOrder + 1 : index + 1}
                      </span>
                      <p className="truncate font-bold">{product.name}</p>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-[#77776f]">
                      {product.sku}
                    </p>
                    <p className="mt-2 text-sm font-bold">
                      {formatMMK(product.price)}
                    </p>
                    {product.description && (
                      <p className="mt-1.5 text-xs text-[#777] line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>
                  <span
                    className={`pill shrink-0 py-1 ${
                      category === "Preorder Items"
                        ? "bg-[#e8f2fc] text-[#1c55b5]"
                        : product.stock <= product.lowStockThreshold
                          ? "bg-[#fff0eb] text-[#b5421c]"
                          : "bg-[#effbdd] text-[#406b16]"
                    }`}
                  >
                    {category === "PUBG Accounts"
                      ? product.listingStatus
                      : category === "Preorder Items"
                        ? `Preorder · ${product.waitingTime || "7-14 days"}`
                        : `${product.stock} stock`}
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
                      onClick={() => removeListing(product)}
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
                    "#",
                    "Product / variant",
                    "Subcategory",
                    "SKU",
                    "Retail",
                    "Cost",
                    ...(category === "Gaming Gadgets"
                      ? ["Stock"]
                      : category === "Preorder Items"
                        ? ["Waiting time"]
                        : []),
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-[10px] uppercase tracking-wider text-[#77776f]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, index) => (
                  <tr key={p.variantId} className="border-b last:border-0">
                    <td className="px-4 py-4 font-mono text-xs font-bold text-[#888]">
                      #{p.sortOrder !== undefined ? p.sortOrder + 1 : index + 1}
                    </td>
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
                        <div className="min-w-0 max-w-xs sm:max-w-sm">
                          <p className="font-bold truncate">{p.name}</p>
                          <p className="text-xs text-[#77776f]">{p.brand}</p>
                          {p.description && (
                            <p className="mt-1 text-xs text-[#888] line-clamp-1 italic" title={p.description}>
                              {p.description}
                            </p>
                          )}
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
                    {category === "Gaming Gadgets" && (
                      <td className="px-5 py-4">
                        <span className="display text-xl font-bold">
                          {p.stock}
                        </span>
                      </td>
                    )}
                    {category === "Preorder Items" && (
                      <td className="px-5 py-4">
                        <span className="font-semibold text-xs text-[#1c55b5] bg-[#e8f2fc] px-2.5 py-1 rounded-md">
                          ⏳ {p.waitingTime || "7-14 days"}
                        </span>
                      </td>
                    )}
                    <td className="px-5 py-4">
                      <span
                        className={`pill py-1 ${
                          category === "Preorder Items"
                            ? p.listingStatus === "withdrawn"
                              ? "bg-[#fff0eb] text-[#b5421c]"
                              : "bg-[#effbdd] text-[#406b16]"
                            : p.stock <= p.lowStockThreshold
                              ? "bg-[#fff0eb] text-[#b5421c]"
                              : "bg-[#effbdd] text-[#406b16]"
                        }`}
                      >
                        {category === "Gaming Gadgets" &&
                          p.stock <= p.lowStockThreshold && (
                            <AlertTriangle size={12} />
                          )}{" "}
                        {category === "PUBG Accounts"
                          ? p.listingStatus
                          : category === "Preorder Items"
                            ? p.listingStatus === "withdrawn"
                              ? "Withdrawn"
                              : "Preorder Open"
                            : p.stock <= p.lowStockThreshold
                              ? "Low"
                              : "Healthy"}
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
                          onClick={() => removeListing(p)}
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
                : catalogEditor.draft.category === "Preorder Items"
                  ? "Edit Preorder Item"
                  : "Edit Gadget Product"
              : catalogEditor.draft.category === "PUBG Accounts"
                ? "Add PUBG Account"
                : catalogEditor.draft.category === "Preorder Items"
                  ? "Add Preorder Item"
                  : "Add Gadget Product"
          }
          subtitle={
            catalogEditor.draft.category === "PUBG Accounts"
              ? "Digital account specifications, verification screenshots, and pricing"
              : catalogEditor.draft.category === "Preorder Items"
                ? "Preorder catalog listing, customer waiting time, pricing, and specs"
                : "Physical gadget inventory details, pricing, warranty, and photos"
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
                  <option>Preorder Items</option>
                </select>
              </Field>
              {catalogEditor.draft.category === "Preorder Items" && (
                <Field label="Estimated waiting time">
                  <input
                    required
                    maxLength={80}
                    placeholder="e.g. 7-14 business days, 2-3 weeks"
                    className={inputClass}
                    value={catalogEditor.draft.waitingTime || ""}
                    onChange={(e) =>
                      setCatalogEditor({
                        ...catalogEditor,
                        draft: {
                          ...catalogEditor.draft,
                          waitingTime: e.target.value,
                        },
                      })
                    }
                  />
                </Field>
              )}
              <Field label="Subcategory">
                <div className="space-y-2">
                  <select
                    className={inputClass}
                    value={
                      customSubcategoryMode ||
                      !editorSubcategoryOptions.includes(catalogEditor.draft.subcategory)
                        ? "__custom__"
                        : catalogEditor.draft.subcategory
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "__custom__") {
                        setCustomSubcategoryMode(true);
                      } else {
                        setCustomSubcategoryMode(false);
                        setCatalogEditor({
                          ...catalogEditor,
                          draft: {
                            ...catalogEditor.draft,
                            subcategory: val,
                          },
                        });
                      }
                    }}
                  >
                    {editorSubcategoryOptions.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                    <option value="__custom__">+ Custom subcategory...</option>
                  </select>
                  {(customSubcategoryMode ||
                    !editorSubcategoryOptions.includes(
                      catalogEditor.draft.subcategory,
                    )) && (
                    <input
                      required
                      placeholder="Enter custom subcategory"
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
                  )}
                </div>
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
              {catalogEditor.draft.category === "Gaming Gadgets" && (
                <>
                  <Field label="Stock quantity">
                    <input
                      required
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
                </>
              )}
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
                <ImageUpload
                  mode="multiple"
                  label={
                    catalogEditor.draft.category === "PUBG Accounts"
                      ? "PUBG Account Screenshots"
                      : catalogEditor.draft.category === "Preorder Items"
                        ? "Preorder Product Photos"
                        : "Gadget Product Photos"
                  }
                  hint={
                    catalogEditor.draft.category === "PUBG Accounts"
                      ? "Upload multiple screenshots of the account (Lobby, RP, Gun Skins, Outfits, Stats). The first screenshot is the cover photo."
                      : catalogEditor.draft.category === "Preorder Items"
                        ? "Upload photos of the preorder product. The first photo is the cover image."
                        : "Upload one or more authentic photos of the gadget, packaging, and accessories. The first photo is the cover image."
                  }
                  value={
                    catalogEditor.draft.imageUrls && catalogEditor.draft.imageUrls.length > 0
                      ? catalogEditor.draft.imageUrls
                      : catalogEditor.draft.imageUrl
                        ? [catalogEditor.draft.imageUrl]
                        : []
                  }
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
      {reorderModalOpen && (
        <Modal
          title={`Reorder ${category === "Gaming Gadgets" ? "Gadgets" : category === "Preorder Items" ? "Preorder Items" : "PUBG Accounts"}`}
          subtitle="Arrange products in the exact order you want customers to see them on the storefront. Lower ranks appear first."
          onClose={() => setReorderModalOpen(false)}
        >
          <div className="space-y-4">
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {reorderItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#dcd9cf] p-8 text-center text-xs text-[#777]">
                  No products available in this category to reorder.
                </div>
              ) : (
                reorderItems.map((item, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === reorderItems.length - 1;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#dedbd1] bg-white p-3 sm:p-3.5 shadow-2xs transition hover:border-[#aaa]"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f1efe8] font-mono text-xs font-black text-[#333]">
                          #{idx + 1}
                        </span>
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-11 w-11 shrink-0 rounded-xl object-cover bg-[#f5f4ef]"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src =
                              "/placeholder.svg";
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs sm:text-sm font-bold text-[#1f1f1d]">
                            {item.name}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#777]">
                            <span className="font-semibold">{item.brand}</span>
                            <span>•</span>
                            <span className="rounded bg-[#f1efe8] px-1.5 py-0.5 text-[10px] font-medium">
                              {item.subcategory}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-black">
                              {formatMMK(item.price)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => moveReorderItem(idx, idx - 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dcd9cf] bg-[#faf9f6] text-[#444] transition hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[#dcd9cf] disabled:hover:bg-[#faf9f6] disabled:hover:text-[#444]"
                          title="Move Up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => moveReorderItem(idx, idx + 1)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#dcd9cf] bg-[#faf9f6] text-[#444] transition hover:border-black hover:bg-black hover:text-white disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-[#dcd9cf] disabled:hover:bg-[#faf9f6] disabled:hover:text-[#444]"
                          title="Move Down"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => moveReorderItem(idx, 0)}
                          className="hidden sm:inline-flex rounded-lg border border-[#dcd9cf] bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#555] transition hover:bg-[#f1efe8] disabled:cursor-not-allowed disabled:opacity-30"
                          title="Move to Top"
                        >
                          Top
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#eee] pt-4">
              <p className="text-xs text-[#777]">
                {reorderItems.length} products to arrange
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReorderModalOpen(false)}
                  className="rounded-xl border border-[#dedbd1] px-4 py-2 text-xs font-bold text-[#555] transition hover:bg-[#f1efe8]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isReorderingSaving || reorderItems.length === 0}
                  onClick={handleSaveReorder}
                  className="flex items-center gap-1.5 rounded-xl bg-black px-5 py-2 text-xs font-bold text-white transition hover:bg-[#222] disabled:opacity-50"
                >
                  {isReorderingSaving ? "Saving..." : "Save Order"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
