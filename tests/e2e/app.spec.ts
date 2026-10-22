import { expect, test } from "@playwright/test";

test.describe("Pulse", () => {
  test("landing page links into the app", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /conversations/i })).toBeVisible();
    await page.getByRole("link", { name: /Play in your browser/i }).click();
    await expect(page).toHaveURL(/\/auth\/$/);
  });

  test("register, chat with bots, and get replies", async ({ page, isMobile }) => {
    await page.goto("/auth/");
    await page.getByRole("button", { name: "Register" }).click();
    await page.getByPlaceholder("Display name").fill("E2E Tester");
    await page.getByPlaceholder("username").fill(`e2e${Date.now() % 100000}`);
    await page.getByPlaceholder("Email").fill(`e2e${Date.now()}@test.dev`);
    await page.getByPlaceholder("Password").fill("Sup3r$ecret");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/app\/$/);

    if (isMobile) await page.locator('button[aria-label="Open navigation"]:visible').first().click();
    await page.locator('button[aria-label="Pulse HQ"]:visible').click();
    await page.getByRole("button", { name: /^general/ }).locator("visible=true").first().click();
    const box = page.getByPlaceholder("Message #general");
    await box.fill("hello everyone! how's it going?");
    await box.press("Enter");
    await expect(page.getByText("hello everyone! how's it going?")).toBeVisible();
    // the simulation answers within a few seconds
    await expect.poll(async () => page.locator("[id^=msg-]").count(), { timeout: 20_000 }).toBeGreaterThan(2);
  });

  test("demo account can open the admin dashboard", async ({ page }) => {
    await page.goto("/auth/");
    await page.getByText("Try the instant demo").click();
    await expect(page).toHaveURL(/\/app\/$/);
    await page.goto("/admin/");
    await expect(page.getByText("Admin Dashboard")).toBeVisible();
    await expect(page.getByText("Total users")).toBeVisible();
  });

  test("slash commands create polls", async ({ page, isMobile }) => {
    test.skip(isMobile, "covered on desktop");
    await page.goto("/auth/");
    await page.getByText("Try the instant demo").click();
    await page.locator('button[aria-label="Study Hall"]:visible').click();
    const box = page.getByPlaceholder(/Message #/);
    await box.fill("/poll Best study snack? | Coffee | Fruit");
    await box.press("Enter");
    await expect(page.getByText("Best study snack?")).toBeVisible();
  });
});
