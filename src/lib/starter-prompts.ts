/**
 * Editable empty-chat starter prompts (MN Cyrillic).
 * Edit this file to add/remove/reword cards; the UI shuffles a subset on load.
 */

export type StarterPrompt = {
  id: string;
  /** Short card label shown above the prompt text */
  title: string;
  /** Full text filled into the composer on tap (never auto-sent) */
  prompt: string;
};

/** Full pool — keep 6–8 practical Mongolian prompts. */
export const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    id: "eesh",
    title: "ЭЕШ бэлтгэл",
    prompt:
      "ЭЕШ-ийн математик, монгол хэлний жишээ асуултуудыг алхам алхмаар тайлбарлаж, дасгал өгнө үү.",
  },
  {
    id: "translate",
    title: "Орчуулга EN/CN/RU↔MN",
    prompt:
      "Дараах текстийг англи, хятад, орос ↔ монгол хэл рүү нарийн орчуулж, хувилбаруудыг харьцуулж өгнө үү:",
  },
  {
    id: "business",
    title: "Жижиг бизнес",
    prompt:
      "Улаанбаатарт жижиг бизнес нээх энгийн бизнес төлөвлөгөө (зардал, зах зээл, эхний 90 хоног) гаргаж өгнө үү.",
  },
  {
    id: "cv",
    title: "Анкет / CV",
    prompt:
      "Миний CV/анкетыг монгол, англи хэлээр товч, мэргэжлийн хэлбэрээр сайжруулж өгнө үү.",
  },
  {
    id: "letter",
    title: "Албан бичиг",
    prompt:
      "Албан байгууллагад илгээх хүсэлт/өргөдлийн албан бичгийн загвар монгол хэлээр бичиж өгнө үү.",
  },
  {
    id: "history",
    title: "Түүх, соёл",
    prompt:
      "Монголын түүх, соёл, ёс заншлын тухай сонирхолтой, үнэн зөв баримтуудыг товч ярьж өгнө үү.",
  },
  {
    id: "travel",
    title: "Аялал, цаг агаар",
    prompt:
      "Монголд аялах зөвлөмж, улирлын цаг агаар, юу авч явахыг практик байдлаар хэлж өгнө үү.",
  },
  {
    id: "homework",
    title: "Гэрийн даалгавар",
    prompt:
      "Хүүхдийн гэрийн даалгаварт тусалж, ойлгомжтойгоор алхам алхмаар тайлбарлаж өгнө үү.",
  },
] as const;

export const STARTER_PROMPT_SUBSET_SIZE = 4;

/** Fisher–Yates shuffle then take the first `count` items. */
export function shuffleSubset<T>(
  items: readonly T[],
  count: number,
  random: () => number = Math.random
): T[] {
  const n = Math.max(0, Math.min(count, items.length));
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy.slice(0, n);
}

/** Picks a shuffled subset of starter prompts for the empty-chat grid. */
export function pickStarterPrompts(
  count: number = STARTER_PROMPT_SUBSET_SIZE,
  random: () => number = Math.random
): StarterPrompt[] {
  return shuffleSubset(STARTER_PROMPTS, count, random);
}
