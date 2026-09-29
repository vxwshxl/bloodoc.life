"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Award, Download, ExternalLink, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import type { VerifiedCertificate } from "@/lib/partners/queries";
import { CertificateView } from "@/components/certificate/certificate-view";
import {
  downloadCertificatePdf,
  downloadCertificatesZip,
} from "@/components/certificate/certificate-pdf";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { resendCertificate, type SendState } from "@/lib/partners/actions";
import { cn } from "@/lib/utils";

/** One look for every button in a certificate's popup. */
const BUTTON =
  "press inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50";
const OUTLINE = `${BUTTON} border border-app-line hover:bg-muted`;

/**
 * "Download all": every approved certificate at a camp, each a PDF named for
 * its donor, in one zip.
 */
export function BulkCertificateDownload({
  certs,
  campTitle,
}: {
  certs: VerifiedCertificate[];
  campTitle: string;
}) {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function run() {
    setProgress({ done: 0, total: certs.length });
    try {
      await downloadCertificatesZip(
        certs,
        `Certificates - ${campTitle.replace(/[\\/:*?"<>|]+/g, "")}.zip`,
        (done, total) => setProgress({ done, total }),
      );
      toast.success(`${certs.length} certificate${certs.length === 1 ? "" : "s"} downloaded.`);
    } catch {
      toast.error("Could not make the certificates. Try again, or download them one at a time.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={certs.length === 0 || progress !== null}
      title={certs.length === 0 ? "No approved certificates at this camp yet" : undefined}
      className={cn(BUTTON, "bg-primary text-primary-foreground hover:bg-primary/90")}
    >
      {progress ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Preparing {Math.min(progress.done + 1, progress.total)} of {progress.total}…
        </>
      ) : (
        <>
          <Download className="size-4" strokeWidth={2} aria-hidden />
          Download all approved ({certs.length})
        </>
      )}
    </button>
  );
}

/** "Certificate": the certificate itself, in a popup, with a PDF download. */
export function CertificatePreviewButton({ cert }: { cert: VerifiedCertificate }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await downloadCertificatePdf(cert);
    } catch {
      toast.error("Could not make the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={OUTLINE}>
        <Award className="size-4" strokeWidth={2} aria-hidden />
        Certificate
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogTitle className="sr-only">Certificate for {cert.donor_name}</DialogTitle>
          <CertificateView cert={cert} />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-app-line-soft p-3">
            <p className="px-1 text-xs text-muted-foreground">
              {cert.status === "approved"
                ? "As the donor receives it."
                : "Not yet valid: this is how it will look once approved."}
            </p>
            <button type="button" onClick={download} disabled={busy} className={OUTLINE}>
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Download className="size-4" strokeWidth={2} aria-hidden />
              )}
              Download PDF
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** "Verify": the public page for this code, as a stranger would see it. */
export function VerifyLink({ code }: { code: string }) {
  return (
    <Link href={`/verify/${code}`} target="_blank" className={OUTLINE}>
      Verify
      <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden />
    </Link>
  );
}

/**
 * "Send certificate": email it to the donor now. The automatic email already
 * went when the donation was recorded; this is for sending it again.
 */
export function SendCertificateButton({
  certificateId,
  approved,
}: {
  certificateId: string;
  approved: boolean;
}) {
  const [state, send, sending] = useActionState<SendState, FormData>(resendCertificate, {});

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success(state.message ?? "Sent.");
  }, [state]);

  return (
    <form action={send}>
      <input type="hidden" name="certificateId" value={certificateId} />
      <button
        type="submit"
        disabled={!approved || sending}
        title={approved ? undefined : "Approve it first"}
        className={OUTLINE}
      >
        {sending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Send className="size-4" strokeWidth={2} aria-hidden />
        )}
        Send certificate
      </button>
    </form>
  );
}
