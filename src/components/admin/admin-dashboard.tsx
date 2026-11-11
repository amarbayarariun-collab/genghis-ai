"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type Stats = {
  signups: number;
  uniqueUsers: number;
  dau: number;
  messagesSent: number;
  messagesToday: number;
  imagesSent: number;
  imagesToday: number;
  freeUsers: number;
  paidUsers: number;
  asOf: string;
};

type TokenTotals = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  asOf: string;
};

type Setup = {
  database: boolean;
  authSecret: boolean;
  adminSecret: boolean;
  googleOAuth: boolean;
};

export function AdminDashboard() {
  const [secret, setSecret] = useState("");
  const [authed, setAuthed] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tokens, setTokens] = useState<TokenTotals | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/stats", { credentials: "include" });
    if (res.status === 401) {
      setAuthed(false);
      setStats(null);
      setTokens(null);
      return;
    }
    const data = (await res.json()) as {
      error?: string;
      stats?: Stats;
      tokens?: TokenTotals;
      setup?: Setup;
    };
    if (!res.ok) {
      throw new Error(data.error || "Failed to load stats");
    }
    setAuthed(true);
    setStats(data.stats || null);
    setTokens(data.tokens || null);
    setSetup(data.setup || null);
  }, []);

  // Restore admin cookie session once on mount.
  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cookie session restore
    void loadStats().catch(() => {
      if (!cancelled) setAuthed(false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadStats]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Unauthorized");
      setSecret("");
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/login", {
      method: "DELETE",
      credentials: "include",
    });
    setAuthed(false);
    setStats(null);
    setTokens(null);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-6 py-10 font-sans text-ink dark:text-zinc-100">
      <div>
        <p className="text-xs tracking-wide text-ink/45 uppercase dark:text-zinc-500">
          Genghis AI
        </p>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Owner admin
        </h1>
        <p className="mt-1 text-sm text-ink/60 dark:text-zinc-400">
          Signups, tiers, messages, images, and estimated xAI token cost.
        </p>
      </div>

      {!authed ? (
        <form onSubmit={login} className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          <label className="block text-sm">
            Admin secret
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950"
              autoComplete="current-password"
              required
            />
          </label>
          {error ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "…" : "Unlock"}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Signups / unique" value={stats?.uniqueUsers} />
            <StatCard label="DAU (UTC today)" value={stats?.dau} />
            <StatCard label="Free users" value={stats?.freeUsers} />
            <StatCard label="Paid users" value={stats?.paidUsers} />
            <StatCard label="Messages (all)" value={stats?.messagesSent} />
            <StatCard label="Messages today" value={stats?.messagesToday} />
            <StatCard label="Images (all)" value={stats?.imagesSent} />
            <StatCard label="Images today" value={stats?.imagesToday} />
          </div>

          <div className="space-y-2 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm font-medium">xAI token usage (estimated)</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p>Requests: {tokens?.requests ?? "—"}</p>
              <p>Total tokens: {fmt(tokens?.totalTokens)}</p>
              <p>Prompt: {fmt(tokens?.promptTokens)}</p>
              <p>Completion: {fmt(tokens?.completionTokens)}</p>
              <p>Reasoning: {fmt(tokens?.reasoningTokens)}</p>
              <p>Cached: {fmt(tokens?.cachedTokens)}</p>
            </div>
            <p className="pt-1 font-heading text-2xl font-semibold tabular-nums">
              ~$
              {tokens
                ? tokens.estimatedCostUsd.toFixed(4)
                : "—"}
            </p>
            <p className="text-[11px] text-ink/45 dark:text-zinc-500">
              Estimate only (env rates). Not QPay or provider invoices.
            </p>
          </div>

          <p className="text-xs text-ink/45 dark:text-zinc-500">
            As of {stats?.asOf ? new Date(stats.asOf).toLocaleString() : "—"}
          </p>
          {setup ? (
            <ul className="space-y-1 rounded-2xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
              <li>DATABASE_URL: {setup.database ? "ok" : "missing (in-memory)"}</li>
              <li>AUTH_SECRET: {setup.authSecret ? "ok" : "missing (dev fallback)"}</li>
              <li>ADMIN_SECRET: {setup.adminSecret ? "ok" : "missing"}</li>
              <li>Google OAuth: {setup.googleOAuth ? "ok" : "off"}</li>
            </ul>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => void loadStats()}>
              Refresh
            </Button>
            <Button type="button" variant="ghost" onClick={() => void logout()}>
              Lock
            </Button>
            <Link
              href="/"
              className="ml-auto self-center text-sm text-ink/60 underline dark:text-zinc-400"
            >
              Back to chat
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

function fmt(n?: number) {
  if (n == null) return "—";
  return n.toLocaleString();
}

function StatCard({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-[11px] text-ink/45 dark:text-zinc-500">{label}</p>
      <p className="mt-1 font-heading text-3xl font-semibold tabular-nums">
        {value ?? "—"}
      </p>
    </div>
  );
}
