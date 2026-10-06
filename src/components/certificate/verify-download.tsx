"use client";

import { useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import type { VerifiedCertificate } from "@/lib/partners/queries";
import { downloadCertificatePdf } from "@/components/certificate/certificate-pdf";

/**
 * Download and print, under a valid certificate on /verify.
 *
 * The PDF is the same capture the donor's dashboard and the console make, so
 * the file a verifier saves is the certificate on the screen in front of
 * them. Print stays beside it for anyone who wants paper, or whose browser
 * cannot make the file.
 */
export function VerifyDownload({ cert }: { cert: VerifiedCertificate }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      await downloadCertificatePdf(cert);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center gap-2 print:hidden">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="press inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" strokeWidth={2} aria-hidden />
          )}
          {busy ? "Preparing PDF…" : "Download PDF"}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="press inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Printer className="size-4" strokeWidth={1.9} aria-hidden />
          Print
        </button>
      </div>
      {failed && (
        <p role="alert" className="text-xs font-medium text-destructive">
          Could not make the PDF here. Use Print and choose &ldquo;Save as PDF&rdquo; instead.
        </p>
      )}
    </div>
  );
}
