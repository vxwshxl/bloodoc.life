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
 *  - **Vercel's geo headers**, not Cloudflare's, because that is where this
 *    deploys. Both are read anyway; whichever is present wins.
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

/** City, region, country — from whichever edge added them. */
function edgeLocation(h: Headers): string | null {
  const parts = [
    h.get("x-vercel-ip-city") ?? h.get("cf-ipcity"),
    h.get("x-vercel-ip-country-region") ?? h.get("cf-region"),
    h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"),
  ]
    .map((p) => (p ? decodeURIComponent(p).trim() : ""))
    .filter((p) => p && p !== "XX");
  return parts.length ? parts.join(", ") : null;
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
