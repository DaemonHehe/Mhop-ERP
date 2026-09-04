"use client";

import Link from "next/link";
import {
  LoaderCircle,
  Package,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  globalSearchAction,
  type GlobalSearchResult,
} from "@/app/actions/store";

const resultIcons = {
  Product: Package,
  Order: ShoppingBag,
  Customer: UserRound,
} as const;

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setError("");
  };

  const closeMobileSearch = () => {
    setMobileOpen(false);
    setOpen(false);
    clearSearch();
  };

  const openMobileSearch = () => {
    setMobileOpen(true);
    setOpen(true);
    window.setTimeout(() => mobileInputRef.current?.focus(), 0);
  };

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (window.matchMedia("(max-width: 767px)").matches) {
          setMobileOpen(true);
          setOpen(true);
          window.setTimeout(() => mobileInputRef.current?.focus(), 0);
        } else {
          desktopInputRef.current?.focus();
          setOpen(true);
        }
      }
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const cleanQuery = query.trim();
    const currentRequest = ++requestId.current;

    if (cleanQuery.length < 2) {
      setResults([]);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const timer = window.setTimeout(async () => {
      try {
        const response = await globalSearchAction(cleanQuery);
        if (requestId.current !== currentRequest) return;
        if (response.ok) {
          setResults(response.data);
        } else {
          setResults([]);
          setError(response.error);
        }
      } catch {
        if (requestId.current !== currentRequest) return;
        setResults([]);
        setError("Search is temporarily unavailable. Try again.");
      } finally {
        if (requestId.current === currentRequest) setLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [query]);

  const hasQuery = query.trim().length >= 2;

  return (
    <>
      <button
        type="button"
        aria-label="Open workspace search"
        onClick={openMobileSearch}
        className="grid h-11 w-11 place-items-center rounded-xl border border-white/80 bg-white/45 shadow-[inset_1px_1px_3px_rgba(75,73,61,.08),inset_-1px_-1px_2px_white] md:hidden"
      >
        <Search size={17} />
      </button>
      <div
        className="relative hidden w-[18rem] md:block lg:w-[20rem] xl:w-[24rem]"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
      >
        <div className="global-search-shell flex h-9 items-center gap-2 px-3">
          <Search size={15} className="shrink-0 text-[#77776f]" />
          <input
            ref={desktopInputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                event.currentTarget.blur();
              }
            }}
            role="combobox"
            aria-label="Search products, orders, and customers"
            aria-expanded={open && hasQuery}
            aria-controls="global-search-results"
            aria-autocomplete="list"
            placeholder="Search workspace"
            className="global-search-input h-full min-w-0 flex-1 text-[13px] outline-none"
          />
          {loading ? (
            <LoaderCircle
              aria-label="Searching"
              size={14}
              className="shrink-0 animate-spin text-[#77776f]"
            />
          ) : query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                clearSearch();
                desktopInputRef.current?.focus();
              }}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#77776f] hover:bg-black/[.05] hover:text-black"
            >
              <X size={13} />
            </button>
          ) : (
            <kbd className="rounded-md border border-black/[.07] bg-white/55 px-1.5 py-0.5 font-sans text-[9px] font-bold text-[#85867d] shadow-[inset_0_1px_white]">
              Ctrl K
            </kbd>
          )}
        </div>

        {open && hasQuery && (
          <div
            id="global-search-results"
            role="listbox"
            className="absolute left-0 top-[calc(100%+.65rem)] w-[min(30rem,calc(100vw-2rem))] max-h-[min(70vh,30rem)] overflow-y-auto rounded-2xl border border-white/85 bg-[#f8f7f1]/95 p-2 shadow-[0_18px_50px_rgba(44,43,36,.18),inset_0_1px_white] backdrop-blur-2xl"
          >
            {error ? (
              <p
                role="alert"
                className="px-4 py-5 text-center text-xs text-[#a43b1b]"
              >
                {error}
              </p>
            ) : !loading && results.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-[#77776f]">
                No products, orders, or customers match “{query.trim()}”.
              </p>
            ) : (
              results.map((result) => {
                const Icon = resultIcons[result.type];
                return (
                  <Link
                    key={`${result.type}-${result.id}`}
                    href={result.href}
                    role="option"
                    aria-selected="false"
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                    }}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-white/80 focus:bg-white focus:outline-none"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/90 bg-[#eeece4] shadow-[inset_0_1px_white]">
                      <Icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {result.label}
                      </span>
                      <span className="block truncate text-[11px] text-[#77776f]">
                        {result.meta}
                      </span>
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-[.12em] text-[#92938a]">
                      {result.type}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </div>

      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search workspace"
          className="fixed inset-0 z-[80] flex flex-col bg-[#ecebe4]/95 p-4 backdrop-blur-2xl md:hidden"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">MH OP Operations</p>
              <p className="display mt-1 text-xl font-bold">Search workspace</p>
            </div>
            <button
              type="button"
              aria-label="Close search"
              onClick={closeMobileSearch}
              className="grid h-11 w-11 place-items-center rounded-xl border border-white/80 bg-white/55"
            >
              <X size={18} />
            </button>
          </div>
          <div className="global-search-shell mt-5 flex h-12 items-center gap-3 px-4">
            <Search size={17} className="shrink-0 text-[#77776f]" />
            <input
              ref={mobileInputRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              role="combobox"
              aria-label="Search products, orders, and customers"
              aria-expanded={hasQuery}
              aria-controls="mobile-global-search-results"
              aria-autocomplete="list"
              placeholder="Product, order or customer"
              className="global-search-input h-full min-w-0 flex-1 text-base outline-none"
            />
            {loading ? (
              <LoaderCircle size={16} className="animate-spin text-[#77776f]" />
            ) : query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  clearSearch();
                  mobileInputRef.current?.focus();
                }}
                className="grid h-8 w-8 place-items-center rounded-lg"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>
          {hasQuery ? (
            <div
              id="mobile-global-search-results"
              role="listbox"
              className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/80 bg-white/45 p-2 shadow-[inset_0_1px_white]"
            >
              {error ? (
                <p
                  role="alert"
                  className="px-4 py-8 text-center text-xs text-[#a43b1b]"
                >
                  {error}
                </p>
              ) : !loading && results.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-[#77776f]">
                  No products, orders, or customers match “{query.trim()}”.
                </p>
              ) : (
                results.map((result) => {
                  const Icon = resultIcons[result.type];
                  return (
                    <Link
                      key={`mobile-${result.type}-${result.id}`}
                      href={result.href}
                      role="option"
                      aria-selected="false"
                      onClick={closeMobileSearch}
                      className="flex min-h-14 items-center gap-3 rounded-xl px-3 py-2.5 active:bg-white/80"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white bg-[#eeece4] shadow-[inset_0_1px_white]">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">
                          {result.label}
                        </span>
                        <span className="block truncate text-[11px] text-[#77776f]">
                          {result.meta}
                        </span>
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#92938a]">
                        {result.type}
                      </span>
                    </Link>
                  );
                })
              )}
            </div>
          ) : (
            <p className="mt-8 px-6 text-center text-xs leading-5 text-[#77776f]">
              Search products and SKUs, order codes, customer names, or phone
              numbers.
            </p>
          )}
        </div>
      )}
    </>
  );
}
