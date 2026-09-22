import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, FileX2, PencilLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import {
  Pagination,
  DEFAULT_PAGE_SIZE,
  pageFromParams,
  rangeFor,
} from "@/components/shell/pagination";
import { formatDateTime } from "@/lib/format";
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
  searchParams: Promise<{ page?: string; table?: string }>;
}) {
  const { page: pageParam, table } = await searchParams;
  const page = pageFromParams(pageParam);
  const active = TABLES.includes(table as (typeof TABLES)[number]) ? table : undefined;

  const supabase = await createClient();
  const [from, to] = rangeFor(page);
  let q = supabase
    .from("audit_log")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (active) q = q.eq("table_name", active);
  const { data, count } = await q;

  const rows = (data ?? []) as AuditLog[];
  const total = count ?? 0;

  return (
    <>
      <PageHeader
        title="Audit"
        subtitle="Every change to a donor, camp, registration, partner or certificate — written by the database, not by the app."
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/admin/audit"
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            !active
              ? "border-transparent bg-primary text-primary-foreground"
              : "border-app-line text-muted-foreground hover:bg-muted",
          )}
        >
          Everything
        </Link>
        {TABLES.map((t) => (
          <Link
            key={t}
            href={`/admin/audit?table=${t}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active === t
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-app-line text-muted-foreground hover:bg-muted",
            )}
          >
            {t.replace(/_/g, " ")}
          </Link>
        ))}
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
                <li
                  key={r.id}
                  className="flex items-start gap-3 border-b border-app-line-soft px-5 py-3 last:border-b-0"
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
                </li>
              );
            })}
          </ul>
          <Pagination
            page={page}
            total={total}
            pageSize={DEFAULT_PAGE_SIZE}
            basePath="/admin/audit"
            params={{ table: active }}
            unit="change"
          />
        </Panel>
      )}
    </>
  );
}
