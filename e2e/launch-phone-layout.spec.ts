import { expect, test } from "@playwright/test";

test.describe("Phone layout + PWA", () => {
  test("PWA manifest is installable-shaped", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBe("Genghis AI");
    expect(body.short_name).toBe("Genghis AI");
    expect(body.display).toBe("standalone");
    expect(body.start_url).toBe("/");
    expect(body.lang).toBe("mn");
    expect(body.theme_color).toBe("#C9A36B");
    const icons = body.icons as Array<{ src: string; sizes: string }>;
    expect(icons.some((i) => i.sizes === "192x192")).toBeTruthy();
    expect(icons.some((i) => i.sizes === "512x512")).toBeTruthy();
    for (const icon of icons) {
      const iconRes = await request.get(icon.src);
      expect(iconRes.ok(), icon.src).toBeTruthy();
    }
  });

  test("landing + composer + menu fit viewport", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.getByText("Монголоос дэлхийтэй холбогд").nth(1)).toBeVisible();
    const composer = page.getByPlaceholder("Монголоор асуу, Genghis AI хариулна...");
    await expect(composer).toBeVisible();
    const box = await composer.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.y + box!.height).toBeLessThanOrEqual(
      (page.viewportSize()?.height || 900) + 2
    );
    const menu = page.getByRole("button", { name: "Цэс нээх" });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(
      page.getByRole("button", { name: /Нэвтрэх \/ бүртгүүлэх/ })
    ).toBeInViewport({ timeout: 10_000 });
    await page.screenshot({
      path: `/opt/cursor/artifacts/gaps-layout-${testInfo.project.name}.png`,
    });
  });
});
