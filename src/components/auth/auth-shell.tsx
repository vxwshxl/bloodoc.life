import Link from "next/link";
import { Wordmark } from "@/components/brand";

/**
 * The ground every signed-out screen stands on.
 *
 * Same bloom and grid as the landing hero rather than a plain panel: arriving
 * at sign-in should not feel like leaving the site. The wordmark links home,
 * because a sign-in page with no way out is where a visitor who clicked it by
 * accident uses the back button and loses their place.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-b" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-bloom" />

      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="press mx-auto flex w-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <Wordmark />
        </Link>

        <div className="grain mt-8 rounded-3xl border border-border bg-card p-5 shadow-[var(--panel-shadow)] sm:p-9">
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          )}
          <div className="mt-7">{children}</div>
        </div>

        {footer && (
          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">{footer}</p>
        )}
      </div>
    </main>
  );
}
