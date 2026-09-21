import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";

export const metadata: Metadata = {
  title: "Verify a certificate",
  description:
    "Check that a BlooDoc certificate of blood donation is genuine and still valid.",
};

/**
 * The code entry screen.
 *
 * A server action that redirects rather than a client fetch: the result is a
 * URL worth having — a verifier checking a stack of certificates wants each one
 * back-buttonable, and an employer told to "confirm this donation" should be
 * able to forward the link rather than a screenshot.
 */
async function lookup(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return;
  redirect(`/verify/${encodeURIComponent(code)}`);
}

export default function VerifyIndex() {
  return (
    <main className="mx-auto w-full max-w-md px-5 py-20 sm:px-6">
      <div className="mb-8 flex justify-center">
        <Link href="/">
          <Wordmark />
        </Link>
      </div>

      <div className="grain rounded-3xl border border-border bg-card p-7 shadow-[var(--panel-shadow)]">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Verify a certificate
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter the code printed on the certificate. It looks like
          {" "}
          <span className="font-mono text-foreground">BD-2026-9F3A7C</span>.
        </p>

        <form action={lookup} className="mt-6 flex flex-col gap-3">
          <input
            name="code"
            required
            autoFocus
            spellCheck={false}
            autoCapitalize="characters"
            placeholder="BD-2026-9F3A7C"
            className="h-11 rounded-xl border border-input bg-transparent px-3 font-mono text-sm tracking-wider outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <button
            type="submit"
            className="press h-11 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            Check it
          </button>
        </form>
      </div>
    </main>
  );
}
