import type { ThinkingStep, ToolMode } from "@/lib/types";

export type { ThinkingStep, ThinkingTrace } from "@/lib/types";

const BASE_STEPS: ThinkingStep[] = [
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

const BY_MODE: Partial<Record<ToolMode, ThinkingStep[]>> = {
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

export function thinkingStepsForMode(mode: ToolMode = "chat"): ThinkingStep[] {
  return BY_MODE[mode] ?? BASE_STEPS;
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
