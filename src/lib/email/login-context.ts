import "server-only";

import { headers } from "next/headers";

/**
 * Who, roughly, just signed in — for the "new sign-in" email.
 *
 * Everything here is best-effort and the email says so. Two deliberate
 * differences from the version this is modelled on:
 *
 *  - **No third-party IP lookup.** The original falls back to ipwho.is when
 *    edge headers are absent, which means posting a donor's IP address to a
 *    company with no relationship to them. On a register of blood donors that
 *    is not a trade worth making for a city name, so location comes only from
 *    headers the platform already added to the request, and reads "Unknown"
 *    otherwise.
 *  - **Cloudflare's geo headers before Vercel's**, because Cloudflare proxies
 *    this domain and Vercel therefore geolocates a Cloudflare data centre
 *    rather than the donor. See `edgeLocation` for what that cost us.
 *
 * The device string is parsed from the User-Agent by hand. The email needs
 * "Chrome on Android", not a device database.
 */

export type LoginContext = {
  ip: string;
  location: string;
  device: string;
  time: string;
};

function firstIp(h: Headers): string | null {
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip")?.trim() ?? null;
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith("fc") ||
    ip.startsWith("fd") ||
    ip.startsWith("::ffff:127.")
  );
}

export function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";

  let os = "Unknown OS";
  if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  // `wv` marks a WebView, which is what an in-app browser reports.
  if (/; wv\)/.test(ua)) return `${os === "Unknown OS" ? "Mobile" : os} app`;

  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return `${browser} on ${os}`;
}

/**
 * Country codes worth spelling out. Anything else is shown as its code.
 *
 * Not a full ISO table: this email is read by donors in India, and the list
 * exists so "IN" reads as "India" rather than as a mystery.
 */
const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  SG: "Singapore",
  US: "United States",
  GB: "United Kingdom",
  AE: "United Arab Emirates",
  AU: "Australia",
  BD: "Bangladesh",
  BT: "Bhutan",
  CA: "Canada",
  DE: "Germany",
  NP: "Nepal",
};

/**
 * City, region, country — from whichever edge actually looked at the donor.
 *
 * Which edge that is turns out to matter enormously, and getting it wrong is
 * what made this email tell somebody in Guwahati they had signed in from
 * Singapore.
 *
 * bloodoc.life is proxied by Cloudflare, which then forwards to Vercel. So the
 * address Vercel sees is a Cloudflare data centre, and `x-vercel-ip-city` is
 * the city of *that machine* — the PoP an Airtel connection in Assam happens to
 * route to, which is Singapore. The donor's real address arrives separately, in
 * `cf-connecting-ip`, which is why the IP line in the email was right the whole
 * time while the line above it was wrong.
 *
 * So: the presence of `cf-connecting-ip` means Cloudflare is in front, and
 * every `x-vercel-ip-*` header describes the wrong computer. Cloudflare's own
 * headers are the only ones that saw the donor.
 *
 * The cost is precision. `cf-ipcountry` is sent on every Cloudflare plan;
 * `cf-ipcity` and `cf-region` are Enterprise-only, so in practice this now
 * says "India" where it used to say a city — and a correct country beats a
 * confident wrong city in an email whose entire purpose is to let somebody
 * recognise a sign-in that was not theirs.
 */
function edgeLocation(h: Headers): string | null {
  const behindCloudflare = !!h.get("cf-connecting-ip");

  const raw = behindCloudflare
    ? [h.get("cf-ipcity"), h.get("cf-region"), h.get("cf-ipcountry")]
    : [
        h.get("x-vercel-ip-city"),
        h.get("x-vercel-ip-country-region"),
        h.get("x-vercel-ip-country"),
      ];

  const parts = raw
    .map((p) => (p ? decodeURIComponent(p).trim() : ""))
    // "XX" is Cloudflare's answer for an address it cannot place, and "T1" is
    // its answer for Tor. Neither is a location.
    .filter((p) => p && p !== "XX" && p !== "T1");

  if (!parts.length) return null;

  const last = parts[parts.length - 1];
  if (last.length === 2) parts[parts.length - 1] = COUNTRY_NAMES[last] ?? last;

  return parts.join(", ");
}

export async function getLoginContext(): Promise<LoginContext> {
  const h = await headers();
  const ip = firstIp(h);

  return {
    ip: !ip || isPrivateIp(ip) ? "Unknown" : ip,
    location: edgeLocation(h) ?? "Unknown",
    device: describeDevice(h.get("user-agent")),
    // Asia/Kolkata rather than the server's zone: every reader of this email is
    // in India, and a UTC timestamp would have somebody checking whether 06:30
    // was them.
    time: new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  };
}
