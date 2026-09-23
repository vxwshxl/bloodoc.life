import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleAlert, CircleSlash, Printer } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { verifyCertificate } from "@/lib/partners/queries";
import { CertificateView } from "@/components/certificate/certificate-view";

/**
 * The public face of a certificate.
 *
 * Anyone holding the code can open this, signed in or not — that is the entire
 * point of a verification page, and it is why the lookup behind it runs on the
 * service role rather than through a policy that would need every certificate
 * to be world-readable.
 *
 * It shows exactly what is printed on the certificate itself: a name, a blood
 * group, a camp, and the bodies that ran it. No phone number, no address, no
 * vitals. Someone who found a certificate on the floor learns nothing from this
 * page that the paper in their hand did not already tell them.
 *
 * A pending or withdrawn code resolves rather than 404s. "This certificate is
 * not valid" is the answer a verifier came for; a not-found page would be
 * indistinguishable from a mistyped character.
 */

export const metadata: Metadata = {
  title: "Verify a certificate",
  // Not indexed. These URLs carry a donor's name, and a search engine holding
  // them turns a verification tool into a directory of who gave blood.
  robots: { index: false, follow: false },
};

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const cert = await verifyCertificate(decodeURIComponent(code));

  const state = !cert
    ? ("unknown" as const)
    : cert.status === "approved"
      ? ("valid" as const)
      : cert.status === "revoked"
        ? ("revoked" as const)
        : ("pending" as const);

  const BANNER = {
    valid: {
      icon: BadgeCheck,
      tone: "bg-primary text-primary-foreground",
      title: "Verified certificate",
      body: "This donation is recorded and signed off by the blood bank that received it.",
    },
    pending: {
      icon: CircleAlert,
      tone: "bg-muted text-foreground",
      title: "Not yet approved",
      body: "The donation is recorded but the blood bank has not signed it off. Check again shortly.",
    },
    revoked: {
      icon: CircleSlash,
      tone: "bg-destructive text-white",
      title: "Withdrawn",
      body: "This certificate was withdrawn and should not be accepted as proof of donation.",
    },
    unknown: {
      icon: CircleSlash,
      tone: "bg-destructive text-white",
      title: "No such certificate",
      body: "Nothing matches that code. Check the characters — codes look like BD-2026-9F3A7C.",
    },
  }[state];

  const Icon = BANNER.icon;

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-6">
      <div className="mb-8 flex justify-center print:hidden">
        <Link href="/">
          <Wordmark />
        </Link>
      </div>

      <div className="grain overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--panel-shadow)] print:border-black print:shadow-none">
        <div className={`flex items-center gap-3 px-6 py-4 ${BANNER.tone}`}>
          <Icon className="size-5 shrink-0" strokeWidth={2} aria-hidden />
          <div>
            <p className="text-sm font-bold tracking-tight">{BANNER.title}</p>
            <p className="text-xs opacity-90">{BANNER.body}</p>
          </div>
        </div>

        {cert && <CertificateView cert={cert} />}
      </div>

      {/* Print is the download. A browser's "Save as PDF" produces the same
          file a generated one would, without adding a PDF toolchain to a site
          whose only document this is. */}
      {state === "valid" && (
        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground print:hidden">
          <Printer className="size-3.5" strokeWidth={1.9} aria-hidden />
          Use your browser&rsquo;s print dialog to save this as a PDF.
        </p>
      )}

      <p className="mt-8 text-center text-xs text-muted-foreground print:hidden">
        <Link href="/verify" className="underline-offset-2 hover:underline">
          Verify another certificate
        </Link>
      </p>
    </main>
  );
}
