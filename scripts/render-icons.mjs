// Renders the app icons from public/brand/logo.svg.
//
//   node scripts/render-icons.mjs
//
// iOS ignores an SVG apple-touch-icon and Android's install prompt wants PNGs
// at fixed sizes, so the mark is rasterised here rather than served as SVG.
// Re-run after changing the mark; the outputs are committed.
//
// sharp is not a dependency of this app. It is borrowed from Next, which ships
// it for image optimisation — adding it here would pin a second copy.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(createRequire(import.meta.url).resolve("next/package.json"));
const sharp = require("sharp");

const logo = resolve(root, "public/brand/logo.svg");

/**
 * The mark centred on a square tile.
 *
 * `inset` is the share of the tile the drop may fill. A home-screen icon is
 * cropped to a rounded square by the OS, and a maskable one to a circle as
 * small as 80% of the tile, so the drop sits well inside either.
 */
async function tile(size, inset, background, out) {
  const inner = Math.round(size * inset);
  const mark = await sharp(logo, { density: 1200 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: mark, gravity: "centre" }])
    .png()
    .toFile(resolve(root, "public", out));
  console.log(`→ public/${out}`);
}

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
await tile(180, 0.74, WHITE, "apple-icon.png");
await tile(192, 0.78, WHITE, "icon-192.png");
await tile(512, 0.78, WHITE, "icon-512.png");
await tile(512, 0.62, WHITE, "icon-maskable-512.png");
