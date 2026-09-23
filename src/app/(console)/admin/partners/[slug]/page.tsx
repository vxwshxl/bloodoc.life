import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Droplet,
  Globe,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { PageHeader, Panel, EmptyState } from "@/components/shell/page-header";
import { CampCard, CampTag } from "@/components/camps/camp-card";
import { MemberList } from "@/components/admin/partner-manager";
import { getPartnerDetail } from "@/lib/partners/queries";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPartnerDetail(slug);
  return { title: p?.short_name ?? p?.name ?? "Partner" };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p
        className="font-display mt-1 text-2xl font-bold tracking-tight"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

export default async function PartnerDetailPage({ params }: Params) {
  const { slug } = await params;
  const p = await getPartnerDetail(slug);
  if (!p) notFound();

  const isBank = p.kind === "blood_bank";
  const Icon = isBank ? Droplet : Building2;
  const backHref = isBank ? "/admin/partners/blood-banks" : "/admin/partners/organisations";
  const members = p.members ?? [];
  const owners = members.filter((m) => m.role === "owner");

  return (
    <>
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden />
        {isBank ? "Blood banks" : "Organisations"}
      </Link>

      <PageHeader
        title={p.name}
        subtitle={
          [p.parent_institution, p.city].filter(Boolean).join(" · ") ||
          (isBank ? "Blood bank" : "Organisation")
        }
        action={
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
              isBank ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-3.5" strokeWidth={2} aria-hidden />
            {isBank ? "Blood bank" : "Organisation"}
            {!p.active && " · inactive"}
          </span>
        }
      />

      <Panel className="mb-5 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-app-line-soft sm:grid-cols-4">
          <Stat label="Camps" value={p.stats.camps} />
          <Stat label="Registrations" value={p.stats.registrations} />
          <Stat label="Donated" value={p.stats.donated} />
          <Stat label="Certificates" value={p.stats.certificates} />
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Details</h2>
          <dl className="mt-4 flex flex-col gap-2.5">
            {[
              ["Full name", p.name],
              ["Short name", p.short_name ?? "—"],
              ["Parent institution", p.parent_institution ?? "—"],
              ["Address", p.address ?? "—"],
              ["Handle", p.slug],
              ["Added", formatDateTime(p.created_at)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-app-line-soft pb-2 last:border-b-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-right text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex flex-col gap-2 text-sm">
            {p.contact_email && (
              <a href={`mailto:${p.contact_email}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Mail className="size-4" strokeWidth={1.9} aria-hidden /> {p.contact_email}
              </a>
            )}
            {p.contact_phone && (
              <a href={`tel:${p.contact_phone}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Phone className="size-4" strokeWidth={1.9} aria-hidden /> {p.contact_phone}
              </a>
            )}
            {p.website && (
              <a href={p.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Globe className="size-4" strokeWidth={1.9} aria-hidden /> {p.website}
              </a>
            )}
            {p.city && (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4" strokeWidth={1.9} aria-hidden /> {p.city}
              </span>
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="text-sm font-semibold">Who owns it</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {owners.length === 0
              ? "Nobody is marked as an owner. An owner can manage their own colleagues without an administrator."
              : `${owners.length} owner${owners.length === 1 ? "" : "s"} — they can add and remove colleagues themselves.`}
          </p>

          {/* The access list is the same control used on the Partners index, so
              adding somebody here and adding them there cannot drift apart. */}
          <MemberList partnerId={p.id} members={members} />
        </Panel>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Camps
      </h2>

      {p.camps.length === 0 ? (
        <Panel>
          <EmptyState
            title="Not attached to a camp yet"
            body="Attach this body to a camp from the camp's own page. Until then its panel shows nothing."
          />
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {p.camps.map((c) => (
            <CampCard
              key={c.id}
              camp={c}
              href={`/admin/registrations?camp=${c.id}`}
              action="Open roster"
              badge={
                <span className="flex flex-col items-end gap-1">
                  <CampTag>{c.role === "blood_bank" ? "Blood bank" : "Organiser"}</CampTag>
                  {c.is_host && <CampTag tone="primary">Host</CampTag>}
                </span>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
