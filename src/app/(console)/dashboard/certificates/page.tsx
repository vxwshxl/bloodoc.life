import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { formatCampDate } from "@/lib/format";
import type { CertificateStatus } from "@/lib/db/types";

export const metadata: Metadata = { title: "Certificates" };

type Row = {
  id: string;
  code: string;
  status: CertificateStatus;
  issued_at: string | null;
  registration: { camp: { title: string; starts_at: string; venue: string } | null } | null;
};

export default async function DonorCertificates() {
  const supabase = await createClient();
  // No filter by donor: `certificates_select_scoped` already restricts this to
  // the caller's own rows. A `where` here would be a second copy of the rule.
  const { data } = await supabase
    .from("certificates")
    .select(
      "id, code, status, issued_at, registration:registrations(camp:camps(title, starts_at, venue))",
    )
    .order("created_at", { ascending: false });

  const rows = (data as unknown as Row[] | null) ?? [];
  const approved = rows.filter((r) => r.status === "approved");

  return (
    <>
      <PageHeader
        title="Certificates"
        subtitle={
          rows.length === 0
            ? "One is created for every donation you make."
            : `${approved.length} of ${rows.length} signed off`
        }
      />

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing yet"
            body="A certificate is created automatically the moment a donation is recorded against your name."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => {
            const camp = c.registration?.camp;
            const valid = c.status === "approved";
            return (
              <Panel key={c.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <span
                    className={
                      valid
                        ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"
                        : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                    }
                  >
                    {valid ? (
                      <BadgeCheck className="size-4.5" strokeWidth={1.9} aria-hidden />
                    ) : (
                      <Clock className="size-4.5" strokeWidth={1.9} aria-hidden />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{camp?.title ?? "Camp"}</p>
                    {camp && (
                      <p className="text-xs text-muted-foreground">
                        {formatCampDate(camp.starts_at)} · {camp.venue}
                      </p>
                    )}
                    <p className="mt-1 font-mono text-xs">{c.code}</p>
                  </div>
                </div>

                <p className="mt-3 border-t border-app-line-soft pt-3 text-xs text-muted-foreground">
                  {/* Honest about the wait. A donor who gave this morning and
                      sees "pending" should know it is a signature, not a
                      problem with their donation. */}
                  {valid
                    ? `Issued ${c.issued_at ? formatCampDate(c.issued_at) : ""}. Open it to print or save as PDF.`
                    : c.status === "revoked"
                      ? "This certificate was withdrawn. Speak to the organisers."
                      : "Waiting for the blood bank to sign it off. It usually takes a day or two."}
                </p>

                {valid && (
                  <Link
                    href={`/verify/${c.code}`}
                    className="press mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-foreground"
                  >
                    Open certificate
                    <ExternalLink className="size-3.5" strokeWidth={2} aria-hidden />
                  </Link>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
