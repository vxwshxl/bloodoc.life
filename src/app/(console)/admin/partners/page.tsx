import type { Metadata } from "next";
import { Building2, Droplet } from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { MemberList, NewPartnerForm } from "@/components/admin/partner-manager";
import { listPartners } from "@/lib/partners/queries";

export const metadata: Metadata = { title: "Partners" };

export default async function AdminPartners() {
  const partners = await listPartners();
  const banks = partners.filter((p) => p.kind === "blood_bank");
  const orgs = partners.filter((p) => p.kind === "organisation");

  return (
    <>
      <PageHeader
        title="Partners"
        subtitle={`${orgs.length} organisation${orgs.length === 1 ? "" : "s"} · ${banks.length} blood bank${banks.length === 1 ? "" : "s"}`}
        action={<NewPartnerForm />}
      />

      {partners.length === 0 ? (
        <Panel>
          <EmptyState
            title="No partners yet"
            body="Add the organisations that mobilise donors and the blood banks that receive the units. Attach them to a camp from the camp's own page."
          />
        </Panel>
      ) : (
        <div className="flex flex-col gap-6">
          {([
            { label: "Blood banks", rows: banks, icon: Droplet },
            { label: "Organisations", rows: orgs, icon: Building2 },
          ] as const).map(
            ({ label, rows, icon: Icon }) =>
              rows.length > 0 && (
                <section key={label}>
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    <Icon className="size-4" strokeWidth={2} aria-hidden />
                    {label}
                  </h2>
                  <div className="grid gap-3">
                    {rows.map((p) => (
                      <Panel key={p.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-display text-lg font-semibold tracking-tight">
                              {p.name}
                            </p>
                            {p.parent_institution && (
                              <p className="text-sm text-muted-foreground">
                                {p.parent_institution}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {[p.city, p.contact_email, p.contact_phone]
                                .filter(Boolean)
                                .join(" · ") || "No contact details"}
                            </p>
                          </div>
                          {!p.active && (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[0.625rem] font-semibold uppercase">
                              Inactive
                            </span>
                          )}
                        </div>

                        <MemberList partnerId={p.id} members={p.members ?? []} />
                      </Panel>
                    ))}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
    </>
  );
}
