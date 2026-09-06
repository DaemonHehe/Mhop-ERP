"use client";

import { useState } from "react";
import { CreditCard, Printer } from "lucide-react";
import type { ReceiptOrder } from "@/app/actions/store";
import type { PaymentAccount } from "@/app/actions/payment-accounts";
import { ReceiptBuilder } from "./receipt-builder";
import { PaymentAccountsManager } from "./payment-accounts-manager";

export function ReceiptsConsole({
  orders,
  accounts,
}: {
  orders: ReceiptOrder[];
  accounts: PaymentAccount[];
}) {
  const [tab, setTab] = useState<"builder" | "accounts">("builder");

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-[#dedbd0] pb-3">
        <button
          type="button"
          onClick={() => setTab("builder")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "builder"
              ? "bg-black text-white shadow-sm"
              : "border border-[#dedbd0] bg-white text-[#626258] hover:border-black"
          }`}
        >
          <Printer size={15} />
          Sales Voucher Studio
        </button>

        <button
          type="button"
          onClick={() => setTab("accounts")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
            tab === "accounts"
              ? "bg-black text-white shadow-sm"
              : "border border-[#dedbd0] bg-white text-[#626258] hover:border-black"
          }`}
        >
          <CreditCard size={15} />
          Payment & Bank Accounts
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
              tab === "accounts" ? "bg-white/20 text-white" : "bg-[#f1efe8] text-[#171813]"
            }`}
          >
            {accounts.length}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {tab === "builder" ? (
        <ReceiptBuilder orders={orders} />
      ) : (
        <div className="no-print">
          <PaymentAccountsManager accounts={accounts} />
        </div>
      )}
    </div>
  );
}
