// Smoke-test the static build in real Chrome and capture console errors.
import { createRequire } from "node:module";

// Playwright is installed in client/ — resolve it from there.
const { chromium } = createRequire(new URL("../client/package.json", import.meta.url))("@playwright/test");
const base = process.env.BASE ?? "http://localhost:4173";
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base + "/");
await page.waitForTimeout(1500);
await page.goto(base + "/auth/");
await page.getByText("Try the instant demo").click();
await page.waitForURL("**/app/", { timeout: 15000 });
await page.waitForTimeout(2500);
await page.getByLabel("Gaming Guild").click();
await page.waitForTimeout(1500);
const box = page.getByPlaceholder(/Message #/);
await box.fill("hey everyone! anyone want to play a game tonight?");
await box.press("Enter");
await page.waitForTimeout(9000);
await box.fill("/poll Best snack? | Pizza | Tacos | Ramen");
await box.press("Enter");
await page.waitForTimeout(6000);
console.log("messages in view:", await page.locator("[id^=msg-]").count());
await page.screenshot({ path: "../screenshots/_smoke.png" });
console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
await browser.close();
