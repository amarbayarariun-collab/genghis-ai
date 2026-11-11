import { expect, test, type Page } from "@playwright/test";

const ADMIN_SECRET =
  process.env.ADMIN_SECRET || "genghis-dev-admin-secret-change-me";

async function closeMobileDrawer(page: Page) {
  const menu = page.getByRole("button", { name: "Цэс нээх" });
  if (!(await menu.isVisible().catch(() => false))) return;
  const asideOpen = await page.locator("aside.translate-x-0").count();
  if (!asideOpen) return;
  const backdrop = page.locator("div.fixed.inset-0.z-40");
  if (await backdrop.isVisible().catch(() => false)) {
    await backdrop.dispatchEvent("click");
  } else {
    await page.locator("aside").getByRole("button", { name: "Хаалт" }).dispatchEvent("click");
  }
}

test.describe("Launch gaps (edit/stop, admin, Pro image limit)", () => {
  test("admin unlock + stats with ADMIN_SECRET (no spend)", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "Owner admin" })).toBeVisible();
    await page.locator('input[type="password"]').fill(ADMIN_SECRET);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(page.getByText("Signups / unique")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/ADMIN_SECRET: ok/)).toBeVisible();
    await expect(page.getByText(/QPay: mock\/disabled|QPay: ok/)).toBeVisible();
    await page.getByRole("button", { name: "Lock" }).click();
    await expect(page.getByRole("button", { name: "Unlock" })).toBeVisible();
  });

  test("edit last user message and stop a streaming reply", async ({ page }) => {
    await page.goto("/");
    await closeMobileDrawer(page);

    const composer = page.getByPlaceholder("Монголоор асуу, Genghis AI хариулна...");
    await composer.click({ force: true });
    await composer.fill("эхний асуулт");
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("/api/chat") &&
          res.request().method() === "POST" &&
          res.status() === 200
      ),
      composer.press("Enter"),
    ]);
    await expect(page.getByText("эхний асуулт").first()).toBeVisible({ timeout: 20_000 });

    const edit = page.getByRole("button", { name: "Засах" }).first();
    await expect(edit).toBeVisible({ timeout: 20_000 });
    await edit.click();
    const editBox = page.getByLabel("Засах");
    await expect(editBox).toBeVisible();
    await editBox.fill("зассан асуулт");

    // Hang the edit-resend chat request so Stop is clickable (mock, no spend).
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      await route.abort().catch(() => undefined);
    });

    await page.getByRole("button", { name: "Дахин илгээх" }).click();
    const stop = page.getByRole("button", { name: "Үүсгэхийг зогсоох" });
    await expect(stop).toBeVisible({ timeout: 10_000 });
    await stop.click();
    await expect(stop).toHaveCount(0, { timeout: 10_000 });
    await expect(page.getByText("зассан асуулт").first()).toBeVisible();
  });

  test("Pro image limit 402 (mocked, no spend)", async ({ page }) => {
    await page.route("**/api/image", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Энэ сарын зургийн хязгаарт хүрлээ (10/10).",
          code: "IMAGE_LIMIT",
          usage: {
            tier: "paid",
            messagesUsed: 12,
            messagesLimit: 500,
            imagesUsed: 10,
            imagesLimit: 10,
            model: "grok-4.7",
            period: "2026-11",
            resetsAt: "2026-12-01",
          },
          upgradePath: "/pricing",
        }),
      });
    });

    await page.goto("/");
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/image", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "mock limit", locale: "mn" }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(result.status).toBe(402);
    expect(result.body.code).toBe("IMAGE_LIMIT");
    expect(String(result.body.error || "")).toMatch(/10\/10/);
    expect(result.body.upgradePath).toBe("/pricing");
  });
});
