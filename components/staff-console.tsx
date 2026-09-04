"use client";
import { useState, useTransition } from "react";
import { KeyRound, Plus, Power, X } from "lucide-react";
import {
  createStaffAction,
  setStaffActiveAction,
  updateStaffAction,
  type StaffMember,
} from "@/app/actions/admin";
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
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <form onSubmit={submit} className="card w-full max-w-lg p-6">
            <div className="flex justify-between">
              <div>
                <p className="eyebrow">Access control</p>
                <h2 className="display mt-1 text-2xl font-bold">
                  {editor.id ? "Edit staff" : "Add staff"}
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
            <div className="mt-5 space-y-4">
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
            <button
              disabled={pending}
              className="mt-5 w-full rounded-xl bg-black py-3 text-xs font-bold text-white disabled:opacity-40"
            >
              {pending ? "Saving…" : "Save staff access"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
