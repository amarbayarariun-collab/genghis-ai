"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SiteLegalLinks } from "@/components/legal/site-legal-links";
import { Button } from "@/components/ui/button";
import { FREE_PLAN, PAID_PLAN } from "@/lib/plans";

type AuthUser = { id: string; email: string; name: string | null };
type PlanInfo = { tier: "free" | "paid"; paidUntil: string | null };

type InvoicePayload = {
  id: string;
  amountMnt: number;
  status: string;
  mock?: boolean;
};

type CreateResponse = {
  ok?: boolean;
  mock?: boolean;
  notice?: string;
  error?: string;
  feeNote?: string;
  invoice?: InvoicePayload;
  qrImage?: string | null;
  qrText?: string | null;
  shortUrl?: string | null;
  urls?: Array<{ name?: string; link?: string; logo?: string }>;
};

export function PricingCheckout() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoicePayload | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [urls, setUrls] = useState<Array<{ name?: string; link?: string }>>([]);
  const [feeNote, setFeeNote] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    const data = (await res.json()) as {
      user?: AuthUser | null;
      usage?: { tier?: "free" | "paid"; paidUntil?: string | null };
    };
    setUser(data.user || null);
    setPlan(
      data.usage
        ? {
            tier: data.usage.tier || "free",
            paidUntil: data.usage.paidUntil || null,
          }
        : null
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = (await res.json()) as {
          user?: AuthUser | null;
          usage?: { tier?: "free" | "paid"; paidUntil?: string | null };
        };
        if (cancelled) return;
        setUser(data.user || null);
        setPlan(
          data.usage
            ? {
                tier: data.usage.tier || "free",
                paidUntil: data.usage.paidUntil || null,
              }
            : null
        );
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!invoice || invoice.status === "paid") return;
    const timer = setInterval(() => {
      void (async () => {
        const res = await fetch(
          `/api/billing/qpay/status?invoiceId=${encodeURIComponent(invoice.id)}`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          invoice?: InvoicePayload;
          plan?: PlanInfo;
        };
        if (data.invoice) setInvoice(data.invoice);
        if (data.plan) setPlan(data.plan);
        if (data.invoice?.status === "paid") {
          setNotice("Төлбөр амжилттай. Pro эрх 30 хоног идэвхжлээ.");
          await refreshMe();
        }
      })();
    }, 4000);
    return () => clearInterval(timer);
  }, [invoice, refreshMe]);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/billing/qpay/invoice", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as CreateResponse;
      if (!res.ok || !data.invoice) {
        throw new Error(data.error || "Нэхэмжлэх үүсгэж чадсангүй.");
      }
      setInvoice(data.invoice);
      setQrImage(data.qrImage || null);
      setShortUrl(data.shortUrl || null);
      setUrls(data.urls || []);
      setFeeNote(data.feeNote || null);
      setNotice(data.notice || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }

  async function mockComplete() {
    if (!invoice) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/qpay/mock-complete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = (await res.json()) as {
        error?: string;
        notice?: string;
        paidUntil?: string | null;
      };
      if (!res.ok) {
        throw new Error(data.error || "Mock төлбөрийг дуусгаж чадсангүй.");
      }
      setNotice(data.notice || "Mock төлбөр амжилттай.");
      setInvoice({ ...invoice, status: "paid" });
      setPlan({ tier: "paid", paidUntil: data.paidUntil || null });
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-[radial-gradient(ellipse_at_top,#F8F6F1_0%,#EFE8DC_45%,#E4D5BE_100%)] text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6 sm:py-12">
        <header className="space-y-3">
          <p className="text-xs tracking-[0.2em] text-ink/45 uppercase">
            Genghis AI
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Багц сонгох
          </h1>
          <p className="max-w-xl text-base text-ink/70">
            Монголоос дэлхийтэй холбогд. Монгол хэлээр асуу, сур, бич, бүтээ.
            Үнэгүй багцаар эхэлж, илүү их хэрэгтэй үед Pro руу шилжээрэй.
          </p>
          <Link
            href="/"
            className="inline-flex text-sm text-ink/60 underline underline-offset-4"
          >
            Чат руу буцах
          </Link>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          <article className="space-y-4 border border-ink/10 bg-white/70 p-5 sm:p-6 backdrop-blur">
            <h2 className="font-heading text-2xl font-semibold">Үнэгүй</h2>
            <p className="text-3xl font-semibold tabular-nums">0₮</p>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>{FREE_PLAN.messagesPerMonth} мессеж / сар</li>
              <li>Загвар: {FREE_PLAN.chatModel}</li>
              <li>Зураг үүсгэхгүй</li>
            </ul>
          </article>

          <article className="space-y-4 border border-[#C9A36B]/50 bg-[#C9A36B]/10 p-5 sm:p-6">
            <h2 className="font-heading text-2xl font-semibold">Pro</h2>
            <p className="text-3xl font-semibold tabular-nums">
              {PAID_PLAN.priceMnt.toLocaleString("mn-MN")}₮
              <span className="ml-2 text-base font-normal text-ink/60">
                / сар · ~${PAID_PLAN.priceUsd}
              </span>
            </p>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>{PAID_PLAN.messagesPerMonth} мессеж / сар</li>
              <li>{PAID_PLAN.imagesPerMonth} зураг / сар</li>
              <li>Загвар: {PAID_PLAN.chatModel}</li>
              <li>Төлбөр амжилттай болсны дараа 30 хоног</li>
            </ul>
            <p className="text-xs text-ink/55">
              QPay дотоод шимтгэл ихэвчлэн ~1% (merchant гэрээгээр баталгаажуулна).
            </p>
          </article>
        </section>

        <section className="space-y-4 border border-ink/10 bg-white/80 p-5 sm:p-6">
          <h2 className="font-heading text-xl font-semibold">Төлбөр (QPay)</h2>
          {plan?.tier === "paid" ? (
            <p className="text-sm text-ink/70">
              Pro идэвхтэй
              {plan.paidUntil
                ? ` · дуусах: ${new Date(plan.paidUntil).toLocaleString("mn-MN")}`
                : ""}
              . Дахин төлбөр төлснөөр 30 хоног сунгагдана.
            </p>
          ) : (
            <p className="text-sm text-ink/70">
              Одоогийн багц: үнэгүй ({FREE_PLAN.messagesPerMonth} мессеж / сар).
              Pro руу шилжихийн тулд нэвтэрч QPay-ээр төлнө үү. QPay
              тохируулаагүй үед mock горим ажиллана (мөнгө авахгүй).
            </p>
          )}

          {!user ? (
            <p className="text-sm text-ink/70">
              Эхлээд чатны хажуу самбараас нэвтэрнэ үү, дараа нь энд буцаж ирнэ үү.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink/60">{user.email}</p>
              <Button type="button" disabled={busy} onClick={() => void startCheckout()}>
                {busy ? "…" : "QPay нэхэмжлэх үүсгэх"}
              </Button>
            </div>
          )}

          {error ? (
            <p className="text-sm text-red-700">{error}</p>
          ) : null}
          {notice ? (
            <p className="text-sm text-ink/70">{notice}</p>
          ) : null}
          {feeNote ? (
            <p className="text-xs text-ink/50">{feeNote}</p>
          ) : null}

          {invoice ? (
            <div className="space-y-3 border-t border-ink/10 pt-4">
              <p className="text-sm">
                Нэхэмжлэх: {invoice.id} ·{" "}
                {invoice.amountMnt.toLocaleString("mn-MN")}₮ · {invoice.status}
                {invoice.mock ? " · mock" : ""}
              </p>
              {qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="QPay QR"
                  src={
                    qrImage.startsWith("data:")
                      ? qrImage
                      : `data:image/png;base64,${qrImage}`
                  }
                  className="h-48 w-48 border border-ink/10 bg-white p-2"
                />
              ) : null}
              {shortUrl ? (
                <a
                  href={shortUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm underline"
                >
                  QPay холбоос нээх
                </a>
              ) : null}
              {urls.length ? (
                <ul className="space-y-1 text-sm">
                  {urls.map((u) =>
                    u.link ? (
                      <li key={`${u.name}-${u.link}`}>
                        <a href={u.link} className="underline">
                          {u.name || "Банкны апп"}
                        </a>
                      </li>
                    ) : null
                  )}
                </ul>
              ) : null}
              {invoice.mock && invoice.status !== "paid" ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void mockComplete()}
                >
                  Mock төлбөр дуусгах (мөнгө авахгүй)
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        <footer className="border-t border-ink/10 pt-6">
          <SiteLegalLinks />
        </footer>
      </div>
    </main>
  );
}
