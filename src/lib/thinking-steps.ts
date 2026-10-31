import type { Locale } from "@/lib/locale";
import type { ThinkingStep, ToolMode } from "@/lib/types";

export type { ThinkingStep, ThinkingTrace } from "@/lib/types";

const BASE_MN: ThinkingStep[] = [
  {
    summary: "Асуултыг уншиж байна",
    detail: "Хэрэглэгчийн асуулт, хавсралт, горимыг шалгаж эхэллээ.",
  },
  {
    summary: "Гол санааг ялгаж байна",
    detail: "Хариулах ёстой цөм асуудлыг тодруулж байна.",
  },
  {
    summary: "Хариултын бүтэц бодож байна",
    detail: "Товч, ойлгомжтой алхамтай хариултын дарааллыг төлөвлөж байна.",
  },
  {
    summary: "Хариулт бичиж байна",
    detail: "Монгол хэлээр найрсаг, хэрэгтэй хариу бэлдэж байна.",
  },
];

const BASE_EN: ThinkingStep[] = [
  {
    summary: "Reading your question",
    detail: "Checking the question, attachments, and mode.",
  },
  {
    summary: "Finding the key idea",
    detail: "Clarifying the core problem to answer.",
  },
  {
    summary: "Planning the reply",
    detail: "Ordering a clear, useful response.",
  },
  {
    summary: "Writing the answer",
    detail: "Drafting a friendly, helpful reply.",
  },
];

const BY_MODE_MN: Partial<Record<ToolMode, ThinkingStep[]>> = {
  think: [
    {
      summary: "Гүнзгий бодол эхлүүлж байна",
      detail: "Асуудлыг олон талаас нь задлан шинжилж байна.",
    },
    {
      summary: "Таамаглал, баримтыг ялгаж байна",
      detail: "Баталгаатай ба мэдэгдэхгүй зүйлийг тусгаарлаж байна.",
    },
    {
      summary: "Алхамуудыг цэгцэлж байна",
      detail: "Дүгнэлт рүү хөтлөх логик дарааллыг боловсруулж байна.",
    },
    {
      summary: "Дүгнэлт бэлдэж байна",
      detail: "Товч дүгнэлт, дараагийн алхмыг бичиж байна.",
    },
  ],
  research: [
    {
      summary: "Сэдвийг задлаж байна",
      detail: "Оршил, гол баримт, эсрэг аргументын хүрээг тогтоож байна.",
    },
    {
      summary: "Эх сурвалж, мэдээллийг шалгаж байна",
      detail: "Вэб/дотоод мэдлэгийн үр дүнг харьцуулж байна.",
    },
    {
      summary: "Бүтэцтэй судалгаа бичиж байна",
      detail: "Дүгнэлт, дараагийн алхмыг бэлдэж байна.",
    },
  ],
  web: [
    {
      summary: "Хайлтын үр дүнг уншиж байна",
      detail: "Олдсон холбоос, товч агуулгыг нэгтгэж байна.",
    },
    {
      summary: "Найдвартай мэдээллийг шүүж байна",
      detail: "Зөрчилтэй эсвэл хуучирсан мэдээллийг ялгаж байна.",
    },
    {
      summary: "Хариулт нэгтгэж байна",
      detail: "Товч, эх сурвалжтай холбоотой хариу бичиж байна.",
    },
  ],
  code: [
    {
      summary: "Кодын асуудлыг задлаж байна",
      detail: "Хэл, хүрээ, хүлээгдэж буй үр дүнг тодорхойлж байна.",
    },
    {
      summary: "Шийдлийн хувилбаруудыг бодож байна",
      detail: "Аюулгүй, ажиллах кодын загварыг сонгож байна.",
    },
    {
      summary: "Жишээ код бэлдэж байна",
      detail: "Тайлбар + ажиллах жишээг бичиж байна.",
    },
  ],
  document: [
    {
      summary: "Баримтын шаардлагыг уншиж байна",
      detail: "Зорилго, өнгө аяс, бүтцийг тогтоож байна.",
    },
    {
      summary: "Текстийн бүтэц бодож байна",
      detail: "Гарчиг, хэсэг, товч дүгнэлтийн дарааллыг төлөвлөж байна.",
    },
    {
      summary: "Баримт бичиж байна",
      detail: "Шууд ашиглахад бэлэн текст бэлдэж байна.",
    },
  ],
  image: [
    {
      summary: "Зургийн санааг тодруулж байна",
      detail: "Сэдэв, хэв маяг, найрлагыг задалж байна.",
    },
    {
      summary: "Дүрслэлийг бэлдэж байна",
      detail: "Загварт ойлгомжтой prompt/дүрслэл боловсруулж байна.",
    },
    {
      summary: "Зураг үүсгэж байна",
      detail: "Үр дүнг хүлээж, шалгаж байна.",
    },
  ],
};

