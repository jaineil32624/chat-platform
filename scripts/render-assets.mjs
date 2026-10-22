// Renders PNG brand assets (app icons, OG image, Android splash) from SVG using headless Chrome.
// Usage: node scripts/render-assets.mjs   (run with client/node_modules on NODE_PATH)
import { createRequire } from "node:module";

// Playwright is installed in client/ — resolve it from there.
const { chromium } = createRequire(new URL("../client/package.json", import.meta.url))("@playwright/test");
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const logo = readFileSync(join(root, "assets/brand/logo.svg"), "utf8");
const banner = readFileSync(join(root, "assets/brand/banner.svg"), "utf8");
const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });

async function render(html, w, h, out, transparent = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<html><body style="margin:0;background:${transparent ? "transparent" : "#0b0b14"}">${html}</body></html>`);
  await page.screenshot({ path: join(root, out), omitBackground: transparent });
  await page.close();
  console.log("wrote", out);
}

const sized = (svg, s) => svg.replace("<svg ", `<svg width="${s}" height="${s}" `);
await render(sized(logo, 192), 192, 192, "public/icon-192.png", true);
await render(sized(logo, 512), 512, 512, "public/icon-512.png", true);
await render(sized(logo, 1024), 1024, 1024, "assets/brand/icon-1024.png", true);
// Android adaptive icon foreground (logo with safe-zone padding) and splash
await render(`<div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center">${sized(logo, 600)}</div>`, 1024, 1024, "assets/brand/icon-foreground.png", true);
await render(`<div style="width:2732px;height:2732px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 50% 45%,#2a1f5c,#0b0b14 60%)">${sized(logo, 520)}</div>`, 2732, 2732, "assets/brand/splash.png");
// Open Graph / social preview
await render(`<div style="width:1280px;height:640px;display:flex;align-items:center;justify-content:center;background:#0b0b14">${banner.replace('width="1280" height="420"', 'width="1240" height="407"')}</div>`, 1280, 640, "public/og.png");
await render(banner, 1280, 420, "assets/brand/banner.png");
await browser.close();
