"use client";

import { brandAssets } from "@/lib/brand-assets";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Download, Printer } from "lucide-react";
import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import { clientConfig } from "@/lib/client-config";
import { formatMMK } from "@/lib/data";
import type { ReceiptOrder } from "@/app/actions/store";

export function ReceiptBuilder({ orders }: { orders: ReceiptOrder[] }) {
  const [paper, setPaper] = useState<"voucher" | 58 | 80>("voucher");
  const [selectedId, setSelectedId] = useState(orders[0]?.id || "");
  const order = orders.find((item) => item.id === selectedId) || orders[0];
  if (!order)
    return (
      <div className="card p-10 text-center">
        <p className="display text-xl font-bold">No receipts yet</p>
        <p className="mt-2 text-sm text-[#77776f]">
          Create an order first. It will appear here automatically.
        </p>
      </div>
    );

  return (
    <div className="receipt-print-root grid gap-4 xl:grid-cols-[300px_1fr]">
      <div className="card h-fit p-5 no-print">
        <p className="eyebrow">Print configuration</p>
        <h2 className="display mt-1 text-xl font-bold">Receipt setup</h2>
        <label className="mt-6 block text-xs font-bold" htmlFor="receipt-order">
          Order
        </label>
        <select
          id="receipt-order"
          value={order.id}
          onChange={(event) => setSelectedId(event.target.value)}
          className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm font-semibold"
        >
          {orders.map((item) => (
            <option key={item.id} value={item.id}>
              {item.code} · {item.customer} · {formatMMK(item.total)}
            </option>
          ))}
        </select>
        <div className="mt-5">
          <label className="text-xs font-bold">Receipt format</label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              ["voucher", "Voucher", "Print / PDF"],
              [80, "80mm", "Thermal"],
              [58, "58mm", "Thermal"],
            ].map(([value, label, detail]) => (
              <button
                type="button"
                key={value}
                onClick={() => setPaper(value as "voucher" | 58 | 80)}
                className={`min-w-0 rounded-xl border p-3 text-left ${paper === value ? "border-black bg-black text-white" : ""}`}
              >
                <p className="display truncate text-lg font-bold">{label}</p>
                <p className="mt-1 text-[9px] opacity-60">{detail}</p>
              </button>
            ))}
          </div>
        </div>
        {[
          ["Customer", `${order.customer} · ${order.phone}`],
          ["Payment", `${order.paymentMethod} · ${title(order.paymentStatus)}`],
          ["Courier", order.carrier],
        ].map(([key, value]) => (
          <div key={key} className="mt-4">
            <label className="text-xs font-bold">{key}</label>
            <div className="mt-1 rounded-xl border bg-[#f7f5ef] px-3 py-2.5 text-sm">
              {value}
            </div>
          </div>
        ))}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={() => window.print()}
            className="rounded-xl bg-black py-3 text-xs font-bold text-white"
          >
            <Printer size={14} className="mr-1 inline" /> Print
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-xl border py-3 text-xs font-bold"
          >
            <Download size={14} className="mr-1 inline" /> Save PDF
          </button>
        </div>
      </div>
      <div className="receipt-stage flex justify-center overflow-x-auto rounded-2xl bg-[#d9d6cd] p-2 sm:p-5 md:p-8">
        <Receipt paper={paper} order={order} />
      </div>
    </div>
  );
}

const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function Barcode({ code }: { code: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current)
      JsBarcode(ref.current, code, {
        format: "CODE128",
        displayValue: true,
        fontSize: 9,
        height: 38,
        margin: 0,
        width: 1.25,
      });
  }, [code]);
  return (
    <svg
      ref={ref}
      className="mt-3 max-w-full"
      aria-label={`Barcode for ${code}`}
    />
  );
}

function PaymentQR({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current)
      void QRCode.toCanvas(
        ref.current,
        `${window.location.origin}/orders?code=${encodeURIComponent(code)}`,
        { width: 84, margin: 1, errorCorrectionLevel: "M" },
      );
  }, [code]);
  return (
    <canvas
      ref={ref}
      className="mx-auto h-[84px] w-[84px]"
      aria-label="Order reference QR code"
    />
  );
}

