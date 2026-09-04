import Link from "next/link";
import { Logo } from "@/components/logo";
import { WarrantyLookup } from "@/components/warranty-lookup";

export default function WarrantyPage() {
  return (
    <main className="min-h-screen bg-[#f4f2ec] p-5 md:p-10">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <Logo />
          <Link href="/shop" className="pill">
            ← Back to shop
          </Link>
        </div>
        <p className="eyebrow mt-14">Customer care</p>
        <h1 className="display mt-2 text-5xl font-semibold">
          Check your warranty.
        </h1>
        <p className="mb-8 mt-3 max-w-xl text-sm leading-6 text-[#77776f]">
          Use your order code and purchase phone number to view coverage without
          exposing your order to anyone else.
        </p>
        <WarrantyLookup />
      </div>
    </main>
  );
}
