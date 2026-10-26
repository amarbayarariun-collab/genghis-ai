import type { Metadata } from "next";
import { Literata, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Genghis AI. Монголоос дэлхийтэй холбогд",
  description:
    "Genghis AI. Монголоос дэлхийтэй холбогд. Мэдэх. Бүтээх. Хийх.",
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
