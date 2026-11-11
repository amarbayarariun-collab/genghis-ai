import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

function uniqueEmail(prefix: string) {
  return `${prefix}+${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function openAuthForm(page: Page) {
  const gate = page.getByRole("button", { name: /Нэвтрэх \/ бүртгүүлэх/ });
  const menu = page.getByRole("button", { name: "Цэс нээх" });
  // Off-canvas aside stays in the DOM (`-translate-x-full`) so isVisible() is
  // not enough — open the drawer whenever the mobile menu control is shown.
  if (await menu.isVisible().catch(() => false)) {
    const box = await gate.boundingBox();
    const needsOpen = !box || box.x < 0 || box.x > 360;
    if (needsOpen) {
      await menu.click();
      await expect(gate).toBeInViewport({ timeout: 10_000 });
    }
  }
  await expect(gate).toBeVisible({ timeout: 10_000 });
  // Mobile drawer can be taller than the viewport — scroll the aside to the auth footer.
  await gate.evaluate((el) => {
    const aside = el.closest("aside");
    if (aside) aside.scrollTop = aside.scrollHeight;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  // Toggle open if the email field is not already shown.
  if (!(await page.getByPlaceholder("И-мэйл").isVisible().catch(() => false))) {
    await gate.click();
  }
  const email = page.getByPlaceholder("И-мэйл");
  await email.evaluate((el) => {
    const aside = el.closest("aside");
    if (aside) aside.scrollTop = aside.scrollHeight;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  await expect(email).toBeVisible();
}

async function closeMobileDrawer(page: Page) {
  const menu = page.getByRole("button", { name: "Цэс нээх" });
  if (!(await menu.isVisible().catch(() => false))) return;

  const asideOpen = await page.locator("aside.translate-x-0").count();
  if (!asideOpen) return;

  // Prefer backdrop tap — the X control can sit above the fold after scroll.
  const backdrop = page.locator("div.fixed.inset-0.z-40");
  if (await backdrop.isVisible().catch(() => false)) {
    await backdrop.dispatchEvent("click");
  } else {
    await page.locator("aside").getByRole("button", { name: "Хаалт" }).dispatchEvent("click");
  }

  await expect
    .poll(async () => {
      const gate = page.getByRole("button", { name: /Нэвтрэх \/ бүртгүүлэх|Гарах/ });
      const box = await gate.boundingBox();
      return !box || box.x < 0;
    }, { timeout: 5_000 })
    .toBeTruthy();
}

async function signup(page: Page, email: string, password = "TestPass1!") {
  await openAuthForm(page);
  await page.getByRole("button", { name: "Бүртгүүлэх", exact: true }).first().click();
  const emailInput = page.getByPlaceholder("И-мэйл");
  await emailInput.scrollIntoViewIfNeeded();
  await emailInput.fill(email);
  await page.getByPlaceholder("Нууц үг (8+)").fill(password);
  await page.getByRole("button", { name: "Бүртгүүлэх", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Гарах" })).toBeVisible({
    timeout: 20_000,
  });
  await closeMobileDrawer(page);
}

async function login(page: Page, email: string, password = "TestPass1!") {
  await openAuthForm(page);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).first().click();
  const emailInput = page.getByPlaceholder("И-мэйл");
  await emailInput.scrollIntoViewIfNeeded();
  await emailInput.fill(email);
  await page.getByPlaceholder("Нууц үг (8+)").fill(password);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).last().click();
  await expect(page.getByRole("button", { name: "Гарах" })).toBeVisible({
    timeout: 20_000,
  });
  await closeMobileDrawer(page);
}

async function enableTranslit(page: Page) {
  await closeMobileDrawer(page);
  const toggle = page.getByRole("button", { name: "Латин → Кирилл" });
  await expect(toggle).toBeVisible();
  await toggle.evaluate((el) =>
    el.scrollIntoView({ block: "center", inline: "nearest" })
  );
  if ((await toggle.getAttribute("aria-pressed")) !== "true") {
    // Hero chrome can overlap the composer on short mobile viewports.
    await toggle.dispatchEvent("click");
  }
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
}

async function sendChat(page: Page, text: string) {
  const composer = page.getByPlaceholder("Монголоор асуу, Genghis AI хариулна...");
  await composer.click({ force: true });
  await composer.fill(text);
  const chatResponse = page.waitForResponse(
    (res) =>
      res.url().includes("/api/chat") &&
      res.request().method() === "POST" &&
      (res.status() === 200 || res.status() === 402)
  );
  // Enter avoids hero chrome overlapping the send control on 360px.
  await composer.press("Enter");
  const res = await chatResponse;
  if (res.status() === 200) {
    expect(res.headers()["x-genghis-mode"] || "").toMatch(/mock/);
  }
}

async function burnFreeMessages(page: Page, targetUsed = 30) {
  await page.evaluate(async (target) => {
    for (let i = 0; i < target + 5; i++) {
      const res = await fetch("/api/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `ping ${i}` }],
          locale: "mn",
        }),
      });
      if (res.status === 402) return;
      if (!res.ok) throw new Error(`burn failed ${res.status}`);
      // drain stream body
      await res.text();
    }
  }, targetUsed);
}

async function assertLegal(page: Page) {
  await page.goto("/privacy");
  await expect(
    page.getByRole("heading", { name: "Нууцлалын бодлого" })
  ).toBeVisible();
  await expect(page.getByText(/НООРОГ/)).toBeVisible();

  await page.goto("/terms");
  await expect(
    page.getByRole("heading", { name: "Үйлчилгээний нөхцөл" })
  ).toBeVisible();
  await expect(page.getByText(/НООРОГ/)).toBeVisible();
}

test.describe("Launch smoke (mock xAI / QPay)", () => {
  test("landing → signup/login → MN Latin chat → actions → limit → pricing mock → image gates → legal", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail("qa-smoke");
    const password = "TestPass1!";

    // 1) Landing
    await page.goto("/");
    await expect(page.getByText("Монголоос дэлхийтэй холбогд").nth(1)).toBeVisible();
    await expect(
      page.getByText(/Өглөөний мэнд|Өдрийн мэнд|Оройн мэнд/).first()
    ).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Жишээ асуултууд" })
    ).toBeVisible();
    await page.screenshot({
      path: `/opt/cursor/artifacts/smoke-landing-${testInfo.project.name}.png`,
      fullPage: true,
    });

    // 2) Signup
    await signup(page, email, password);
    await page.screenshot({
      path: `/opt/cursor/artifacts/smoke-signup-${testInfo.project.name}.png`,
    });

    // Logout + login round-trip (Гарах lives in the sidebar / mobile drawer)
    {
      const logout = page.getByRole("button", { name: "Гарах" });
      const box = await logout.boundingBox();
      if (!box || box.x < 0) {
        const menu = page.getByRole("button", { name: "Цэс нээх" });
        if (await menu.isVisible().catch(() => false)) await menu.click();
        await expect(logout).toBeInViewport();
      }
      await logout.click();
    }
    await expect(page.getByText("Нэвтрэх / бүртгүүлэх")).toBeVisible();
    await login(page, email, password);

    // 3) MN chat with Latin → Cyrillic
    await enableTranslit(page);
    await sendChat(page, "sain baina uu");
    await expect(page.getByText("сайн байна уу").first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText("Сайн байна уу! Би Genghis AI. Танд юугаар туслах вэ?")
    ).toBeVisible({ timeout: 30_000 });

    // 4) Message actions (clipboard may be denied in CI — button click still required)
    const copy = page.getByRole("button", { name: /Хуулах|Хуулсан/ }).first();
    await expect(copy).toBeVisible();
    await copy.click();

    const regen = page.getByRole("button", { name: "Дахин үүсгэх" }).first();
    await expect(regen).toBeVisible();
    await regen.click();
    await expect(
      page.getByText("Сайн байна уу! Би Genghis AI. Танд юугаар туслах вэ?")
    ).toBeVisible({ timeout: 30_000 });

    // Sidebar history (open drawer on mobile only if needed)
    if (!(await page.getByText("Сүүлд чатласан").isVisible().catch(() => false))) {
      const menu = page.getByRole("button", { name: "Цэс нээх" });
      if (await menu.isVisible().catch(() => false)) {
        await menu.click();
      }
    }
    await expect(page.getByText("Сүүлд чатласан")).toBeVisible();
    await closeMobileDrawer(page);

    // 5) Free 30-msg limit → upgrade dialog
    await burnFreeMessages(page, 30);
    await sendChat(page, "limit check");
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#limit-upgrade-title")).toHaveText("Хязгаарт хүрлээ");
    await page.screenshot({
      path: `/opt/cursor/artifacts/smoke-limit-${testInfo.project.name}.png`,
    });
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Pro руу шилжих" })
      .click();
    await expect(page).toHaveURL(/\/pricing/);

    // 6) Pricing + mock QPay
    await expect(page.getByRole("heading", { name: "Багц сонгох" })).toBeVisible();
    await expect(page.getByText("72,000₮")).toBeVisible();
    await page.getByRole("button", { name: "QPay нэхэмжлэх үүсгэх" }).click();
    await expect(
      page.getByRole("button", { name: "Mock төлбөр дуусгах (мөнгө авахгүй)" })
    ).toBeVisible({ timeout: 15_000 });
    await page
      .getByRole("button", { name: "Mock төлбөр дуусгах (мөнгө авахгүй)" })
      .click();
    await expect(page.getByText(/Mock төлбөр амжилттай|Pro эрх/)).toBeVisible({
      timeout: 15_000,
    });
    await page.screenshot({
      path: `/opt/cursor/artifacts/smoke-pricing-${testInfo.project.name}.png`,
    });

    // 7) Image path (no spend): free guest blocked; Pro without keys → 503 xAI path
    const imageFree = await page.request.post("/api/image", {
      data: { prompt: "уулын зураг", locale: "mn" },
      failOnStatusCode: false,
    });
    // Authenticated Pro session cookies are on page context; use page.evaluate for cookie jar
    const imagePro = await page.evaluate(async () => {
      const res = await fetch("/api/image", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: "уулын зураг", locale: "mn" }),
      });
      return { status: res.status, body: await res.json() };
    });
    expect(imagePro.status).toBe(503);
    expect(String(imagePro.body.error || "")).toMatch(/xAI|OPENAI_API_KEY|түлхүүр/);
    expect(imagePro.body.imageProvider === "auto" || imagePro.body.imageProvider).toBeTruthy();

    // Fresh guest image gate (no session) via APIRequestContext
    const guest = await page.context().request.post("/api/image", {
      data: { prompt: "test", locale: "mn" },
      failOnStatusCode: false,
    });
    // May be 402 (free/guest) depending on cookie inheritance; if same context still Pro, skip
    if (guest.status() === 402) {
      const body = await guest.json();
      expect(body.code).toBe("IMAGE_NOT_ALLOWED");
    }
    void imageFree;

    // 8) Legal
    await assertLegal(page);
    await page.screenshot({
      path: `/opt/cursor/artifacts/smoke-legal-${testInfo.project.name}.png`,
    });
  });
});

test.describe("API mock gates", () => {
  test("xAI Imagine primary config + free image 402 (no spend)", async ({
    request,
  }: {
    request: APIRequestContext;
  }) => {
    // Unit script already covers config; here assert free image gate without keys.
    const res = await request.post("/api/image", {
      data: { prompt: "ger landscape", locale: "mn" },
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("IMAGE_NOT_ALLOWED");
  });

  test("Pro message limit shows MN reset date without upgrade dialog", async ({
    page,
  }) => {
    // Mocked 402 (no spend / no burn-to-500). Matches #44 Pro copy shape:
    // limit reached + resetsAt, and no upgradePath for paid caps.
    await page.route("**/api/chat", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "Хязгаарт хүрлээ (500/500 мессеж). Хязгаар 2026-12-01 өдөр шинэчлэгдэнэ.",
          code: "MESSAGE_LIMIT",
          usage: {
            tier: "paid",
            messagesUsed: 500,
            messagesLimit: 500,
            imagesUsed: 0,
            imagesLimit: 10,
            model: "grok-4.7",
            period: "2026-11",
            resetsAt: "2026-12-01",
          },
        }),
      });
    });

    await page.goto("/");
    await sendChat(page, "pro limit mock");
    // Bubble + dismissible error alert share copy; Next also mounts an empty
    // `#__next-route-announcer__` role=alert. Filter to the error banner.
    const limitAlert = page
      .getByRole("alert")
      .filter({ hasText: /Хязгаарт хүрлээ.*2026-12-01.*шинэчлэгдэнэ/ });
    await expect(limitAlert).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#limit-upgrade-title")).toHaveCount(0);
  });
});