const BY_MODE_EN: Partial<Record<ToolMode, ThinkingStep[]>> = {
  think: [
    {
      summary: "Starting deeper reasoning",
      detail: "Analyzing the problem from several angles.",
    },
    {
      summary: "Separating facts and guesses",
      detail: "Marking what is known versus uncertain.",
    },
    {
      summary: "Ordering the steps",
      detail: "Building a logical path to a conclusion.",
    },
    {
      summary: "Preparing the conclusion",
      detail: "Writing a brief conclusion and next steps.",
    },
  ],
  research: [
    {
      summary: "Breaking down the topic",
      detail: "Setting intro, key facts, and counterpoints.",
    },
    {
      summary: "Checking sources",
      detail: "Comparing web and built-in knowledge.",
    },
    {
      summary: "Writing structured research",
      detail: "Preparing conclusion and next steps.",
    },
  ],
  web: [
    {
      summary: "Reading search results",
      detail: "Combining titles, snippets, and links.",
    },
    {
      summary: "Filtering reliable info",
      detail: "Dropping conflicting or outdated bits.",
    },
    {
      summary: "Assembling the answer",
      detail: "Writing a concise, source-aware reply.",
    },
  ],
  code: [
    {
      summary: "Breaking down the coding task",
      detail: "Identifying language, framework, and expected result.",
    },
    {
      summary: "Choosing a solution",
      detail: "Picking a safe, working approach.",
    },
    {
      summary: "Preparing example code",
      detail: "Writing explanation plus working sample.",
    },
  ],
  document: [
    {
      summary: "Reading document needs",
      detail: "Clarifying goal, tone, and structure.",
    },
    {
      summary: "Planning the text",
      detail: "Ordering headings, sections, and summary.",
    },
    {
      summary: "Writing the document",
      detail: "Producing ready-to-use text.",
    },
  ],
  image: [
    {
      summary: "Clarifying the image idea",
      detail: "Breaking down subject, style, and composition.",
    },
    {
      summary: "Preparing the depiction",
      detail: "Shaping a clear prompt for the model.",
    },
    {
      summary: "Creating the image",
      detail: "Waiting on and checking the result.",
    },
  ],
};

export function thinkingStepsForMode(
  mode: ToolMode = "chat",
  locale: Locale = "mn"
): ThinkingStep[] {
  if (locale === "en") return BY_MODE_EN[mode] ?? BASE_EN;
  return BY_MODE_MN[mode] ?? BASE_MN;
}

export function formatThinkingDuration(sec: number): string {
  const n = Math.max(0, Math.round(sec));
  return `${n}s`;
}

/** Advance revealed step index based on elapsed ms (Claude-like pacing). */
export function stepIndexForElapsed(
  elapsedMs: number,
  stepCount: number
): number {
  if (stepCount <= 1) return 0;
  const idx = Math.floor(elapsedMs / 1600);
  return Math.min(stepCount - 1, Math.max(0, idx));
}
