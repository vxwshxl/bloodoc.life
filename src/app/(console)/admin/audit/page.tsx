import type { Metadata } from "next";
import { FilePlus2, FileX2, PencilLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  pageFromParams,
  rangeFor,
} from "@/components/shell/pagination";
import { SearchBox } from "@/components/shell/search-box";
import { FilterMenu } from "@/components/shell/filter-menu";
import { formatDateTime } from "@/lib/format";
import { DetailRow } from "@/components/shell/detail-row";
import { DetailList } from "@/components/shell/detail-list";
import type { AuditLog } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit" };

const TABLES = [
  "donors",
  "camps",
  "registrations",
  "partners",
  "partner_members",
  "camp_partners",
  "certificates",
  "profiles",
] as const;

const ACTION_STYLE = {
  insert: { icon: FilePlus2, tone: "bg-primary/12 text-primary", verb: "created" },
  update: { icon: PencilLine, tone: "bg-muted text-foreground", verb: "changed" },
  delete: { icon: FileX2, tone: "bg-destructive/12 text-destructive", verb: "deleted" },
} as const;

/** Render a stored value compactly — these are jsonb, so anything can turn up. */
function show(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v === "" ? "—" : v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; table?: string; q?: string }>;
}) {
  const { page: pageParam, table, q } = await searchParams;
  const page = pageFromParams(pageParam);
  const active = TABLES.includes(table as (typeof TABLES)[number]) ? table : undefined;

  const supabase = await createClient();
  const [from, to] = rangeFor(page);
  let query = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (active) query = query.eq("table_name", active);
  if (q?.trim()) {
    const term = `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    query = query.or(`actor_email.ilike.${term},record_id.ilike.${term}`);
  }
  const { data, count } = await query;


  const rows = (data ?? []) as AuditLog[];
  const total = count ?? 0;

  return (
    <>
      <PageHeader
        title="Audit"
        subtitle="Every change to a donor, camp, registration, partner or certificate — written by the database, not by the app."
      />

      <div className="mb-4">
        <SearchBox
          placeholder="Who changed it, or a record id"
          defaultValue={q}
          keep={{ table: active }}
          clearHref="/admin/audit"
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {/* A menu, not a chip per table. Eight tables already wrapped to two
            lines, and every table added to the audit trigger would add
            another. */}
        <FilterMenu
          label="Table"
          paramName="table"
          active={active}
          options={TABLES.map((t) => ({ value: t, label: t.replace(/_/g, " ") }))}
        />
      </div>

      {total === 0 ? (
        <Panel>
          <EmptyState
            title="Nothing recorded yet"
            body="Changes appear here as soon as anybody edits a record. The log cannot be edited or deleted from the console — there is no policy that would allow it."
          />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <ul>
            {rows.map((r) => {
              const style = ACTION_STYLE[r.action];
              const Icon = style.icon;
              const changes = r.changes ?? {};
              // An update stores { col: { from, to } }; an insert or delete
              // stores the whole row, which is too much for a list line.
              const isDiff = r.action === "update";
              const keys = Object.keys(changes);

              return (
                <DetailRow
                  key={r.id}
                  as="li"
                  label={`Open change by ${r.actor_email ?? "System"}`}
                  title={`${style.verb[0].toUpperCase()}${style.verb.slice(1)} ${r.table_name.replace(/_/g, " ").replace(/s$/, "")}`}
                  description={`${r.actor_email ?? "System"} · ${formatDateTime(r.created_at)}`}
                  detail={
                    <div className="flex flex-col gap-5">
                      <DetailList
                        items={[
                          ["Table", r.table_name.replace(/_/g, " ")],
                          ["Record", r.record_id ? <span key="id" className="font-mono text-xs">{r.record_id}</span> : null],
                          ["By", r.actor_email ?? "System"],
                          ["When", formatDateTime(r.created_at)],
                        ]}
                      />
                      {keys.length > 0 && (
                        <DetailList
                          heading={isDiff ? "What changed" : "Record"}
                          items={keys.map((k) => {
                            const c = changes[k] as { from?: unknown; to?: unknown };
                            return [
                              k.replace(/_/g, " "),
                              isDiff ? (
                                <span key={k}>
                                  <span className="text-muted-foreground line-through">{show(c?.from)}</span>
                                  <span className="mx-1 text-muted-foreground">→</span>
                                  {show(c?.to)}
                                </span>
                              ) : (
                                show(changes[k])
                              ),
                            ] as [string, React.ReactNode];
                          })}
                        />
                      )}
                    </div>
                  }
                  className="flex items-start gap-3 px-5 py-3"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
                      style.tone,
                    )}
                  >
                    <Icon className="size-3.5" strokeWidth={2} aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">
                        {r.actor_email ?? "System"}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {style.verb} a {r.table_name.replace(/_/g, " ").replace(/s$/, "")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.created_at)}
                      {r.record_id ? ` · ${r.record_id.slice(0, 8)}` : ""}
                    </p>

                    {isDiff && keys.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-0.5">
                        {keys.slice(0, 6).map((k) => {
                          const c = changes[k] as { from?: unknown; to?: unknown };
                          return (
                            <li key={k} className="text-xs">
                              <span className="text-muted-foreground">{k.replace(/_/g, " ")}: </span>
                              <span className="text-muted-foreground line-through">
                                {show(c?.from)}
                              </span>
                              <span className="mx-1 text-muted-foreground">→</span>
                              <span className="font-medium">{show(c?.to)}</span>
                            </li>
                          );
                        })}
                        {keys.length > 6 && (
                          <li className="text-xs text-muted-foreground">
                            and {keys.length - 6} more
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                </DetailRow>
              );
            })}
          </ul>
          <Pagination
            page={page}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            basePath="/admin/audit"
            params={{ table: active, q }}
            unit="change"
          />
        </Panel>
      )}
    </>
  );
}
