const RESPONSES: Array<{ match: RegExp; text: string }> = [
  {
    match: /сайн\s*байн|hello|hi\b|сайн уу/i,
    text: "Сайн байна уу! Би Genghis AI. Танд юугаар туслах вэ?",
  },
  {
    match: /монгол|mongolia|улаанбаатар|уб\b/i,
    text: "Монгол бол өргөн тал нутаг, нүүдэлчин соёл, мөнх хөх тэнгэртэй газар. Улаанбаатар хот, Хөвсгөл нуур, Говийн цөл зэрэг олон гайхамшигтай газар бий. Юуг илүү дэлгэрэнгүй мэдэхийг хүсэж байна вэ?",
  },
  {
    match: /хоол|хуушуур|бууз|цуйван|food|recipe/i,
    text: "Монгол хоолны зөвлөмж: хуушуур - махтай хавтгай шардмал; бууз - уураар жигнэсэн бялуу; цуйван - гоймонтой махны хоол. Жор, орц, эсвэл рестораны зөвлөмж хэрэгтэй юу?",
  },
  {
    match: /код|code|програм|javascript|python|react/i,
    text: "Код бичихэд тусалъя. Асуудлаа товч тайлбарлаад, ямар хэл/фреймворк ашиглаж байгааг хэлээрэй. Жишээ нь: Next.js дээр API route, эсвэл Python скрипт гэх мэт.",
  },
  {
    match: /genghis|chinggis|чингис|chingis/i,
    text: "Genghis AI бол Монголын хэрэглэгчдэд зориулсан AI чат туслах. Одоогийн хувилбар нь чатны үндсэн туршлагыг үзүүлэх MVP. Дараагийн алхамд илүү олон загвар, санах ой, хэрэгсэл нэмэгдэнэ.",
  },
];

const FALLBACK =
  "Ойлголоо. Энэ бол орон нутгийн демо горим. Жинхэнэ OpenAI түлхүүр холбогдоогүй үед Genghis AI иймэрхүү хариулт өгдөг.\n\nТаны асуулт: «{q}»\n\nЖинхэнэ загвар холбохын тулд `OPENAI_API_KEY` environment хувьсагчийг тохируулаад серверээ дахин асаана уу. Дараа нь би илүү нарийвчилсан, урт хариулт өгөх боломжтой.";

function pickResponse(prompt: string): string {
  for (const item of RESPONSES) {
    if (item.match.test(prompt)) return item.text;
  }
  const trimmed = prompt.trim().slice(0, 180) || "…";
  return FALLBACK.replace("{q}", trimmed);
}

/** Stream a mock reply character-by-character for a live chat feel. */
export async function* streamMockReply(
  prompt: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const text = pickResponse(prompt);
  const chunkSize = 2 + Math.floor(Math.random() * 3);

  for (let i = 0; i < text.length; i += chunkSize) {
    if (signal?.aborted) break;
    yield text.slice(i, i + chunkSize);
    await new Promise((r) => setTimeout(r, 12 + Math.random() * 22));
  }
}
