import { Cinzel, Libre_Caslon_Text } from "next/font/google";
import type { VerifiedCertificate } from "@/lib/partners/queries";
import { artFor, type CertificateArt } from "@/lib/certificates/artwork";
import { DropMark } from "@/components/brand";
import { cn } from "@/lib/utils";

/**
 * The certificate itself, as the donor prints it.
 *
 * Shared by the public /verify page and the donor's own preview, so the two can
 * never disagree about what the certificate says. No hooks and no client-only
 * imports, which lets it render on either side.
 *
 * Two designs. A camp whose organisers made their own certificate names it in
 * `certificate_art`, and the donor gets that artwork with their name on the
 * line. Every other camp gets the standard design, laid out the same way —
 * logos, "Certificate of appreciation", the name, the drive on a ribbon, the
 * bodies that ran it along the foot — and filled from the camp's own record.
 *
 * Both are an A4-landscape page sized in container units, so the preview in a
 * dialog, the /verify page and the printed sheet are one layout at three
 * sizes rather than three layouts.
 */

// Trajan-style capitals for the title and the name, a book serif for the
// wording, the way printed certificates are set. Loaded here rather than in
// the root layout so no other page pays for them.
const display = Cinzel({ subsets: ["latin"], weight: ["600", "700"], display: "swap" });
const serif = Libre_Caslon_Text({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

/** Printed on the page, so a fixed brand domain rather than the deploy URL. */
const VERIFY_HOST = "bloodoc.life/verify";

const CRIMSON = "#8b1a1f";
const NAVY = "#1f2a5c";
const GOLD = "#c49a45";

/**
 * A font size in container units that keeps a line of `text` inside `width`.
 * `perChar` is the face's average advance in em; Cinzel's capitals are wide.
 */
function fit(text: string, max: number, width: number, perChar: number): string {
  return `${Math.min(max, width / Math.max(text.length * perChar, 1)).toFixed(2)}cqw`;
}

export function CertificateView({ cert }: { cert: VerifiedCertificate }) {
  const art = artFor(cert.art);
  return art ? <ArtworkCertificate cert={cert} art={art} /> : <StandardCertificate cert={cert} />;
}

function Page({
  aspect,
  className,
  children,
}: {
  aspect: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      // `print-color-adjust: exact`, or the browser drops every background
      // and the page prints as black text on white.
      className={cn(
        "@container relative w-full overflow-hidden select-none [print-color-adjust:exact]",
        className,
      )}
      style={{ aspectRatio: aspect }}
    >
      {children}
    </div>
  );
}

/** The line that lets anyone holding the paper check it. */
function CodeLine({ code }: { code: string }) {
  return (
    <>
      Certificate no. <span className="font-mono font-semibold tracking-wider">{code}</span>
      <span style={{ color: GOLD }}> · </span>
      Verify at {VERIFY_HOST}
    </>
  );
}

// ---------------------------------------------------------------------------
// The organisers' own artwork, with the name printed on it.
// ---------------------------------------------------------------------------

function ArtworkCertificate({ cert, art }: { cert: VerifiedCertificate; art: CertificateArt }) {
  const lineWidth = 100 - art.name.left - art.name.right;
  return (
    <Page aspect={`${art.width} / ${art.height}`} className="bg-white">
      {/* A plain <img>: this is a print master, and the optimiser would hand
          a phone a 750px rendition of a page somebody is about to print. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={art.src}
        alt={`Certificate of appreciation for ${cert.camp_title}`}
        className="pointer-events-none absolute inset-0 size-full"
        draggable={false}
      />

      <p
        className={cn(display.className, "absolute truncate text-center leading-none font-bold")}
        style={{
          left: `${art.name.left}%`,
          right: `${art.name.right}%`,
          // The box's bottom is the descender, a quarter-em under the
          // baseline; the baseline is what has to sit on the line.
          bottom: `calc(${100 - art.name.baseline}% - 0.25em)`,
          color: art.name.color,
          fontSize: fit(cert.donor_name, 2.45, lineWidth - 2, 0.78),
        }}
      >
        {cert.donor_name}
      </p>

      <p
        className="absolute inset-x-0 -translate-y-1/2 text-center text-[0.8cqw] leading-none"
        style={{ top: `${art.code.centre}%`, color: art.code.color }}
      >
        <CodeLine code={cert.code} />
      </p>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// The standard design, drawn from the camp's record.
// ---------------------------------------------------------------------------

/** "6th October, 2026" — the long form a certificate spells out. */
function longDate(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const d = Number(get("day"));
  const suffix = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return `${String(d).padStart(2, "0")}${suffix} ${get("month")}, ${get("year")}`;
}

/** "06.10.2026". */
function dottedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  })
    .format(new Date(iso))
    .replaceAll("/", ".");
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function Rule({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block h-[0.08cqw] flex-1", className)}
      style={{ background: `linear-gradient(90deg, transparent, ${GOLD} 20%, ${GOLD} 80%, transparent)` }}
    />
  );
}

function StandardCertificate({ cert }: { cert: VerifiedCertificate }) {
  const organisations = cert.partners.filter((p) => p.kind === "organisation");
  const bloodBanks = cert.partners.filter((p) => p.kind === "blood_bank");
  const logos = cert.partners.filter((p) => p.logo_url).slice(0, 5);

  // Linked partners first; the camp's free-text credits only when there are
  // none, which is how camps set up before partners existed are credited.
  const organisedBy = organisations.length
    ? organisations.map((p) => p.name)
    : [cert.organiser].filter((s): s is string => !!s);
  const inCollaboration = organisations.length ? [] : [cert.collaboration].filter((s): s is string => !!s);
  const bank = bloodBanks.length
    ? bloodBanks.map((p) => [p.name, p.parent_institution].filter(Boolean).join(", "))
    : [[cert.partner_name, cert.partner_note].filter(Boolean).join(", ")].filter(Boolean);

  const signatories = (
    cert.partners.length
      ? cert.partners.map((p) => ({
          title: p.kind === "blood_bank" ? "Blood bank partner" : null,
          name: p.name,
        }))
      : [
          ...(cert.organiser ? [{ title: "Organised by", name: cert.organiser }] : []),
          ...(cert.partner_name ? [{ title: "Blood bank partner", name: cert.partner_name }] : []),
        ]
  ).slice(0, 5);

  const where = [cert.venue, cert.city].filter(Boolean).join(", ");

  return (
    <Page aspect="297 / 210" className="bg-[#fbf8f2]">
      <Frame />

      <div
        className="absolute inset-[4.2cqw] flex flex-col items-center text-center"
        style={{ color: NAVY }}
      >
        {/* Logos of the bodies behind the drive, or the BlooDoc mark when
            none has one on file. */}
        <div className="flex h-[5.2cqw] items-center justify-center gap-[2cqw]">
          {logos.length ? (
            logos.map((p, i) => (
              <span key={p.name} className="flex h-full items-center gap-[2cqw]">
                {i > 0 && <span aria-hidden className="h-[80%] w-[0.08cqw]" style={{ background: GOLD }} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.logo_url!} alt={p.name} className="h-full w-auto max-w-[12cqw] object-contain" />
              </span>
            ))
          ) : (
            <span className="flex items-center gap-[0.8cqw]">
              <DropMark className="size-[4.4cqw]" />
              <span className="text-[2cqw] leading-none font-extrabold tracking-tight">
                BLOOD<span style={{ color: CRIMSON }}>OC</span>
              </span>
            </span>
          )}
        </div>

        {/* The body takes whatever height the page has left and centres in
            it, so a short paragraph does not leave a dead band above the date. */}
        <div className="my-auto flex flex-col items-center py-[1cqw]">
        <p
          className={cn(display.className, "text-[6.8cqw] leading-none font-bold tracking-[0.03em]")}
          style={{
            color: CRIMSON,
            textShadow: "0 0.12cqw 0 rgba(90, 10, 14, 0.18)",
          }}
        >
          CERTIFICATE
        </p>
        <p className="mt-[0.9cqw] flex w-[62cqw] items-center gap-[1.4cqw] text-[1.55cqw] leading-none font-semibold tracking-[0.42em]">
          <Rule />
          <span className="pl-[0.42em]">OF APPRECIATION</span>
          <Rule />
        </p>
        <Flourish />

        <p className="mt-[1.2cqw] text-[0.95cqw] leading-none font-medium tracking-[0.24em]">
          THIS IS TO PROUDLY CERTIFY THAT
        </p>

        <p
          className={cn(display.className, "mt-[1.3cqw] w-[54cqw] truncate pb-[0.5cqw] leading-none font-bold")}
          style={{
            color: CRIMSON,
            fontSize: fit(cert.donor_name, 3.8, 52, 0.78),
            borderBottom: `0.1cqw solid ${GOLD}`,
          }}
        >
          {cert.donor_name}
        </p>

        <p
          className={cn(serif.className, "mt-[1.2cqw] text-[1.35cqw] leading-none font-bold tracking-[0.04em]")}
          style={{ color: CRIMSON }}
        >
          SUCCESSFULLY DONATED{cert.blood_group !== "unknown" ? ` (${cert.blood_group})` : ""} IN THE
        </p>

        {/* The ribbon: a crimson band with notched tails. */}
        <p
          className={cn(serif.className, "mt-[0.9cqw] flex min-h-[3.4cqw] max-w-[66cqw] items-center px-[4.2cqw] leading-tight font-bold text-white uppercase")}
          style={{
            background: `linear-gradient(180deg, #a3242a, ${CRIMSON} 55%, #6e1217)`,
            clipPath:
              "polygon(0 0, 100% 0, calc(100% - 1.6cqw) 50%, 100% 100%, 0 100%, 1.6cqw 50%)",
            fontSize: fit(cert.camp_title, 1.9, 56, 0.62),
            letterSpacing: "0.03em",
          }}
        >
          {cert.camp_title}
        </p>

        <p className={cn(serif.className, "mt-[1cqw] text-[1.3cqw] leading-snug font-bold")}>
          and made a valuable contribution towards saving lives.
        </p>

        <p className={cn(serif.className, "mt-[1.1cqw] max-w-[56cqw] text-[1.2cqw] leading-[1.5] text-balance")}>
          The {cert.camp_title} was held on{" "}
          <strong style={{ color: CRIMSON }}>{longDate(cert.camp_date)}</strong> at {where}
          {organisedBy.length > 0 && (
            <>
              , organised by <strong>{joinNames(organisedBy)}</strong>
            </>
          )}
          {inCollaboration.length > 0 && (
            <>
              {" "}in collaboration with <strong>{joinNames(inCollaboration)}</strong>
            </>
          )}
          .
          {bank.length > 0 && (
            <>
              {" "}Blood bank partner: <strong>{joinNames(bank)}</strong>.
            </>
          )}
        </p>
        </div>

        {/* Date and venue, pinned to the foot with the signatures. */}
        <div className="flex w-full items-end justify-between px-[1cqw] text-left">
          <Stamp label="Date" value={dottedDate(cert.camp_date)} />
          <Stamp label="Venue" value={cert.venue} align="right" />
        </div>

        <span className="mt-[0.8cqw] flex w-full items-center">
          <Rule />
        </span>

        {signatories.length > 0 && (
          <div
            // Inset on the right so the last column clears the corner band.
            className="mt-[2.6cqw] grid w-full pr-[7cqw] pl-[1cqw]"
            style={{ gridTemplateColumns: `repeat(${signatories.length}, minmax(0, 1fr))` }}
          >
            {signatories.map((s, i) => (
              <div
                key={`${s.name}-${i}`}
                className="flex flex-col items-center px-[1cqw]"
                style={i > 0 ? { borderLeft: `0.08cqw solid ${GOLD}` } : undefined}
              >
                <span aria-hidden className="h-[0.06cqw] w-[80%]" style={{ background: NAVY, opacity: 0.35 }} />
                <span className="mt-[0.6cqw] text-[0.78cqw] leading-tight tracking-[0.04em] uppercase">
                  {s.title && <span className="block font-semibold">{s.title}</span>}
                  {s.name}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-[1.2cqw] text-[0.72cqw] leading-none">
          <CodeLine code={cert.code} />
        </p>
      </div>
    </Page>
  );
}

function Stamp({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  return (
    <div className={cn("max-w-[26cqw]", align === "right" && "text-right")}>
      <p className="text-[0.85cqw] leading-none font-medium tracking-[0.14em] uppercase">{label}</p>
      <p className={cn(serif.className, "mt-[0.4cqw] text-[1.25cqw] leading-tight font-bold")}>{value}</p>
    </div>
  );
}

/** The small gold ornament under the title. */
function Flourish() {
  return (
    <svg aria-hidden viewBox="0 0 120 10" className="mt-[0.6cqw] w-[16cqw]" fill="none">
      <path d="M2 5h44M74 5h44" stroke={GOLD} strokeWidth="0.8" />
      <path d="M60 1l4 4-4 4-4-4 4-4Z" fill={GOLD} />
      <path d="M52 5c2-3 4-3 6 0M68 5c-2-3-4-3-6 0M52 5c2 3 4 3 6 0M68 5c-2 3-4 3-6 0" stroke={GOLD} strokeWidth="0.8" />
    </svg>
  );
}

/**
 * The border and the decoration: a double gold rule, crimson-and-navy corner
 * bands, and pale drops either side. One SVG over the whole page, drawn in the
 * page's own 297 × 210 units so it scales with everything else.
 */
function Frame() {
  return (
    <svg aria-hidden viewBox="0 0 297 210" className="pointer-events-none absolute inset-0 size-full">
      <defs>
        <linearGradient id="cert-drop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3c4c4" />
          <stop offset="1" stopColor="#e39a9c" />
        </linearGradient>
      </defs>

      <rect x="4" y="4" width="289" height="202" fill="none" stroke={GOLD} strokeWidth="0.9" />
      <rect x="6" y="6" width="285" height="198" fill="none" stroke={GOLD} strokeWidth="0.3" />

      {/* Corner bands: navy under crimson, top-left and bottom-right. */}
      <path d="M0 0h34L0 34Z" fill={NAVY} />
      <path d="M0 0h29L0 29Z" fill={CRIMSON} />
      <path d="M29 0h1.6L0 30.6V29Z" fill={GOLD} />
      <path d="M297 210h-34l34-34Z" fill={NAVY} />
      <path d="M297 210h-29l29-29Z" fill={CRIMSON} />
      <path d="M268 210h-1.6l30.6-30.6V181Z" fill={GOLD} />

      {/* The mark, grown and faded: a drop, a heart and two cupped hands. */}
      <g opacity="0.5" transform="translate(14 62) scale(2.2)">
        <path
          d="M16 1.6c.52 0 .95.23 1.24.63C20.1 6.1 26.6 14.3 26.6 19.7a10.6 10.6 0 0 1-21.2 0c0-5.4 6.5-13.6 9.36-17.47.29-.4.72-.63 1.24-.63Z"
          fill="url(#cert-drop)"
        />
        <path
          d="M9.5 15.9C7.9 20.9 10.9 25.6 15.4 26.3v-1.75C12.3 23.8 10 20.6 9.5 15.9ZM22.5 15.9c1.6 5-1.4 9.7-5.9 10.4v-1.75c3.1-.75 5.4-3.95 5.9-8.65Z"
          fill="#fff"
        />
        <path
          d="M16 23.1c-3.9-2.5-5.5-4.8-5.2-6.8.3-2 2.7-2.9 4.3-1.6l.9.8.9-.8c1.6-1.3 4-.4 4.3 1.6.3 2-1.3 4.3-5.2 6.8Z"
          fill="#fff"
        />
        <path d="M15.3 16.4h1.4v1.3H18v1.4h-1.3v1.3h-1.4v-1.3H14v-1.4h1.3Z" fill="#e39a9c" />
      </g>

      {/* Falling drops, right. */}
      <g fill="url(#cert-drop)" opacity="0.45">
        <path d="M262 62c4 6 9 12 9 17a9 9 0 0 1-18 0c0-5 5-11 9-17Z" />
        <path d="M247 96c3 5 7 9 7 13a7 7 0 0 1-14 0c0-4 4-8 7-13Z" />
        <path d="M268 104c2.5 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 3-6 5.5-10Z" />
      </g>
    </svg>
  );
}
