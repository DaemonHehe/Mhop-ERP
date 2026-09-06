"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  CreditCard,
  Edit2,
  Plus,
  Power,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import {
  createPaymentAccountAction,
  deletePaymentAccountAction,
  togglePaymentAccountAction,
  updatePaymentAccountAction,
  type PaymentAccount,
  type PaymentAccountDraft,
} from "@/app/actions/payment-accounts";

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-[#dedbd0] bg-white px-3 text-sm font-medium outline-none focus:border-black transition";

const emptyDraft: PaymentAccountDraft = {
  bankName: "",
  accountHolder: "",
  accountNumber: "",
  instructions: "",
  isActive: true,
  displayOrder: 0,
};

export function PaymentAccountsManager({
  accounts,
}: {
  accounts: PaymentAccount[];
}) {
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<{
    id: string | null;
    draft: PaymentAccountDraft;
  } | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    startTransition(async () => {
      const result = editor.id
        ? await updatePaymentAccountAction(editor.id, editor.draft)
        : await createPaymentAccountAction(editor.draft);

      if (result.ok) {
        setNotice({
          ok: true,
          text: editor.id
            ? "Payment account updated successfully."
            : "Payment account created successfully.",
        });
        setEditor(null);
      } else {
        setNotice({ ok: false, text: result.error || "Operation failed." });
      }
    });
  };

  const toggle = (item: PaymentAccount) => {
    startTransition(async () => {
      const result = await togglePaymentAccountAction(item.id, !item.isActive);
      setNotice(
        result.ok
          ? {
              ok: true,
              text: `${item.bankName} ${!item.isActive ? "activated" : "deactivated"}.`,
            }
          : { ok: false, text: result.error || "Toggle failed." }
      );
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      const result = await deletePaymentAccountAction(id);
      setDeleteConfirmId(null);
      setNotice(
        result.ok
          ? { ok: true, text: "Payment account removed." }
          : { ok: false, text: result.error || "Delete failed." }
      );
    });
  };

  return (
    <div className="space-y-6">
      {notice && (
        <p
          role="status"
          className={`rounded-xl border p-3.5 text-xs font-bold ${
            notice.ok
              ? "border-[#c4e897] bg-[#effbdd] text-[#366011]"
              : "border-[#ffcdbe] bg-[#fff0eb] text-[#9c3212]"
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* Header & Add Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="display text-xl font-bold">Payment & Bank Accounts</h2>
          <p className="mt-1 text-xs text-[#77776f]">
            Manage transfer accounts shown to customers on checkout receipts and Telegram messages.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditor({ id: null, draft: { ...emptyDraft } })}
          className="pill flex items-center gap-1.5 bg-black px-4 py-2.5 text-xs font-bold text-white hover:bg-neutral-800"
        >
          <Plus size={15} />
          Add payment account
        </button>
      </div>

      {/* Account Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map((item) => (
          <article
            key={item.id}
            className={`card relative flex flex-col justify-between p-5 transition ${
              item.isActive
                ? "border-[#dedbd0] bg-white"
                : "border-dashed border-[#ccc] bg-[#f9f8f4] opacity-75"
            }`}
          >
            <div>
              {/* Header: Bank name & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f1efe8] text-[#171813]">
                    <WalletCards size={18} />
                  </div>
                  <div>
                    <h3 className="display text-base font-bold text-[#1f211d]">
                      {item.bankName}
                    </h3>
                    <p className="text-[11px] font-semibold text-[#77776f]">
                      Holder: {item.accountHolder}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                    item.isActive
                      ? "bg-[#effbdd] text-[#3b6613]"
                      : "bg-[#eae7dd] text-[#77776f]"
                  }`}
                >
                  {item.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Account Number Box */}
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f5f4ed] p-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#888]">
                    Account Number
                  </p>
                  <p className="font-mono text-sm font-black text-[#171813]">
                    {item.accountNumber}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(item.id, item.accountNumber)}
                  className="rounded-lg border border-[#dedbd0] bg-white p-1.5 text-[#555] transition hover:bg-[#eae8df]"
                  title="Copy number"
                >
                  {copiedId === item.id ? (
                    <Check size={14} className="text-[#3b6613]" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>

              {/* Instructions */}
              {item.instructions && (
                <p className="mt-3 rounded-lg bg-amber-50/70 p-2.5 text-[11px] leading-relaxed text-amber-900 border border-amber-200/60">
                  {item.instructions}
                </p>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="mt-5 flex items-center justify-between border-t border-[#f0ede6] pt-4">
              <button
                type="button"
                disabled={pending}
                onClick={() => toggle(item)}
                className={`flex items-center gap-1 text-xs font-bold transition ${
                  item.isActive
                    ? "text-[#888] hover:text-[#b5421c]"
                    : "text-[#3b6613] hover:underline"
                }`}
              >
                <Power size={13} />
                {item.isActive ? "Deactivate" : "Activate"}
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    setEditor({
                      id: item.id,
                      draft: {
                        bankName: item.bankName,
                        accountHolder: item.accountHolder,
                        accountNumber: item.accountNumber,
                        instructions: item.instructions || "",
                        isActive: item.isActive,
                        displayOrder: item.displayOrder,
                      },
                    })
                  }
                  className="rounded-lg border border-[#dedbd0] p-2 text-[#444] transition hover:border-black hover:bg-white"
                  title="Edit account"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setDeleteConfirmId(item.id)}
                  className="rounded-lg border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50"
                  title="Delete account"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Inline Delete Confirmation Dialog */}
            {deleteConfirmId === item.id && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/95 p-4 text-center backdrop-blur-xs">
                <p className="text-xs font-bold text-[#1f211d]">
                  Delete {item.bankName}?
                </p>
                <p className="mt-1 text-[10px] text-[#777]">
                  This bank account will be removed from customer receipts.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(null)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => remove(item.id)}
                    className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>

      {/* Editor Modal */}
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#dedbd0] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#f0ede6]">
              <div className="flex items-center gap-2">
                <CreditCard size={18} />
                <h3 className="display text-lg font-bold">
                  {editor.id ? "Edit Payment Account" : "New Payment Account"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg p-1.5 text-[#777] hover:bg-[#f1efe8]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#1f211d]">
                  Bank / Provider Name *
                </label>
                <input
                  required
                  placeholder="e.g. KBZPay (KPay), WavePay, KBZ Bank, CB Bank"
                  value={editor.draft.bankName}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      draft: { ...editor.draft, bankName: e.target.value },
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f211d]">
                  Account Holder Name *
                </label>
                <input
                  required
                  placeholder="e.g. Ko Ko Kyaw"
                  value={editor.draft.accountHolder}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      draft: { ...editor.draft, accountHolder: e.target.value },
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f211d]">
                  Account Number *
                </label>
                <input
                  required
                  placeholder="e.g. 09798888123 or 0123456789012"
                  value={editor.draft.accountNumber}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      draft: { ...editor.draft, accountNumber: e.target.value },
                    })
                  }
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1f211d]">
                  Transfer Note / Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. ငွေလွှဲပြီးပါက slip ကို Telegram သို့ ပေးပို့ပါခင်ဗျာ"
                  value={editor.draft.instructions || ""}
                  onChange={(e) =>
                    setEditor({
                      ...editor,
                      draft: { ...editor.draft, instructions: e.target.value },
                    })
                  }
                  className="mt-1.5 w-full rounded-xl border border-[#dedbd0] bg-white p-3 text-sm font-medium outline-none focus:border-black transition"
                />
              </div>

              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editor.draft.isActive}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        draft: { ...editor.draft, isActive: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span>Active account</span>
                </label>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold">Sort Order:</label>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={editor.draft.displayOrder ?? 0}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        draft: {
                          ...editor.draft,
                          displayOrder: Number(e.target.value) || 0,
                        },
                      })
                    }
                    className="h-8 w-14 rounded-lg border border-[#dedbd0] px-2 text-center text-xs font-bold"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2 border-t border-[#f0ede6] pt-4">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="rounded-xl border border-[#dedbd0] px-4 py-2.5 text-xs font-bold transition hover:bg-[#f1efe8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-black px-5 py-2.5 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  {pending
                    ? "Saving..."
                    : editor.id
                    ? "Save Changes"
                    : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
