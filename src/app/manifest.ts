import type { MetadataRoute } from "next";

/** PWA web app manifest — MN name/description, icons from existing public assets. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Genghis AI",
    short_name: "Genghis AI",
    description:
      "Genghis AI. Монголоос дэлхийтэй холбогд. Үнэгүй 30 мессеж/сар. Pro 72,000₮/сар · 500 мессеж + 10 зураг.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "mn",
    dir: "ltr",
    background_color: "#FFFFFF",
    theme_color: "#C9A36B",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
