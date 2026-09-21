import "server-only";

import { SITE_URL } from "@/lib/site-url";

// Branded email HTML. Mail clients have no Tailwind, no external stylesheets
// and no custom properties, so everything here is inline-styled table markup
// and the palette is the app's light theme translated to hex — globals.css is
// oklch, which nothing in Gmail, Outlook or Apple Mail understands.

// --- Palette (hex of the app's light tokens) -------------------------------

const BRAND = "#C41F22"; // --primary, crimson
const INK = "#141414"; // --foreground
const MUTED = "#5d5d5d"; // --muted-foreground
const BORDER = "#e4e4e4"; // --border
const CARD_BG = "#f7f6f6"; // --muted
const PAGE_BG = "#f1efef"; // the ground the card floats on

/**
 * Webfonts do not survive Gmail, so the app's Geist is matched to the closest
 * native UI face on each platform. This has to be repeated on every text
 * element: a client that sees no font-family on a block falls back to Times New
 * Roman, which is what makes an otherwise careful email read as spam.
 */
const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Only http(s) hrefs reach a template; anything else becomes "#". */
function safeHref(url: string): string {
  return /^https?:\/\//i.test(url.trim()) ? url.trim() : "#";
}

// --- Content blocks --------------------------------------------------------

export type Block = string;

export function heading(text: string): Block {
  return `<h1 style="margin:0 0 14px;font-family:${FONT};font-size:21px;line-height:1.3;font-weight:600;letter-spacing:-0.01em;color:${INK};">${escapeHtml(text)}</h1>`;
}

/** A body paragraph. `rich` only for pre-escaped, known-safe HTML. */
export function paragraph(text: string, opts?: { muted?: boolean; rich?: boolean }): Block {
  const color = opts?.muted ? MUTED : INK;
  const size = opts?.muted ? "13px" : "15px";
  const content = opts?.rich ? text : escapeHtml(text);
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:${size};line-height:1.65;color:${color};">${content}</p>`;
}

/** A label → value card: camp details, a donor's summary. */
export function infoCard(rows: Array<{ label: string; value: string; strong?: boolean }>): Block {
  const last = rows.length - 1;
  const trs = rows
    .map(
      (r, i) => `
      <tr>
        <td style="padding:11px 0;${i < last ? `border-bottom:1px solid ${BORDER};` : ""}font-family:${FONT};font-size:13px;color:${MUTED};">${escapeHtml(r.label)}</td>
        <td align="right" style="padding:11px 0;${i < last ? `border-bottom:1px solid ${BORDER};` : ""}font-family:${FONT};font-size:${r.strong ? "17px" : "14px"};font-weight:${r.strong ? 600 : 500};color:${INK};">${escapeHtml(r.value)}</td>
      </tr>`,
    )
    .join("");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
      style="margin:0 0 22px;border:1px solid ${BORDER};border-radius:12px;background:${CARD_BG};">
      <tr><td style="padding:6px 18px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${trs}</table>
      </td></tr>
    </table>`;
}

export function button(label: string, url: string): Block {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:2px 0 24px;">
      <tr><td style="border-radius:10px;background:${BRAND};">
        <a href="${safeHref(url)}"
          style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
          ${escapeHtml(label)}
        </a>
      </td></tr>
    </table>`;
}

/**
 * The sign-in code.
 *
 * Wide letter-spacing and a monospace face because this is the one string in
 * the email a person has to copy by eye, digit by digit, from one window into
 * another — a proportional face at body size is where 0/O and 1/l go wrong.
 */
export function codeBlock(code: string): Block {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      <tr><td align="center" style="padding:22px;border:1px solid ${BORDER};border-radius:12px;background:${CARD_BG};">
        <span style="font-family:${MONO};font-size:32px;font-weight:600;letter-spacing:8px;color:${BRAND};">${escapeHtml(code)}</span>
      </td></tr>
    </table>`;
}

/** A quiet note in a tinted rail — security warnings, eligibility reminders. */
export function notice(text: string): Block {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
      <tr><td style="padding:12px 16px;border-left:3px solid ${BRAND};background:${CARD_BG};border-radius:0 8px 8px 0;">
        <p style="margin:0;font-family:${FONT};font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(text)}</p>
      </td></tr>
    </table>`;
}

// --- Shell -----------------------------------------------------------------

export type RenderEmailInput = {
  /** The hidden line an inbox shows next to the subject. */
  preheader: string;
  blocks: Block[];
  footerNote?: string;
};

/**
 * Wrap blocks in the branded shell.
 *
 * The masthead is light rather than a coloured slab, matching the app's own
 * floating surfaces, and the brand shows as a 3px rule under it. The mark is
 * inline SVG with a PNG-free fallback of nothing: Gmail strips <svg>, so the
 * wordmark carries the identity on its own and the drop is a bonus where it
 * renders (Apple Mail, most desktop clients).
 */
export function renderEmail(input: RenderEmailInput): string {
  const year = new Date().getFullYear();
  const site = SITE_URL;

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>BlooDoc</title></head>
<body style="margin:0;padding:0;background:${PAGE_BG};font-family:${FONT};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE_BG};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0"
        style="width:580px;max-width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:14px;overflow:hidden;">
        <tr><td style="padding:20px 32px;border-bottom:1px solid ${BORDER};">
          <span style="font-family:${FONT};font-size:16px;font-weight:600;letter-spacing:-0.01em;color:${INK};">Bloo<span style="color:${BRAND};">Doc</span></span>
          <span style="font-family:${FONT};font-size:12px;color:${MUTED};margin-left:8px;">give blood, give life</span>
        </td></tr>
        <tr><td style="height:3px;background:${BRAND};line-height:3px;font-size:0;">&nbsp;</td></tr>
        <tr><td style="padding:30px 32px 8px;">
          ${input.blocks.join("\n")}
        </td></tr>
        <tr><td style="padding:18px 32px 22px;border-top:1px solid ${BORDER};">
          ${input.footerNote ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:1.55;color:${MUTED};">${escapeHtml(input.footerNote)}</p>` : ""}
          <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.55;color:${MUTED};">© ${year} BlooDoc · <a href="${safeHref(site)}" style="color:${INK};text-decoration:none;font-weight:600;">bloodoc.life</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
