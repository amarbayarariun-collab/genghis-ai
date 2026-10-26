"use client";

const SCANNED_MSG =
  "Энэ PDF-ээс текст олдсонгүй (скан/зураг хэлбэрийн файл байж магадгүй). CV үнэлгээ хийхийн тулд текстийг хуулж буулгана уу, эсвэл текст бүхий PDF оруулна уу.";

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Worker from same package (Next-compatible URL)
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const maxPages = Math.min(doc.numPages, 40);
  const chunks: string[] = [];

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? String(item.str) : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (line) chunks.push(line);
  }

  try {
    doc.cleanup();
  } catch {
    // ignore
  }

  const text = chunks.join("\n\n").trim();
  if (text.length < 40) {
    return SCANNED_MSG;
  }
  return text.slice(0, 80_000);
}
