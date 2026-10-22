// Captures README screenshots and an animated GIF demo from the static build.
// 1) cd client && npm run build && npx serve out -l 4173
// 2) node scripts/screenshots.mjs
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../client/package.json", import.meta.url));
const { chromium } = require("@playwright/test");
const { GIFEncoder, quantize, applyPalette } = require("gifenc");
const { PNG } = require("pngjs");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = (f) => join(root, "screenshots", f);
const BASE = process.env.BASE ?? "http://localhost:4173";
mkdirSync(join(root, "screenshots"), { recursive: true });

const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const visible = (page, label) => page.locator(`button[aria-label="${label}"]:visible`).first();

async function demoPage(viewport = { width: 1440, height: 900 }, opts = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: opts.scale ?? 1, isMobile: opts.mobile, hasTouch: opts.mobile });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/auth/`);
  await page.getByText("Try the instant demo").click();
  await page.waitForURL("**/app/");
  await wait(2500);
  await page.evaluate(() => document.querySelectorAll("[class*='fixed'][class*='top-3']").forEach((t) => (t.style.display = "none")));
  return { ctx, page };
}

const hideToasts = (page) => page.addStyleTag({ content: ".pointer-events-none.fixed.inset-x-0.top-3 { display: none !important; }" });

async function shot(page, file) {
  await page.screenshot({ path: out(file) });
  console.log("📸", file);
}

// ——— Landing & auth ———
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`);
  await wait(4500);
  await shot(page, "landing.png");
  await page.goto(`${BASE}/auth/`);
  await wait(1500);
  await shot(page, "auth.png");
  await ctx.close();
}

// ——— Desktop app ———
{
  const { ctx, page } = await demoPage();
  await hideToasts(page);
  await visible(page, "Gaming Guild").click();
  await wait(800);
  const box = page.getByPlaceholder(/Message #/);
  await box.fill("hey everyone! who's up for some ranked games tonight? 🎮");
  await box.press("Enter");
  await wait(7000);
  await box.fill("/poll What should we play? | Valorant | Minecraft | Rocket League");
  await box.press("Enter");
  await wait(9000);
  await shot(page, "desktop-chat.png");

  await box.fill("/trivia");
  await box.press("Enter");
  await wait(12000);
  await shot(page, "trivia.png");

  // light mode variant
  await page.locator('button[aria-label="Settings"]:visible').click();
  await page.getByRole("button", { name: "Appearance" }).click();
  await wait(500);
  await shot(page, "settings-appearance.png");
  await page.getByRole("button", { name: /^light$/i }).click();
  await page.getByRole("button", { name: "Sunset", exact: true }).click();
  await page.keyboard.press("Escape");
  await wait(800);
  await shot(page, "light-mode.png");
  await page.locator('button[aria-label="Settings"]:visible').click();
  await page.getByRole("button", { name: "Appearance" }).click();
  await page.getByRole("button", { name: /^dark$/i }).click();
  await page.getByRole("button", { name: "Pulse", exact: true }).click();
  await page.keyboard.press("Escape");

  // DM with Nova
  await visible(page, "Direct Messages").click();
  await page.getByRole("button", { name: /Nova AI/ }).first().click();
  await wait(600);
  const dm = page.getByPlaceholder(/Message @/);
  await dm.fill("help");
  await dm.press("Enter");
  await wait(3500);
  await dm.fill("what is 12*(4+3)?");
  await dm.press("Enter");
  await wait(3500);
  await shot(page, "dm-assistant.png");

  // Friends / Discover / Admin / Achievements
  await visible(page, "Direct Messages").click();
  await wait(1200);
  await shot(page, "friends.png");
  await visible(page, "Discover communities").click();
  await wait(1500);
  await shot(page, "discover.png");
  await visible(page, "Study Hall").click();
  await wait(800);
  await page.locator("[aria-label='Start voice call']:visible").click();
  await wait(3000);
  await shot(page, "voice-call.png");
  await page.locator("[aria-label='Leave call']").click();
  await wait(500);
  await page.goto(`${BASE}/admin/`);
  await wait(2500);
  await shot(page, "admin-dashboard.png");
  await ctx.close();
}

// ——— Mobile ———
{
  const { ctx, page } = await demoPage({ width: 390, height: 844 }, { mobile: true, scale: 2 });
  await hideToasts(page);
  await visible(page, "Open navigation").click();
  await wait(700);
  await shot(page, "mobile-nav.png");
  await visible(page, "Art Collective").click();
  await wait(600);
  await page.getByRole("button", { name: /^showcase/ }).locator("visible=true").first().click();
  await wait(800);
  const box = page.getByPlaceholder(/Message #/);
  await box.fill("these are all so good omg ✨");
  await box.press("Enter");
  await wait(8000);
  await shot(page, "mobile-chat.png");
  await ctx.close();
}

// ——— Animated GIF demo ———
{
  const { ctx, page } = await demoPage({ width: 1200, height: 750 });
  await hideToasts(page);
  await visible(page, "Pulse HQ").click();
  await page.getByRole("button", { name: /^general/ }).locator("visible=true").first().click();
  await wait(800);
  const gif = GIFEncoder();
  const frame = async (delay = 120) => {
    const png = PNG.sync.read(await page.screenshot());
    const palette = quantize(png.data, 128);
    gif.writeFrame(applyPalette(png.data, palette), png.width, png.height, { palette, delay });
  };
  const box = page.getByPlaceholder(/Message #/);
  await box.click();
  const text = "hey everyone! just joined Pulse 👋 what's everyone up to?";
  for (let i = 0; i < text.length; i += 4) {
    await box.fill(text.slice(0, i + 4));
    await frame(70);
  }
  await box.press("Enter");
  for (let i = 0; i < 26; i++) { await frame(220); await wait(180); }
  await box.fill("/poll Weekend plans? | Gaming marathon | Movie night | Touch grass");
  await frame(500);
  await box.press("Enter");
  for (let i = 0; i < 22; i++) { await frame(220); await wait(220); }
  gif.finish();
  writeFileSync(out("demo.gif"), gif.bytes());
  console.log("🎞️  demo.gif");
  await ctx.close();
}

await browser.close();
