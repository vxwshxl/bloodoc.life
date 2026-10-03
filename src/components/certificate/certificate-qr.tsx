import QRCode from "qrcode";

/**
 * The QR code printed on every certificate.
 *
 * It encodes the certificate's own /verify URL, so anyone holding the paper
 * points a phone camera at it and lands on the page that says whether it is
 * genuine — no typing the code in. The code itself is printed beside it for
 * when there is no camera to hand.
 *
 * Drawn as one SVG path from the module matrix, synchronously, so it renders
 * the same on the server (/verify) and inside the browser capture that makes
 * the PDF, with nothing to load and no canvas to wait on.
 */

/** A fixed brand origin, not the deploy URL: this is printed on paper. */
const VERIFY_ORIGIN = "https://bloodoc.life/verify";

export function verifyUrl(code: string): string {
  return `${VERIFY_ORIGIN}/${encodeURIComponent(code)}`;
}

/** One `M x y h1 v1 h-1 z` square per dark module, with a two-module margin. */
function qrPath(text: string): { size: number; d: string } {
  // "M" recovers from about 15% damage — a fold, a coffee ring — without
  // making the code so dense that a small print stops scanning.
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = modules.size;
  let d = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules.get(y, x)) d += `M${x + 2} ${y + 2}h1v1h-1z`;
    }
  }
  return { size: n + 4, d };
}

export function CertificateQr({
  code,
  color = "#1f2a5c",
  className,
  style,
}: {
  code: string;
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { size, d } = qrPath(verifyUrl(code));
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`QR code to verify certificate ${code}`}
      className={className}
      style={style}
      // Crisp module edges on screen and in the captured PDF.
      shapeRendering="crispEdges"
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill={color} />
    </svg>
  );
}
