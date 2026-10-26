import { createId } from "@/lib/id";
import type { ChatAttachment } from "@/lib/types";

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_EDGE = 1280;

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Файл уншиж чадсангүй."));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Текст уншиж чадсангүй."));
    reader.readAsText(file);
  });
}

async function compressImage(file: File): Promise<string> {
  const raw = await readAsDataURL(file);
  if (typeof createImageBitmap === "undefined") return raw;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.82);
  } catch {
    return raw;
  }
}

export async function fileToAttachment(file: File): Promise<ChatAttachment> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`«${file.name}» хэт том (дээд тал нь 4MB).`);
  }

  const mime = file.type || "application/octet-stream";
  const isImage = mime.startsWith("image/");

  if (isImage) {
    const dataUrl = await compressImage(file);
    return {
      id: createId("att"),
      name: file.name,
      mime: mime.startsWith("image/") ? "image/jpeg" : mime,
      kind: "image",
      dataUrl,
      size: file.size,
    };
  }

  const textLike =
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/markdown" ||
    /\.(txt|md|csv|json|ts|tsx|js|jsx|py|html|css|xml|yml|yaml)$/i.test(
      file.name
    );

  if (textLike) {
    const text = (await readAsText(file)).slice(0, 80_000);
    return {
      id: createId("att"),
      name: file.name,
      mime,
      kind: "file",
      text,
      size: file.size,
    };
  }

  if (mime === "application/pdf" || /\.pdf$/i.test(file.name)) {
    try {
      const { extractPdfText } = await import("@/lib/pdf-text");
      const text = await extractPdfText(file);
      return {
        id: createId("att"),
        name: file.name,
        mime: "application/pdf",
        kind: "file",
        text,
        size: file.size,
      };
    } catch {
      return {
        id: createId("att"),
        name: file.name,
        mime: "application/pdf",
        kind: "file",
        text: `PDF «${file.name}»-ийн текстийг уншиж чадсангүй. Текстээ хуулж буулгана уу, эсвэл өөр PDF туршина уу.`,
        size: file.size,
      };
    }
  }

  return {
    id: createId("att"),
    name: file.name,
    mime,
    kind: "file",
    text: `[Файл хавсаргасан: ${file.name} (${mime}). Энэ төрлийн агуулгыг шууд уншиж чадсангүй.]`,
    size: file.size,
  };
}
