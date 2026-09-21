import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Wordmark } from "@/components/brand";
import {
  CONTACT_EMAIL,
  CONTACT_EMAIL_HREF,
  CONTACT_PHONES,
  ORG_ADDRESS,
  WHATSAPP_HREF,
} from "@/lib/brand-contact";

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Donate",
    links: [
      { href: "/camps", label: "Upcoming camps" },
      { href: "/eligibility", label: "Can I give blood?" },
      { href: "/#how", label: "What happens on the day" },
      { href: "/signin", label: "Your donor record" },
    ],
  },
  {
    heading: "Organisers",
    links: [
      { href: "/#console", label: "The console" },
      { href: "/#team", label: "Who is behind it" },
      { href: "/#impact", label: "Impact" },
      { href: "/faq", label: "FAQ" },
      { href: "/admin", label: "Sign in to the console" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/data", label: "How we handle health data" },
    ],
  },
];

/**
 * The footer.
 *
 * `data-nav-stop` marks the line the floating header must not cross. When
 * RevealFooter pins this element, its own spacer carries the attribute instead
 * and comes first in document order, so the header always finds the right edge.
 */
export function SiteFooter() {
  return (
    <footer
      data-nav-stop
      className="relative border-t border-border bg-card/40 px-5 pt-12 pb-10 sm:px-6 sm:pt-16"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.3fr_2fr]">
        <div>
          <Wordmark />
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            BlooDoc runs blood donation camps end to end: the sign-up form, the
            roster, the screening record and the follow-up. The organisers spend
            the morning with donors instead of with paper.
          </p>

          <ul className="mt-7 flex flex-col gap-3 text-sm">
            {CONTACT_PHONES.map((p) => (
              <li key={p.digits}>
                <a
                  href={`tel:+${p.digits}`}
                  className="inline-flex items-center gap-2.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Phone className="size-4 shrink-0" strokeWidth={1.9} />
                  {p.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <MessageCircle className="size-4 shrink-0" strokeWidth={1.9} />
                WhatsApp us
              </a>
            </li>
            <li>
              <a
                href={CONTACT_EMAIL_HREF}
                className="inline-flex items-center gap-2.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Mail className="size-4 shrink-0" strokeWidth={1.9} />
                {CONTACT_EMAIL}
              </a>
            </li>
            <li className="inline-flex items-center gap-2.5 text-muted-foreground">
              <MapPin className="size-4 shrink-0" strokeWidth={1.9} />
              {ORG_ADDRESS}
            </li>
          </ul>
        </div>

        <div className="grid gap-10 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h3 className="text-xs font-semibold tracking-[0.16em] text-foreground uppercase">
                {col.heading}
              </h3>
              <ul className="mt-4 flex flex-col gap-2.5 text-sm">
                {col.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="group inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                      <ArrowUpRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} BlooDoc. Registering is not a medical clearance.</p>
        <p>Eligibility is decided by the medical officer at the camp.</p>
      </div>
    </footer>
  );
}
