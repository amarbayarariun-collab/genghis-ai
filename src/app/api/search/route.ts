import { sanitizeApiError } from "@/lib/api-config";

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
};

async function duckDuckGoInstant(query: string): Promise<SearchHit[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "GenghisAI/1.0 (research assistant)",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`DDG ${res.status}`);
  }
  const raw = await res.text();
  if (!raw.trim()) return [];

  let data: {
    AbstractText?: string;
    AbstractURL?: string;
    Heading?: string;
    RelatedTopics?: Array<
      | { Text?: string; FirstURL?: string }
      | { Topics?: Array<{ Text?: string; FirstURL?: string }> }
    >;
    Results?: Array<{ Text?: string; FirstURL?: string }>;
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    throw new Error("DDG JSON parse failed");
  }

  const hits: SearchHit[] = [];

  if (data.AbstractText) {
    hits.push({
      title: data.Heading || query,
      url: data.AbstractURL || "",
      snippet: data.AbstractText,
    });
  }

  const pushTopic = (t?: { Text?: string; FirstURL?: string }) => {
    if (!t?.Text) return;
    hits.push({
      title: t.Text.split(" - ")[0]?.slice(0, 120) || t.Text.slice(0, 80),
      url: t.FirstURL || "",
      snippet: t.Text,
    });
  };

  for (const item of data.RelatedTopics || []) {
    if ("Topics" in item && Array.isArray(item.Topics)) {
      item.Topics.slice(0, 4).forEach(pushTopic);
    } else {
      pushTopic(item as { Text?: string; FirstURL?: string });
    }
    if (hits.length >= 6) break;
  }

  for (const r of data.Results || []) {
    pushTopic(r);
    if (hits.length >= 8) break;
  }

  return hits.slice(0, 8);
}

async function wikipediaSearch(query: string): Promise<SearchHit[]> {
  const langs = ["mn", "en"] as const;
  const hits: SearchHit[] = [];

  for (const lang of langs) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=5&namespace=0&format=json&origin=*`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) continue;
    const raw = await res.text();
    if (!raw.trim()) continue;
    try {
      const data = JSON.parse(raw) as [
        string,
        string[],
        string[],
        string[],
      ];
      const titles = data[1] || [];
      const snippets = data[2] || [];
      const urls = data[3] || [];
      for (let i = 0; i < titles.length; i++) {
        hits.push({
          title: titles[i],
          url: urls[i] || "",
          snippet: snippets[i] || titles[i],
        });
      }
    } catch {
      // try next lang
    }
    if (hits.length) break;
  }

  return hits.slice(0, 8);
}

export async function POST(request: Request) {
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Буруу JSON." }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return Response.json({ error: "Хайлтын үг хоосон." }, { status: 400 });
  }

  try {
    let hits: SearchHit[] = [];
    try {
      hits = await duckDuckGoInstant(query);
    } catch {
      hits = [];
    }
    if (!hits.length) {
      hits = await wikipediaSearch(query);
    }

    if (!hits.length) {
      return Response.json({
        ok: true,
        hits: [],
        notice:
          "Вэб хайлт үр дүн олдсонгүй. Судалгааны бүтэцтэй хариу руу шилжинэ.",
      });
    }
    return Response.json({ ok: true, hits });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Хайлт амжилтгүй.";
    return Response.json(
      {
        ok: false,
        hits: [],
        error: sanitizeApiError(message),
        notice:
          "Вэб хайлтын үйлчилгээнд холбогдож чадсангүй. Дотоод судалгааны горимоор үргэлжлүүлнэ.",
      },
      { status: 200 }
    );
  }
}
