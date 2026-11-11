import type { Metadata, Viewport } from "next";
import { Literata, Source_Sans_3 } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { LocaleProvider } from "@/components/locale-provider";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/** Shrink layout with the virtual keyboard so chat input stays visible. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const serif = Literata({
  variable: "--font-heading",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const siteDescription =
  "Genghis AI. Монголоос дэлхийтэй холбогд. Үнэгүй 30 мессеж/сар. Pro 72,000₮/сар · 500 мессеж + 10 зураг.";

export const metadata: Metadata = {
  metadataBase: new URL("https://genghis-ai-delta.vercel.app"),
  // Thin space: browsers need a <title>, but the tab should read as knot-favicon-only.
  title: { absolute: "\u2009" },
  description: siteDescription,
  applicationName: "\u2009",
  openGraph: {
    type: "website",
    locale: "mn_MN",
    url: "https://genghis-ai-delta.vercel.app",
    siteName: "Genghis AI",
    title: "Genghis AI · Монголоос дэлхийтэй холбогд",
    description: siteDescription,
    images: [
      {
        url: "/brand/hero-glacier.jpg",
        width: 1920,
        height: 1080,
        alt: "Genghis AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Genghis AI · Монголоос дэлхийтэй холбогд",
    description: siteDescription,
    images: ["/brand/hero-glacier.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon.ico"],
  },
};

const themeBootScript = `
(function(){
  try {
    var t = localStorage.getItem('genghis:theme');
    if (t !== 'dark' && t !== 'light') t = 'light';
    var r = document.documentElement;
    if (t === 'dark') r.classList.add('dark');
    else r.classList.remove('dark');
    r.dataset.theme = t;
    r.style.colorScheme = t;
    var l = localStorage.getItem('genghis:locale');
    if (l !== 'en' && l !== 'mn') l = 'mn';
    r.lang = l === 'en' ? 'en' : 'mn';
    r.dataset.locale = l;
  } catch (e) {}
})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="mn"
      className={`${sans.variable} ${serif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider>
          <LocaleProvider>{children}</LocaleProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
