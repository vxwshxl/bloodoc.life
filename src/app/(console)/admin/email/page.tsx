import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  pageFromParams,
  rangeFor,
} from "@/components/shell/pagination";
import { ClearEmailLog, EmailRow } from "@/components/admin/email-row";
import type { EmailLog } from "@/lib/db/types";

export const metadata: Metadata = { title: "Email" };

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = pageFromParams(pageParam);

  const supabase = await createClient();
  // `count: "exact"` in the same round trip as the rows — the pager needs the
  // total and a second query would be a second chance for the two to disagree
  // while email is being sent underneath them.
  const [from, to] = rangeFor(page);
  const { data, count } = await supabase
    .from("email_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = (data ?? []) as EmailLog[];
  const total = count ?? 0;
  const failed = rows.filter((r) => !r.ok).length;

  return (
    <>
      <PageHeader
        title="Email"
        subtitle={
          total
            ? `${total} message${total === 1 ? "" : "s"} · ${failed} failed on this page`
            : "Nothing has been sent yet."
        }
        action={<ClearEmailLog total={total} />}
      />

      {total === 0 ? (
        <Panel>
          <EmptyState
            title="No email yet"
            body="Sign-in codes, registration confirmations and camp reminders all land here, successes included, so “did it actually go out” has an answer."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul>
            {rows.map((r) => (
              <EmailRow key={r.id} row={r} />
            ))}
          </ul>
          <Pagination
            page={page}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            basePath="/admin/email"
            unit="message"
          />
        </Panel>
      )}
    </>
  );
}
