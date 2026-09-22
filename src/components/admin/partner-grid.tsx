import Link from "next/link";
import { Building2, Droplet, Users } from "lucide-react";
import { Panel, EmptyState } from "@/components/shell/page-header";
import type { PartnerWithMembers } from "@/lib/partners/queries";

/**
 * Partners as cards rather than rows.
 *
 * A partner is a thing with an identity — a name, a parent institution, a set
 * of people — and a table row flattens all of that into one line of text. The
 * whole card is the link to its detail page, so there is one target rather than
 * a row with a "View" affordance hiding at the end of it.
 */
export function PartnerGrid({
  partners,
  empty,
}: {
  partners: PartnerWithMembers[];
  empty: { title: string; body: string };
}) {
  if (partners.length === 0) {
    return (
      <Panel>
        <EmptyState title={empty.title} body={empty.body} />
      </Panel>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {partners.map((p) => {
        const members = p.members ?? [];
        // Somebody invited but never signed in is the state an admin is
        // usually checking for, so it earns its own number rather than being
        // folded into the total.
        const pending = members.filter((m) => !m.profile_id).length;
        const Icon = p.kind === "blood_bank" ? Droplet : Building2;

        return (
          <Link
            key={p.id}
            href={`/admin/partners/${p.slug}`}
            className="group press grain flex flex-col rounded-2xl border border-app-line-soft bg-card p-5 shadow-card transition-[border-color] hover:border-primary/40"
          >
            <span className="flex items-start gap-3">
              <span
                className={
                  p.kind === "blood_bank"
                    ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"
                    : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
                }
              >
                <Icon className="size-4.5" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-display block text-base leading-tight font-semibold tracking-tight">
                  {p.name}
                </span>
                {p.parent_institution && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {p.parent_institution}
                  </span>
                )}
              </span>
              {!p.active && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-semibold uppercase">
                  Inactive
                </span>
              )}
            </span>

            <span className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" strokeWidth={1.9} aria-hidden />
                {members.length} with access
              </span>
              {pending > 0 && <span>{pending} not signed in yet</span>}
              {p.city && <span>{p.city}</span>}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
