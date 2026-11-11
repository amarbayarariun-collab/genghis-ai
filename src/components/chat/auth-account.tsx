"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  plan?: "free" | "paid";
  paidUntil?: string | null;
};

type PlanUsage = {
  tier: "free" | "paid";
  messagesUsed: number;
  messagesLimit: number;
  imagesUsed: number;
  imagesLimit: number;
  model: string;
  period: string;
};

export function AuthAccount() {
  const { t, locale } = useLocale();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = (await res.json()) as {
          user?: AuthUser | null;
          usage?: PlanUsage | null;
        };
        if (!cancelled) {
          setUser(data.user || null);
          setUsage(data.usage || null);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setUsage(null);
        }
      }
      try {
        const probe = await fetch("/api/auth/providers");
        const providers = (await probe.json()) as { google?: boolean };
        if (!cancelled) setGoogleEnabled(Boolean(providers.google));
      } catch {
        if (!cancelled) setGoogleEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        mode === "signup" ? "/api/auth/signup" : "/api/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            name: name || undefined,
          }),
        }
      );
      const data = (await res.json()) as {
        error?: string;
        user?: AuthUser;
      };
      if (!res.ok || !data.user) {
        throw new Error(data.error || t("authFail"));
      }
      setUser(data.user);
      setOpen(false);
      setPassword("");
      const me = await fetch("/api/auth/me", { credentials: "include" });
      const meData = (await me.json()) as { usage?: PlanUsage | null };
      setUsage(meData.usage || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("authFail"));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
      setUser(null);
      const me = await fetch("/api/auth/me", { credentials: "include" });
      const meData = (await me.json()) as { usage?: PlanUsage | null };
      setUsage(meData.usage || null);
    } finally {
      setBusy(false);
    }
  }

  const initial = (user?.name || user?.email || "?").slice(0, 1).toUpperCase();
  const tier = usage?.tier || user?.plan || "free";

  return (
    <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
      {usage ? (
        <div className="mb-2 space-y-1 rounded-xl bg-zinc-50 px-2.5 py-2 text-[11px] text-ink/70 dark:bg-zinc-900 dark:text-zinc-400">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-ink dark:text-zinc-200">
              {tier === "paid" ? t("planPaid") : t("planFree")}
              {usage.model ? ` · ${usage.model}` : ""}
            </span>
            {tier === "free" ? (
              <Link
                href="/pricing"
                className="text-gold underline decoration-gold/40 underline-offset-2"
              >
                {t("planUpgrade")}
              </Link>
            ) : null}
          </div>
          <p>
            {t("planUsage")}: {usage.messagesUsed}/{usage.messagesLimit}
            {usage.imagesLimit > 0
              ? ` · ${locale === "en" ? "img" : "зураг"} ${usage.imagesUsed}/${usage.imagesLimit}`
              : locale === "en"
                ? " · no images"
                : " · зураггүй"}
          </p>
        </div>
      ) : null}

      {user ? (
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink dark:text-zinc-100">
              {user.name || user.email}
            </p>
            <p className="truncate text-[11px] text-ink/45 dark:text-zinc-500">
              {user.email}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void logout()}
          >
            {t("authLogout")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2 px-1">
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setError(null);
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-ink/70 dark:bg-zinc-800 dark:text-zinc-300">
              ?
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink dark:text-zinc-100">
                {t("authSignIn")}
              </p>
              <p className="text-[11px] text-ink/45 dark:text-zinc-500">
                {t("authHint")}
              </p>
            </div>
          </button>

          {open ? (
            <form onSubmit={submit} className="space-y-2 rounded-xl bg-zinc-50 p-2.5 dark:bg-zinc-900">
              <div className="flex gap-1 text-[11px]">
                <button
                  type="button"
                  className={
                    mode === "signup"
                      ? "rounded-md bg-white px-2 py-1 font-medium dark:bg-zinc-800"
                      : "rounded-md px-2 py-1 text-ink/50"
                  }
                  onClick={() => setMode("signup")}
                >
                  {t("authSignup")}
                </button>
                <button
                  type="button"
                  className={
                    mode === "login"
                      ? "rounded-md bg-white px-2 py-1 font-medium dark:bg-zinc-800"
                      : "rounded-md px-2 py-1 text-ink/50"
                  }
                  onClick={() => setMode("login")}
                >
                  {t("authLogin")}
                </button>
              </div>
              {mode === "signup" ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("authName")}
                  className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
                  autoComplete="name"
                />
              ) : null}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("authEmail")}
                type="email"
                required
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
                autoComplete="email"
              />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("authPassword")}
                type="password"
                required
                minLength={8}
                className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
              />
              {error ? (
                <p className="text-[11px] text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={busy}
              >
                {busy
                  ? "…"
                  : mode === "signup"
                    ? t("authSignup")
                    : t("authLogin")}
              </Button>
              {googleEnabled ? (
                <a
                  href="/api/auth/google"
                  className="block w-full rounded-lg border border-zinc-200 px-2.5 py-1.5 text-center text-sm text-ink/80 hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-950"
                >
                  {t("authGoogle")}
                </a>
              ) : null}
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
}
