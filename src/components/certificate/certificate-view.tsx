import type { VerifiedCertificate } from "@/lib/partners/queries";
import { formatCampDate } from "@/lib/format";

/**
 * The certificate itself: name, blood group, camp, the bodies that ran it and
 * the code.
 *
 * Shared by the public /verify page and the donor's own preview, so the two can
 * never disagree about what the certificate says. No hooks and no client-only
 * imports, which lets it render on either side.
 */
export function CertificateView({ cert }: { cert: VerifiedCertificate }) {
  return (
    <div className="px-6 py-8 text-center sm:px-10 sm:py-10">
      <p className="text-[0.625rem] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        Certificate of blood donation
      </p>

      <p className="font-display mt-5 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {cert.donor_name}
      </p>

      {cert.blood_group !== "unknown" && (
        <p className="mt-2 inline-flex h-7 min-w-10 items-center justify-center rounded-md bg-primary/12 px-2 text-sm font-bold text-primary">
          {cert.blood_group}
        </p>
      )}

      <p className="mt-6 text-sm leading-relaxed text-muted-foreground">donated blood at</p>
      <p className="font-display mt-1 text-xl font-semibold tracking-tight text-balance">
        {cert.camp_title}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatCampDate(cert.camp_date)} · {cert.venue}
        {cert.city ? `, ${cert.city}` : ""}
      </p>

      {cert.partners.length > 0 && (
        <div className="mt-8 border-t border-border pt-6">
          <div className="grid gap-5 sm:grid-cols-2">
            {(["organisation", "blood_bank"] as const).map((kind) => {
              const group = cert.partners.filter((p) => p.kind === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind}>
                  <p className="text-[0.625rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    {kind === "blood_bank" ? "Blood bank" : "Organised by"}
                  </p>
                  {group.map((p) => (
                    <div key={p.name} className="mt-1.5">
                      <p className="text-sm font-semibold">{p.name}</p>
                      {p.parent_institution && (
                        <p className="text-xs text-muted-foreground">{p.parent_institution}</p>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-1 border-t border-border pt-6">
        <p className="font-mono text-sm font-semibold tracking-wider">{cert.code}</p>
        <p className="text-xs text-muted-foreground">
          {cert.issued_at
            ? `Issued ${formatCampDate(cert.issued_at)}`
            : "Awaiting the blood bank's sign-off"}
        </p>
      </div>
    </div>
  );
}
