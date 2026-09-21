"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DropMark } from "@/components/brand";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side stack, which is not sent
    // to the browser. Logging it here is what lets a support email be matched
    // to a line in the server log.
    console.error("Unhandled error", error.digest, error);
  }, [error]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />

      <div className="relative">
        <DropMark className="mx-auto size-14" />
        <h1 className="mt-7 font-display text-2xl font-bold tracking-tight">
          Something went wrong.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          That is on us, not on you. Try again, and if it keeps happening write
          to{" "}
          <a href="mailto:hello@bloodoc.life" className="font-medium text-foreground underline underline-offset-4">
            hello@bloodoc.life
          </a>
          {error.digest ? ` and quote ${error.digest}.` : "."}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="press inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <Link
            href="/"
            className="press inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
