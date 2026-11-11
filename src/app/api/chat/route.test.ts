import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("POST /api/chat critical path", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    // Force mock provider: no live spend in tests.
    delete process.env.OPENAI_API_KEY;
    delete process.env.AP;
    delete process.env.CHAT_API_KEY;
    delete process.env.CHAT_BASE_URL;
    delete process.env.CHAT_PROVIDER;
    delete process.env.OPENAI_BASE_URL;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("rejects empty payloads in Mongolian", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      })
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toMatch(/Мессеж хоосон/);
  });

  it("streams a Mongolian greeting in mock mode", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const res = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: "mn",
          mode: "chat",
          messages: [{ role: "user", content: "Сайн уу" }],
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Genghis-Mode")).toBe("mock");
    const text = await res.text();
    expect(text).toBe(
      "Сайн байна уу! Би Genghis AI. Танд юугаар туслах вэ?"
    );
    expect(text).not.toMatch(/Монголын анхны ChatGPT/);
  });
});
