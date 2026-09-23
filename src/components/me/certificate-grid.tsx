"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Droplet, Link2, Printer } from "lucide-react";
import { toast } from "sonner";
import type { VerifiedCertificate } from "@/lib/partners/queries";
import { CertificateView } from "@/components/certificate/certificate-view";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatCampDate } from "@/lib/format";

/**
 * The donor's signed-off certificates, as cards that open the real thing.
 *
 * The preview is the same `CertificateView` the public /verify page renders,
 * filled with the donor's own name and camp. So what they see here is exactly
 * what anyone checking the code will see, not a lookalike.
 */
export function CertificateGrid({ certs }: { certs: VerifiedCertificate[] }) {
  const [open, setOpen] = useState<VerifiedCertificate | null>(null);

  async function copyLink(code: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/verify/${code}`);
      toast.success("Verification link copied.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {certs.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => setOpen(c)}
            className="group/cert press grain relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-app-line-soft bg-card p-5 text-left shadow-card transition-[border-color] select-none hover:border-primary/40 focus-visible:border-primary focus-visible:outline-none"
          >
            {/* A drop in the corner, so the card reads as a certificate at a
                glance rather than another list row. */}
            <Droplet
              aria-hidden
              strokeWidth={1.2}
              className="pointer-events-none absolute -top-5 -right-5 size-28 text-primary/8 transition-transform duration-500 ease-out-strong group-hover/cert:scale-105"
            />

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-[0.6875rem] font-semibold text-primary">
                <BadgeCheck className="size-3.5" strokeWidth={2.2} aria-hidden />
                Verified
              </span>
              {c.blood_group !== "unknown" && (
                <span className="rounded-full border border-app-line-soft px-2 py-0.5 text-[0.6875rem] font-bold">
                  {c.blood_group}
                </span>
              )}
            </div>

            <p className="mt-5 text-[0.625rem] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Certificate of blood donation
            </p>
            <p className="font-display mt-1 text-lg leading-tight font-bold tracking-tight text-balance">
              {c.camp_title}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCampDate(c.camp_date)} · {c.venue}
            </p>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-dashed border-app-line pt-3">
              <span className="font-mono text-xs font-semibold tracking-wider">{c.code}</span>
              <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                View
                <ArrowRight
                  className="size-3.5 transition-transform duration-300 ease-out-strong group-hover/cert:translate-x-0.5"
                  strokeWidth={2.2}
                  aria-hidden
                />
              </span>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">
            {open ? `Certificate for ${open.camp_title}` : "Certificate"}
          </DialogTitle>
          {open && (
            <>
              <div className="grain">
                <CertificateView cert={open} />
              </div>
              <div className="flex flex-col gap-2 border-t border-app-line-soft p-4 sm:flex-row">
                <Link
                  href={`/verify/${open.code}`}
                  target="_blank"
                  className="press inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  <Printer className="size-4" strokeWidth={2} aria-hidden />
                  Print or save PDF
                </Link>
                <button
                  type="button"
                  onClick={() => copyLink(open.code)}
                  className="press inline-flex h-10 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-app-line px-4 text-sm font-semibold hover:bg-muted"
                >
                  <Link2 className="size-4" strokeWidth={2} aria-hidden />
                  Copy verification link
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
