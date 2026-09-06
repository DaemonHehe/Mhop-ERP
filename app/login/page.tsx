import { brandAssets } from "@/lib/brand-assets";
import Image from "next/image";
import { Logo } from "@/components/logo";
import { clientConfig } from "@/lib/client-config";
import { LoginForm } from "./login-form";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const requested = (await searchParams).next || "/dashboard";
  const nextPath =
    requested.startsWith("/") && !requested.startsWith("//")
      ? requested
      : "/dashboard";
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="relative flex flex-col justify-between overflow-hidden bg-[#171813] p-7 text-white md:p-12">
        <div className="absolute inset-0 pointer-events-none opacity-25">
          <Image
            src={brandAssets.store}
            alt="MH OP Showroom"
            fill
            sizes="50vw"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#171813] via-[#171813]/70 to-[#171813]/90" />
        </div>
        <div className="relative z-10">
          <Logo light />
        </div>
        <div className="relative z-10 max-w-xl py-20">
          <p className="eyebrow !text-[#c7f36b]">MH OP staff operations</p>
          <h1 className="display mt-4 text-5xl font-semibold leading-[.95] md:text-7xl">
            Your store.
            <br />
            Under control.
          </h1>
          <p className="mt-5 max-w-md text-sm leading-6 text-white/70">
            Manage gadget and PUBG account orders, payments, inventory,
            delivery, and support from one friendly workspace.
          </p>
        </div>
        <p className="relative z-10 text-xs text-white/40">
          MH OP · Built by {clientConfig.developer.name}
        </p>
      </section>
      <section className="grid place-items-center p-6">
        <div className="w-full max-w-sm">
          <p className="eyebrow">Welcome back</p>
          <h2 className="display mt-2 text-4xl font-semibold">
            Sign in to continue.
          </h2>
          <LoginForm nextPath={nextPath} />
          <p className="mt-6 text-xs leading-5 text-[#77776f]">
            Sign in with an active staff account from the database. The test
            dataset creates <code>admin@gmail.com</code> for local acceptance
            testing.
          </p>
        </div>
      </section>
    </main>
  );
}
