import { describe, expect, it } from "vitest";
import { streamMockReply } from "@/lib/mock-chat";

async function collect(prompt: string): Promise<string> {
  let out = "";
  for await (const chunk of streamMockReply(prompt)) {
    out += chunk;
  }
  return out;
}

describe("mock chat critical path", () => {
  it("returns the Mongolian first-reply greeting", async () => {
    const text = await collect("Сайн уу");
    expect(text).toBe(
      "Сайн байна уу! Би Genghis AI. Танд юугаар туслах вэ?"
    );
  });

  it("never claims to be Mongolia's first ChatGPT", async () => {
    const text = await collect("Чи юу хийж чадах вэ? Genghis AI гэж юу вэ?");
    expect(text).not.toMatch(/Монголын анхны ChatGPT/i);
    expect(text).not.toMatch(/ChatGPT/i);
    expect(text).toMatch(/Genghis AI/);
  });

  it("does not emit em dashes in mock replies", async () => {
    const text = await collect("Монгол улсын тухай товчхон хэл");
    expect(text).not.toContain("\u2014");
    expect(text).not.toContain("\u2013");
  });
});
