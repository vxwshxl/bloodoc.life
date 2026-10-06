import "server-only";

/**
 * Images for the camp reports, without a native image library.
 *
 * Both reports used to run every picture through sharp. On Vercel sharp's
 * libvips did not make it into the function bundle, so the Excel route died on
 * import before it read a single row. Excel and jsPDF both take PNG and JPEG as
 * they are, and partner logos are stored as PNG by the upload, so all that is
 * needed here is the pixel size each format keeps in its header.
 */

export type ReportImage = { buffer: Buffer; width: number; height: number; extension: "png" | "jpeg" };

/**
 * BlooDoc's mark: the drawing in public/brand/logo.svg, rendered once to a
 * 96px PNG and kept here, so the report's own mark never depends on a fetch
 * back out through the CDN. Re-render it if the mark changes.
 */
const MARK_PNG = "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";

export const MARK: ReportImage = { buffer: Buffer.from(MARK_PNG, "base64"), width: 96, height: 96, extension: "png" };

/** A PNG or JPEG with its size read from the header; null for anything else. */
export function readImage(buffer: Buffer): ReportImage | null {
  // PNG: the signature, then IHDR's width and height.
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { buffer, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), extension: "png" };
  }
  // JPEG: walk the segments to the frame header (any SOF but DHT, JPG, DAC).
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buffer.length) {
      if (buffer[i] !== 0xff) return null;
      const marker = buffer[i + 1];
      const size = buffer.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { buffer, width: buffer.readUInt16BE(i + 7), height: buffer.readUInt16BE(i + 5), extension: "jpeg" };
      }
      i += 2 + size;
    }
  }
  return null;
}

/**
 * A partner's logo, or null when it cannot be fetched or is not a PNG or JPEG.
 * A missing logo leaves its name standing alone, never a failed report.
 */
export async function loadLogo(url: string, origin: string): Promise<ReportImage | null> {
  try {
    // Short: a logo is decoration, and a slow one must not hold up the file.
    const res = await fetch(new URL(url, origin), { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    return readImage(Buffer.from(await res.arrayBuffer()));
  } catch {
    return null;
  }
}

/** Fit an image into a box, keeping its shape. */
export function fitBox(img: { width: number; height: number }, maxW: number, maxH: number) {
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  return { width: Math.round(img.width * scale), height: Math.round(img.height * scale) };
}
