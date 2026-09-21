import Link from "next/link";
import { DropMark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom" />

      <div className="relative">
        <DropMark className="mx-auto size-14" />
        <p className="mt-7 font-display text-6xl font-black tracking-tighter text-primary">404</p>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          Nothing here.
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          The page you were looking for has moved, or the camp it belonged to is
          over.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="press inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Home
          </Link>
          <Link
            href="/camps"
            className="press inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-semibold transition-colors hover:bg-muted"
          >
            Upcoming camps
          </Link>
        </div>
      </div>
    </main>
  );
}
