import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { formatDateTime } from "@/lib/format";
import type { EmailLog } from "@/lib/db/types";

export const metadata: Metadata = { title: "Email" };

export default async function EmailPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("email_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as EmailLog[];
  const failed = rows.filter((r) => !r.ok).length;

  return (
    <>
      <PageHeader
        title="Email"
        subtitle={
          rows.length
            ? `Last ${rows.length} messages · ${failed} failed`
            : "Nothing has been sent yet."
        }
      />

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            title="No email yet"
            body="Sign-in codes, registration confirmations and camp reminders all land here — successes included, so “did it actually go out” has an answer."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul>
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-3 border-b border-app-line-soft px-5 py-3 last:border-b-0"
              >
                {r.ok ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={2} />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={2} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.subject}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.to_email}
                    {r.template ? ` · ${r.template}` : ""} · {formatDateTime(r.created_at)}
                  </p>
                  {r.error && (
                    <p className="mt-1 text-xs font-medium break-words text-destructive">{r.error}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
