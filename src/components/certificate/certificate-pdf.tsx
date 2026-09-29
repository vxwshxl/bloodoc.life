"use client";

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { VerifiedCertificate } from "@/lib/partners/queries";
import { CertificateView } from "@/components/certificate/certificate-view";

/**
 * Certificates as PDF files, made in the browser.
 *
 * The page is drawn by `CertificateView` — the component /verify and the
 * donor's dashboard render — and photographed, so a downloaded certificate
 * cannot drift from the one the donor sees. A server-side PDF would need the
 * standard design written a second time in a PDF library's drawing calls, and
 * the two would disagree within a month.
 *
 * The three libraries are imported on first use, so the console does not ship
 * them to anybody who never presses download.
 */

/** A4 landscape at 150 dpi; captured at 1.5× that, about 225 dpi on paper. */
const WIDTH = 1754;
const SCALE = 1.5;

async function capture(cert: VerifiedCertificate): Promise<string> {
  const host = document.createElement("div");
  // Off-screen but laid out: `display: none` would give it no size at all.
  host.style.cssText = `position:fixed;left:-30000px;top:0;width:${WIDTH}px;pointer-events:none;`;
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<CertificateView cert={cert} />));
    await document.fonts.ready;
    await Promise.all(
      [...host.querySelectorAll("img")].map((img) => img.decode().catch(() => undefined)),
    );
    const page = host.firstElementChild as HTMLElement;
    const { domToJpeg } = await import("modern-screenshot");
    // No `backgroundColor`: it paints over the page's own, and the standard
    // design's cream paper came out white.
    return await domToJpeg(page, { scale: SCALE, quality: 0.9 });
  } finally {
    root.unmount();
    host.remove();
  }
}

async function toPdf(cert: VerifiedCertificate): Promise<ArrayBuffer> {
  const [{ jsPDF }, image] = await Promise.all([import("jspdf"), capture(cert)]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  // Both designs are drawn at A4's own proportions, so the image fills the
  // sheet edge to edge without stretching.
  pdf.addImage(image, "JPEG", 0, 0, 297, 210);
  pdf.setProperties({
    title: `Certificate — ${cert.donor_name}`,
    subject: cert.camp_title,
    creator: "BlooDoc",
  });
  return pdf.output("arraybuffer");
}

/** "Priyanka Baruah - BD-2026-9F3A7C.pdf": the name to find it by, the code to keep two Priyankas apart. */
export function certificateFileName(cert: VerifiedCertificate): string {
  const name = cert.donor_name.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
  return `${name || "Donor"} - ${cert.code}.pdf`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick, after the browser has taken the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadCertificatePdf(cert: VerifiedCertificate) {
  const bytes = await toPdf(cert);
  save(new Blob([bytes], { type: "application/pdf" }), certificateFileName(cert));
}

/**
 * Every certificate as its own PDF, in one zip.
 *
 * One at a time, not all at once: each capture holds a full-size image in
 * memory, and three hundred in parallel is how a laptop tab dies halfway.
 * Stored, not compressed — the PDFs are already JPEG inside, and deflating
 * them again takes time and saves nothing.
 */
export async function downloadCertificatesZip(
  certs: VerifiedCertificate[],
  zipName: string,
  onProgress?: (done: number, total: number) => void,
) {
  const { zipSync } = await import("fflate");
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (let i = 0; i < certs.length; i++) {
    onProgress?.(i, certs.length);
    files[certificateFileName(certs[i])] = [new Uint8Array(await toPdf(certs[i])), { level: 0 }];
  }
  onProgress?.(certs.length, certs.length);
  const zip = zipSync(files);
  save(new Blob([zip as BlobPart], { type: "application/zip" }), zipName);
}