function Receipt({
  paper,
  order,
}: {
  paper: "voucher" | 58 | 80;
  order: ReceiptOrder;
}) {
  if (paper === "voucher") return <VoucherReceipt order={order} />;
  return <ThermalReceipt paper={paper} order={order} />;
}

function VoucherReceipt({ order }: { order: ReceiptOrder }) {
  const receipt = clientConfig.receipt;
  const number = new Intl.NumberFormat("en-US");
  const date = new Date(order.createdAt);
  const paymentComplete = order.outstandingBalance <= 0;
  const paymentLabel =
    order.paymentMethod.toLowerCase() === "kbzpay"
      ? "KPay"
      : title(order.paymentMethod);
  return (
    <article className="receipt-document receipt-voucher relative w-full max-w-[780px] overflow-hidden bg-white text-[11px] text-[#20221d] shadow-2xl">
      <div className="h-2 bg-[#252a20]" />
      <div className="p-5 sm:p-9">
        <header className="grid gap-5 border-b-2 border-[#252a20] pb-6 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="flex items-center gap-3.5">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-black/15 shadow-sm">
              <Image
                src={brandAssets.logo}
                alt="MH OP"
                fill
                sizes="44px"
                className="object-cover"
              />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-[-0.035em] text-[#171914] sm:text-2xl">
                {receipt.storeName}
              </h2>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#707469]">
                Mobile gaming one stop service
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#73776d]">
              Official sales document
            </p>
            <p className="mt-1 font-sans text-xl font-black text-[#20221d]">
              {receipt.voucherTitle}
            </p>
            <p className="mt-1 font-mono text-[10px] font-bold tracking-wide">
              {order.code}
            </p>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[9px] text-[#666a60]">
          <span>
            <b className="text-[#292c26]">Telegram</b> {receipt.telegram}
          </span>
          <span>
            <b className="text-[#292c26]">Viber</b> {receipt.viber}
          </span>
          <span>
            <b className="text-[#292c26]">TikTok</b> {receipt.tiktok}
          </span>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-[1.3fr_1fr]">
          <div className="rounded-xl border border-[#dfe1da] bg-[#f7f8f4] p-4">
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#777b70]">
              Sold to
            </p>
            <p className="mt-2 text-sm font-black text-[#1f211d]">
              {order.customer}
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-[#565a51]">
              {order.phone}
            </p>
            <p className="text-[10px] leading-relaxed text-[#565a51]">
              {order.address}
            </p>
          </div>
          <dl className="grid grid-cols-[auto_1fr] content-center gap-x-4 gap-y-2 rounded-xl border border-[#dfe1da] p-4 text-[10px]">
            <dt className="font-semibold text-[#777b70]">Issued</dt>
            <dd className="text-right font-bold">
              {date.toLocaleDateString("en-GB", { timeZone: "Asia/Yangon" })}
            </dd>
            <dt className="font-semibold text-[#777b70]">Time</dt>
            <dd className="text-right font-bold">
              {date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Yangon",
              })}
            </dd>
            <dt className="font-semibold text-[#777b70]">Courier</dt>
            <dd className="text-right font-bold">{order.carrier}</dd>
          </dl>
        </section>

        <div className="mt-6 overflow-hidden rounded-xl border border-[#d8dad3]">
          <table className="w-full table-fixed text-left text-[10px] sm:text-[11px]">
            <thead className="!bg-[#252a20] text-white">
              <tr>
                <th className="w-9 px-3 py-3 text-[8px] uppercase tracking-wider">
                  No.
                </th>
                <th className="px-3 py-3 text-[8px] uppercase tracking-wider">
                  Description
                </th>
                <th className="w-10 px-1 py-3 text-center text-[8px] uppercase tracking-wider">
                  Qty
                </th>
                <th className="hidden w-12 px-1 py-3 text-center text-[8px] uppercase tracking-wider sm:table-cell">
                  Unit
                </th>
                <th className="w-24 px-3 py-3 text-right text-[8px] uppercase tracking-wider">
                  Price
                </th>
                <th className="hidden w-12 px-1 py-3 text-center text-[8px] uppercase tracking-wider sm:table-cell">
                  Disc
                </th>
                <th className="w-24 px-3 py-3 text-right text-[8px] uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr
                  key={`${item.sku}-${index}`}
                  className="border-t border-[#e1e3dc] even:bg-[#fafbf8]"
                >
                  <td className="px-3 py-3 align-top text-[#74786e]">
                    {index + 1}
                  </td>
                  <td className="px-3 py-3">
                    <b>{item.name}</b>
                    <span className="mt-1 block font-mono text-[8px] text-[#74786e]">
                      {item.sku}
                      {item.identifier ? ` · ${item.identifier}` : ""} ·
                      Warranty {item.warrantyMonths} months
                    </span>
                  </td>
                  <td className="px-1 py-3 text-center align-top">
                    {item.quantity}
                  </td>
                  <td className="hidden px-1 py-3 text-center align-top text-[#74786e] sm:table-cell">
                    Unit
                  </td>
                  <td className="px-3 py-3 text-right align-top">
                    {number.format(item.unitPrice)}
                  </td>
                  <td className="hidden px-1 py-3 text-center align-top text-[#74786e] sm:table-cell">
                    {item.discountPercent}%
                  </td>
                  <td className="px-3 py-3 text-right align-top font-bold">
                    {number.format(item.unitPrice * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="mt-5 grid gap-5 sm:grid-cols-[1fr_290px]">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.18em] text-[#777b70]">
              Payment
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-black">{paymentLabel}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${paymentComplete ? "bg-[#e8f4cf] text-[#34431a]" : "bg-[#fff0cc] text-[#74530b]"}`}
              >
                {paymentComplete ? "Paid in full" : title(order.paymentStatus)}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-[#666a60]">
              Received:{" "}
              <b className="text-[#252820]">
                {number.format(order.paidAmount)} MMK
              </b>
            </p>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-2 rounded-xl bg-[#f3f4ef] p-4 text-right text-[10px]">
            <dt className="text-[#666a60]">Subtotal</dt>
            <dd>{number.format(order.subtotal)} MMK</dd>
            <dt className="text-[#666a60]">Delivery fee</dt>
            <dd>{number.format(order.shippingFee)} MMK</dd>
            <dt className="border-t border-[#ccd0c5] pt-2 text-sm font-black">
              Total
            </dt>
            <dd className="border-t border-[#ccd0c5] pt-2 text-sm font-black">
              {number.format(order.total)} MMK
            </dd>
            <dt className="text-[#666a60]">Paid</dt>
            <dd>{number.format(order.paidAmount)} MMK</dd>
            <dt className="font-black">Balance due</dt>
            <dd className="font-black">
              {number.format(order.outstandingBalance)} MMK
            </dd>
          </dl>
        </section>

        <section className="mt-6 rounded-xl border border-[#dfe1da] bg-[#fafbf8] p-4 font-sans text-[9px] leading-[1.65] text-[#4c5047]">
          <div className="flex items-center justify-between gap-3 border-b border-[#e2e4dd] pb-2">
            <p className="font-black text-[#252820]">
              Warranty Claim စည်းကမ်းချက်များ
            </p>
            <p className="shrink-0 text-[7px] font-bold uppercase tracking-[0.16em] text-[#7c8075]">
              Keep this voucher
            </p>
          </div>
          <ol className="mt-3 list-decimal space-y-1 pl-4">
            {receipt.warrantyTerms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ol>
        </section>
        <footer className="mt-6 grid items-end gap-5 border-t border-[#dfe1da] pt-5 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="font-sans text-sm font-black text-[#252820]">
              ကျေးဇူးတင်ပါတယ်ခင်ဗျာ
            </p>
            <p className="mt-1 max-w-sm text-[9px] leading-relaxed text-[#70746a]">
              Thank you for choosing MH OP. Keep this original voucher as your
              proof of purchase and warranty record.
            </p>
            <div className="mt-2 max-w-[260px]">
              <Barcode code={order.code} />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-right text-[8px] leading-relaxed text-[#777b70]">
              <b className="block text-[#30332c]">Order reference</b>Scan to
              identify
              <br />
              this transaction
            </div>
            <PaymentQR code={order.code} />
          </div>
        </footer>
      </div>
    </article>
  );
}

function ThermalReceipt({
  paper,
  order,
}: {
  paper: 58 | 80;
  order: ReceiptOrder;
}) {
  const warrantyUntil = useMemo(() => {
    const months = Math.max(
      0,
      ...order.items.map((item) => item.warrantyMonths),
    );
    if (!months) return null;
    const expiry = new Date(order.createdAt);
    expiry.setMonth(expiry.getMonth() + months);
    return expiry
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Yangon",
      })
      .toUpperCase();
  }, [order]);

  return (
    <div
      style={{ width: paper === 80 ? "302px" : "219px" }}
      className="receipt-document bg-white p-5 font-mono text-[10px] text-black shadow-xl"
    >
      <div className="text-center">
        <Image src={brandAssets.logo} alt="MH OP" width={96} height={40} unoptimized className="mx-auto h-10 w-24 object-cover grayscale" />
        <p className="font-sans text-xl font-black tracking-tight">
          {clientConfig.brand.name}
        </p>
        <p className="mt-1 text-[8px]">{clientConfig.brand.fullName}</p>
        <p className="text-[8px]">{clientConfig.brand.tagline}</p>
        <p className="mt-1 text-[8px]">{clientConfig.telegram.handle}</p>
      </div>
      <div className="my-3 border-t border-dashed border-black" />
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>ORDER</span>
          <b>{order.code}</b>
        </div>
        <div className="flex justify-between gap-3">
          <span>CUSTOMER</span>
          <span className="text-right">{order.customer.toUpperCase()}</span>
        </div>
        <div className="flex justify-between">
          <span>DATE</span>
          <span>
            {new Date(order.createdAt).toLocaleDateString("en-GB", {
              timeZone: "Asia/Yangon",
            })}
          </span>
        </div>
      </div>
      <div className="my-3 border-t border-dashed border-black" />
      {order.bundles.map((bundle) => (
        <p key={bundle} className="mb-2 font-bold">
          SET: {bundle}
        </p>
      ))}
      <div className="space-y-3">
        {order.items.map((item, index) => (
          <div key={`${item.sku}-${index}`}>
            <div className="flex justify-between gap-2 font-bold">
              <span>
                {item.quantity > 1 ? `${item.quantity}× ` : ""}
                {item.name}
              </span>
              <span>
                {new Intl.NumberFormat("en-US").format(
                  item.unitPrice * item.quantity,
                )}
              </span>
            </div>
            <p className="mt-1 text-[8px]">SKU: {item.sku}</p>
            {item.identifier && (
              <p className="text-[8px]">S/N · IMEI: {item.identifier}</p>
            )}
          </div>
        ))}
      </div>
      <div className="my-3 border-t border-dashed border-black" />
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{new Intl.NumberFormat("en-US").format(order.total)} MMK</span>
      </div>
      <p className="mt-1 text-right text-[8px]">
        {order.paymentMethod.toUpperCase()} ·{" "}
        {title(order.paymentStatus).toUpperCase()}
      </p>
      <Barcode code={order.code} />
      {warrantyUntil && (
        <>
          <div className="my-3 border-t border-dashed border-black" />
          <p className="text-center font-bold">WARRANTY VALID UNTIL</p>
          <p className="mt-1 text-center text-sm font-black">{warrantyUntil}</p>
          <p className="mt-2 text-[8px] leading-3">
            Warranty covers manufacturer defects. Physical/liquid damage and
            unauthorized repair are excluded. Keep this receipt for claims.
          </p>
        </>
      )}
      <div className="my-3 border-t border-dashed border-black" />
      <PaymentQR code={order.code} />
      <p className="mt-2 text-center text-[8px]">
        Scan to view order reference
      </p>
      <p className="mt-4 text-center font-bold">ကျေးဇူးတင်ပါတယ်ခင်ဗျာ</p>
      <p className="mt-1 text-center text-[8px]">
        MH OP ကို ယုံကြည်စွာ ရွေးချယ်ပေးသည့်အတွက် ဝမ်းမြောက်ပါတယ်။
      </p>
    </div>
  );
}
