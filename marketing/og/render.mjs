// Renders marketing/og/og.html to public/og.png at exactly 1200x630.
//
// Puppeteer is not a dependency of this app — it is fetched on demand with
// `pnpm dlx`, because a 300MB browser download has no business in the install
// for a card that is re-rendered twice a year.
//
//   pnpm dlx puppeteer-core --help   # or just run: node marketing/og/render.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(`file://${resolve(here, "og.html")}`);
await page.waitForTimeout(1200); // webfont
await page.screenshot({ path: resolve(here, "../../public/og.png") });
await browser.close();
console.log("→ public/og.png");
