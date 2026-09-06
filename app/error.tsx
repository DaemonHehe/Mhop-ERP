"use client";
import { Logo } from "@/components/logo";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[MH OP view error]", error);
  }, [error]);
  const detail =
    process.env.NODE_ENV === "development" && error.message
      ? error.message
      : "The service could not complete this request. No changes were applied.";
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f2ec] p-6">
      <div className="card max-w-lg p-8">
        <Logo className="mb-6" href="/shop" />
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#fff0eb] text-[#b5421c]">
          <AlertTriangle />
        </span>
        <p className="eyebrow mt-6">Operational error</p>
        <h1 className="display mt-2 text-3xl font-bold">
          This view could not be loaded.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#77776f]">{detail}</p>
        {error.digest && (
          <p className="mt-2 font-mono text-[10px] text-[#999]">
            Reference: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-full bg-black px-5 py-3 text-xs font-bold text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
