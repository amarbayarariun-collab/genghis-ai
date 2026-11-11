import { describe, expect, it } from "vitest";
import { systemPromptForMode } from "@/lib/tools";
import { EXAMPLE_PROMPTS, t } from "@/lib/locale";

describe("Mongolian product prompts", () => {
  it("keeps MN system prompt brand-safe", () => {
    const prompt = systemPromptForMode("chat", "mn");
    expect(prompt).toMatch(/Genghis AI/);
    expect(prompt).toMatch(/Монголоос дэлхийтэй холбогд/);
    expect(prompt).toMatch(/Сайн байна уу! Би Genghis AI/);
    expect(prompt).toMatch(/ХЭЗЭЭ Ч «Монголын анхны ChatGPT»/);
    expect(prompt).toMatch(/em dash/);
  });

  it("ships Cyrillic example prompts for first-run", () => {
    expect(EXAMPLE_PROMPTS.mn.length).toBeGreaterThanOrEqual(3);
    for (const prompt of EXAMPLE_PROMPTS.mn) {
      expect(prompt).toMatch(/[А-Яа-яӨөҮүЁё]/);
    }
    expect(t("mn", "valueProp")).toMatch(/Genghis AI/);
    expect(t("mn", "tagline")).toBe("Монголоос дэлхийтэй холбогд");
  });
});
