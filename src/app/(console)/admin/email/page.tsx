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
import { SearchBox } from "@/components/shell/search-box";
import type { EmailLog } from "@/lib/db/types";

export const metadata: Metadata = { title: "Email" };

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = pageFromParams(pageParam);

  const supabase = await createClient();
  // `count: "exact"` in the same round trip as the rows — the pager needs the
  // total and a second query would be a second chance for the two to disagree
  // while email is being sent underneath them.
  const [from, to] = rangeFor(page);
  let query = supabase
    .from("email_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (q?.trim()) {
    // Escaped: `%` and `_` are wildcards in `ilike`, and a search box is the
    // one place a reader can type them.
    const term = `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    query = query.or(`subject.ilike.${term},to_email.ilike.${term}`);
  }
  const { data, count } = await query;

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

      <div className="mb-5">
        <SearchBox
          placeholder="Subject or recipient"
          defaultValue={q}
          clearHref="/admin/email"
        />
      </div>

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
            params={{ q }}
            unit="message"
          />
        </Panel>
      )}
    </>
  );
}
