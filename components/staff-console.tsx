"use client";
import { useState, useTransition } from "react";
import { KeyRound, Plus, Power, X } from "lucide-react";
import {
  createStaffAction,
  setStaffActiveAction,
  updateStaffAction,
  type StaffMember,
} from "@/app/actions/admin";
import { ModalPortal } from "@/components/modal-portal";
const field = "mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm";
type Draft = {
  name: string;
  email: string;
  role: "admin" | "staff";
  password: string;
};
const empty: Draft = { name: "", email: "", role: "staff", password: "" };

export function StaffConsole({ staff }: { staff: StaffMember[] }) {
  const [pending, startTransition] = useTransition();
  const [editor, setEditor] = useState<{
    id: string | null;
    draft: Draft;
  } | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor) return;
    startTransition(async () => {
      const result = editor.id
        ? await updateStaffAction(editor.id, {
            ...editor.draft,
            password: editor.draft.password || undefined,
          })
        : await createStaffAction(editor.draft);
      if (result.ok) {
        setNotice({
          ok: true,
          text: editor.id ? "Staff access updated." : "Staff account created.",
        });
        setEditor(null);
      } else setNotice({ ok: false, text: result.error });
    });
  };
  const toggle = (member: StaffMember) =>
    startTransition(async () => {
      const result = await setStaffActiveAction(member.id, !member.isActive);
      setNotice(
        result.ok
          ? {
              ok: true,
              text: `${member.name} ${member.isActive ? "deactivated" : "activated"}.`,
            }
          : { ok: false, text: result.error },
      );
    });
  return (
    <>
      {notice && (
        <p
          role="status"
          className={`mb-4 rounded-xl border p-3 text-xs font-bold ${notice.ok ? "bg-[#effbdd] text-[#416b17]" : "bg-[#fff0eb] text-[#9c3212]"}`}
        >
          {notice.text}
        </p>
      )}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setEditor({ id: null, draft: empty })}
          className="pill bg-black px-4 py-3 text-white"
        >
          <Plus size={14} />
          Add staff
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {staff.map((member) => (
          <article
            className={`card p-5 ${member.isActive ? "" : "opacity-60"}`}
            key={member.id}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="display text-lg font-bold">{member.name}</p>
                <p className="mt-1 text-xs text-[#77776f]">{member.email}</p>
              </div>
              <span className="pill capitalize">{member.role}</span>
            </div>
            <p className="mt-5 text-xs font-bold">
              {member.isActive ? "Active access" : "Access disabled"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                disabled={member.id.startsWith("demo-")}
                onClick={() =>
                  setEditor({
                    id: member.id,
                    draft: {
                      name: member.name,
                      email: member.email,
                      role: member.role as "admin" | "staff",
                      password: "",
                    },
                  })
                }
                className="rounded-xl border py-2.5 text-xs font-bold disabled:opacity-40"
              >
                <KeyRound size={13} className="mr-1 inline" />
                Edit / reset
              </button>
              <button
                disabled={pending || member.id.startsWith("demo-")}
                onClick={() => toggle(member)}
                className="rounded-xl border py-2.5 text-xs font-bold disabled:opacity-40"
              >
                <Power size={13} className="mr-1 inline" />
                {member.isActive ? "Deactivate" : "Activate"}
              </button>
            </div>
          </article>
        ))}
      </div>
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
              onSubmit={submit}
              className="card flex max-h-[92dvh] sm:max-h-[88vh] w-full max-w-lg flex-col overflow-hidden shadow-2xl"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-[#e5e4dc] bg-white p-4 sm:p-6">
                <div>
                  <p className="eyebrow">Access control</p>
                  <h2 className="display mt-0.5 text-xl sm:text-2xl font-bold">
                    {editor.id ? "Edit staff" : "Add staff"}
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

              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
                <label className="block text-xs font-bold">
                  Name
                  <input
                    required
                    maxLength={120}
                    className={field}
                    value={editor.draft.name}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        draft: { ...editor.draft, name: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="block text-xs font-bold">
                  Email
                  <input
                    required
                    type="email"
                    className={field}
                    value={editor.draft.email}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        draft: { ...editor.draft, email: e.target.value },
                      })
                    }
                  />
                </label>
                <label className="block text-xs font-bold">
                  Role
                  <select
                    className={field}
                    value={editor.draft.role}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        draft: {
                          ...editor.draft,
                          role: e.target.value as "admin" | "staff",
                        },
                      })
                    }
                  >
                    <option value="staff">Staff</option>
                    <option value="admin">Administrator</option>
                  </select>
                </label>
                <label className="block text-xs font-bold">
                  {editor.id
                    ? "New password (leave blank to keep current)"
                    : "Temporary password"}
                  <input
                    required={!editor.id}
                    minLength={8}
                    type="password"
                    autoComplete="new-password"
                    className={field}
                    value={editor.draft.password}
                    onChange={(e) =>
                      setEditor({
                        ...editor,
                        draft: { ...editor.draft, password: e.target.value },
                      })
                    }
                  />
                </label>
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
                  {pending ? "Saving…" : "Save staff access"}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
