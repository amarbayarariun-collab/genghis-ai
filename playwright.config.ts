import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT || 4317);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`;

/**
 * Launch smoke — mocked xAI/QPay (no API keys / QPay merchant env).
 * Does not call live providers or spend.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: {
          ...process.env,
          // Force mock chat / mock QPay / in-memory auth — no spend.
          OPENAI_API_KEY: "",
          AP: "",
          CHAT_API_KEY: "",
          OPENAI_IMAGE_API_KEY: "",
          QPAY_CLIENT_ID: "",
          QPAY_CLIENT_SECRET: "",
          QPAY_INVOICE_CODE: "",
          DATABASE_URL: "",
          AUTH_SECRET: process.env.AUTH_SECRET || "genghis-dev-auth-secret-change-me",
          ADMIN_SECRET:
            process.env.ADMIN_SECRET || "genghis-dev-admin-secret-change-me",
          PORT: String(PORT),
        },
      },
  projects: [
    {
      name: "desktop",
      testIgnore: "**/launch-phone-layout.spec.ts",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-360",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 360, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
    // Phone-size layout + PWA only (see e2e/launch-phone-layout.spec.ts).
    // Chromium + phone viewport (avoid WebKit install in CI/smoke).
    {
      name: "iphone-390",
      testMatch: "**/launch-phone-layout.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        userAgent: devices["iPhone 13"].userAgent,
      },
    },
    {
      name: "android-412",
      testMatch: "**/launch-phone-layout.spec.ts",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
