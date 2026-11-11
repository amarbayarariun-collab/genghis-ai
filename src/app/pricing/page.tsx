import Link from "next/link";
import { FREE_PLAN, PAID_PLAN } from "@/lib/plans";

export default function PricingPage() {
  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#F8F6F1_0%,#EFE8DC_45%,#E4D5BE_100%)] text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-12">
        <header className="space-y-3">
          <p className="text-xs tracking-[0.2em] text-ink/45 uppercase">
            Genghis AI
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Багц сонгох
          </h1>
          <p className="max-w-xl text-base text-ink/70">
            Монгол хэрэглэгчдэд зориулсан тод хязгаар. Төлбөрийн QPay урсгал
            дараагийн PR-д холбогдоно. Энд зөвхөн багцын мэдээлэл.
          </p>
          <Link
            href="/"
            className="inline-flex text-sm text-ink/60 underline underline-offset-4"
          >
            Чат руу буцах
          </Link>
        </header>

        <section className="grid gap-6 sm:grid-cols-2">
          <article className="space-y-4 border border-ink/10 bg-white/70 p-6 backdrop-blur">
            <h2 className="font-heading text-2xl font-semibold">Үнэгүй</h2>
            <p className="text-3xl font-semibold tabular-nums">0₮</p>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>{FREE_PLAN.messagesPerMonth} мессеж / сар</li>
              <li>Загвар: {FREE_PLAN.chatModel}</li>
              <li>Зураг үүсгэхгүй</li>
            </ul>
          </article>

          <article className="space-y-4 border border-[#C9A36B]/50 bg-[#C9A36B]/10 p-6">
            <h2 className="font-heading text-2xl font-semibold">Pro</h2>
            <p className="text-3xl font-semibold tabular-nums">
              ${PAID_PLAN.priceUsd}
              <span className="ml-2 text-base font-normal text-ink/60">
                · ~{PAID_PLAN.priceMnt.toLocaleString("mn-MN")}₮ / сар
              </span>
            </p>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>{PAID_PLAN.messagesPerMonth} мессеж / сар</li>
              <li>{PAID_PLAN.imagesPerMonth} зураг / сар</li>
              <li>
                Загвар: {PAID_PLAN.chatModel} (reasoning_effort=
                {PAID_PLAN.reasoningEffort})
              </li>
              <li>30 хоногийн эрх (төлбөр амжилттай болсны дараа)</li>
            </ul>
            <p className="text-sm text-ink/60">
              QPay төлбөр удахгүй. Одоогоор checkout идэвхгүй (merchant env
              байхгүй үед mock).
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}
