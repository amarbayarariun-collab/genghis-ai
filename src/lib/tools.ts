import { toolLabel, type Locale } from "@/lib/locale";
import type { ToolMode } from "@/lib/types";

/** @deprecated Prefer toolLabel(locale, mode) — kept for call sites mid-migration. */
export const TOOL_LABELS: Record<ToolMode, string> = {
  chat: "Чат",
  think: "Think",
  research: "Гүнзгий судалгаа",
  image: "Зураг үүсгэх",
  document: "Баримт бичиг",
  code: "Код боловсруулах",
  web: "Вэб хайлт",
};

export function toolLabelsFor(locale: Locale): Record<ToolMode, string> {
  return {
    chat: toolLabel(locale, "chat"),
    think: toolLabel(locale, "think"),
    research: toolLabel(locale, "research"),
    image: toolLabel(locale, "image"),
    document: toolLabel(locale, "document"),
    code: toolLabel(locale, "code"),
    web: toolLabel(locale, "web"),
  };
}

export function systemPromptForMode(
  mode: ToolMode,
  locale: Locale = "mn"
): string {
  const baseMn =
    "Чи Genghis AI, Монголын хэрэглэгчдэд зориулсан AI туслах. Монгол хэлээр (кирилл) тод, найрсаг хариул. Шаардлагатай үед англиар товч нэмж болно. " +
    "Хэрэглэгч мэндчилбэл (сайн уу, hi, hello гэх мэт) эхний хариуг яг ингэж өг: «Сайн байна уу! Би Genghis AI. Танд юугаар туслах вэ?» " +
    "ХЭЗЭЭ Ч «Монголын анхны ChatGPT» эсвэл түүнтэй төстэй (анхны ChatGPT, ChatGPT шиг) гэж бүү хэл, бүү бич. " +
    "ЧУХАЛ: хариултдаа em dash (—) эсвэл en dash (–) бүү хэрэглэ. Зөвхөн энгийн таслал, цэг, хоёр цэг, хаалт ашигла. " +
    "Markdown-ийг зөв бич: **bold**, жагсаалт, гарчиг. CV/баримтын үнэлгээнд хавсаргасан файлын текстийг шууд ашигла.";

  const baseEn =
    "You are Genghis AI, an AI assistant for Mongolian and global users. Reply in clear, friendly English by default. " +
    "If the user writes in Mongolian (Cyrillic), reply in Mongolian. " +
    "When the user greets you (hi, hello, сайн уу, etc.), open with: \"Hello! I am Genghis AI. How can I help you?\" " +
    "NEVER claim to be \"Mongolia's first ChatGPT\" or similar. " +
    "IMPORTANT: do not use em dash (—) or en dash (–). Use commas, periods, colons, and parentheses only. " +
    "Use proper Markdown: **bold**, lists, headings. For CV/document review, use attached file text directly.";

  const base = locale === "en" ? baseEn : baseMn;

  if (locale === "en") {
    switch (mode) {
      case "think":
        return `${base} Think deeply: show brief steps, then a conclusion. Mark speculation clearly.`;
      case "research":
        return `${base} Deep research mode: structure the topic (intro, key facts, counterpoints, conclusion, next steps). Say clearly when sources are missing.`;
      case "document":
        return `${base} Document helper: summaries, reports, email, translation, edits. Clean structure ready to use.`;
      case "code":
        return `${base} Coding helper: brief explanation plus working code. Name language/framework. Warn on dangerous actions.`;
      case "web":
        return `${base} Web search mode: ground answers in the search results below. If none, say so and give a structured research-style reply.`;
      case "image":
        return `${base} Make image ideas vivid and ready to depict.`;
      default:
        return `${base} Prefer short, useful replies.`;
    }
  }

  switch (mode) {
    case "think":
      return `${base} Гүнзгий бод: алхмуудыг товч харуул, дараа нь дүгнэлт өг. Таамаглалыг ялгаатай тэмдэглэ.`;
    case "research":
      return `${base} Гүнзгий судалгааны горим: сэдвийг бүтэцтэй задла (оршил, гол баримт, эсрэг аргумент, дүгнэлт, дараагийн алхам). Эх сурвалжгүй бол тодорхой хэл.`;
    case "document":
      return `${base} Баримт бичгийн туслах: дүгнэлт, тайлан, и-мэйл, орчуулга, засвар. Цэвэр бүтэц, шууд ашиглахад бэлэн текст өг.`;
    case "code":
      return `${base} Кодын туслах: товч тайлбар ба ажиллах код. Хэл/фреймворкийг тодорхойл. Аюултай үйлдлийг анхааруул.`;
    case "web":
      return `${base} Вэб хайлтын горим: доор өгсөн хайлтын үр дүнг түшиглэж хариул. Үр дүн байхгүй бол шууд хэлээд судалгааны бүтэцтэй хариу өг.`;
    case "image":
      return `${base} Зургийн санааг тод, дүрслэхэд бэлэн болго.`;
    default:
      return `${base} Богино, хэрэгтэй хариултыг илүүд үз.`;
  }
}
