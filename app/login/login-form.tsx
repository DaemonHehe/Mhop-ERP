"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { ArrowRight } from "lucide-react";
export function LoginForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <form action={action} className="mt-8 space-y-4">
      <input type="hidden" name="next" value={nextPath} />
      <div>
        <label htmlFor="staff-email" className="text-xs font-bold">
          Email
        </label>
        <input
          id="staff-email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-2 h-12 w-full rounded-xl border bg-white px-4 outline-none focus:border-black"
          placeholder="you@company.com"
        />
      </div>
      <div>
        <label htmlFor="staff-password" className="text-xs font-bold">
          Password
        </label>
        <input
          id="staff-password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
          required
          className="mt-2 h-12 w-full rounded-xl border bg-white px-4 outline-none focus:border-black"
        />
      </div>
      {state.error && (
        <p
          role="alert"
          className="rounded-xl bg-[#fff0eb] p-3 text-xs font-semibold text-[#a33d1c]"
        >
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="flex w-full items-center justify-between rounded-xl bg-black px-5 py-3.5 text-xs font-bold text-white disabled:opacity-50"
      >
        <span>{pending ? "Signing in…" : "Sign in"}</span>
        <ArrowRight size={15} />
      </button>
    </form>
  );
}
