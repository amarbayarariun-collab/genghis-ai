import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { estimateCostUsd, planForTier, resolvePlanTier } from "@/lib/plans";
import { newId } from "@/lib/usage/ids";
import type {
  AuthProvider,
  InvoiceRecord,
  InvoiceStatus,
  PlanUsageSnapshot,
  TokenUsageTotals,
  UsageEventType,
  UsageStats,
  UserRecord,
} from "@/lib/usage/types";

type Sql = NeonQueryFunction<false, false>;
type Row = Record<string, unknown>;

type MemoryStore = {
  users: Map<string, UserRecord>;
  usersByEmail: Map<string, string>;
  events: Array<{
    id: string;
    userId: string;
    eventType: UsageEventType;
    day: string;
    createdAt: string;
  }>;
  tokenUsage: Array<{
    id: string;
    userId: string | null;
    model: string;
    promptTokens: number;
    completionTokens: number;
    reasoningTokens: number;
    cachedTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    createdAt: string;
  }>;
  invoices: Map<string, InvoiceRecord>;
  invoicesBySender: Map<string, string>;
  invoicesByQpay: Map<string, string>;
};

declare global {
  var __genghisUsageMemory: MemoryStore | undefined;
}

function memory(): MemoryStore {
  if (!globalThis.__genghisUsageMemory) {
    globalThis.__genghisUsageMemory = {
      users: new Map(),
      usersByEmail: new Map(),
      events: [],
      tokenUsage: [],
      invoices: new Map(),
      invoicesBySender: new Map(),
      invoicesByQpay: new Map(),
    };
  }
  const store = globalThis.__genghisUsageMemory;
  if (!store.invoices) {
    store.invoices = new Map();
    store.invoicesBySender = new Map();
    store.invoicesByQpay = new Map();
  }
  return store;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** First day of current UTC calendar month (YYYY-MM-01). */
export function monthStartUtc(d = new Date()): string {
  return `${d.toISOString().slice(0, 7)}-01`;
}

export function monthKeyUtc(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    undefined
  );
}

let schemaReady: Promise<void> | null = null;

async function ensureSchema(): Promise<Sql | null> {
  const url = databaseUrl();
  if (!url) return null;
  const sql = neon(url);
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS genghis_users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          password_hash TEXT,
          provider TEXT NOT NULL DEFAULT 'email',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          plan_tier TEXT NOT NULL DEFAULT 'free',
          paid_until TIMESTAMPTZ
        )
      `;
      await sql`ALTER TABLE genghis_users ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free'`;
      await sql`ALTER TABLE genghis_users ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ`;
      await sql`
        CREATE TABLE IF NOT EXISTS genghis_usage_events (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES genghis_users(id) ON DELETE CASCADE,
          event_type TEXT NOT NULL,
          day DATE NOT NULL DEFAULT CURRENT_DATE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS genghis_usage_day_type
        ON genghis_usage_events (day, event_type)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS genghis_usage_user_day_type
        ON genghis_usage_events (user_id, day, event_type)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS genghis_token_usage (
          id TEXT PRIMARY KEY,
          user_id TEXT REFERENCES genghis_users(id) ON DELETE SET NULL,
          model TEXT NOT NULL,
          prompt_tokens INT NOT NULL DEFAULT 0,
          completion_tokens INT NOT NULL DEFAULT 0,
          reasoning_tokens INT NOT NULL DEFAULT 0,
          cached_tokens INT NOT NULL DEFAULT 0,
          total_tokens INT NOT NULL DEFAULT 0,
          estimated_cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS genghis_token_usage_created
        ON genghis_token_usage (created_at DESC)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS genghis_invoices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES genghis_users(id) ON DELETE CASCADE,
          sender_invoice_no TEXT UNIQUE NOT NULL,
          qpay_invoice_id TEXT,
          amount_mnt INT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          mock BOOLEAN NOT NULL DEFAULT FALSE,
          paid_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS genghis_invoices_user
        ON genghis_invoices (user_id, created_at DESC)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS genghis_invoices_qpay
        ON genghis_invoices (qpay_invoice_id)
      `;
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
  return sql;
}

function asRows(result: unknown): Row[] {
  return Array.isArray(result) ? (result as Row[]) : [];
}

function mapUser(row: Row): UserRecord {
  const paidUntil =
    row.paid_until == null ? null : new Date(String(row.paid_until)).toISOString();
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name == null ? null : String(row.name),
    passwordHash:
      row.password_hash == null ? null : String(row.password_hash),
    provider: (row.provider as AuthProvider) || "email",
    createdAt: new Date(String(row.created_at)).toISOString(),
    planTier: resolvePlanTier(paidUntil),
    paidUntil,
  };
}

function withLiveTier(user: UserRecord): UserRecord {
  const tier = resolvePlanTier(user.paidUntil);
  return { ...user, planTier: tier };
}

export function isDatabaseConfigured(): boolean {
  return Boolean(databaseUrl());
}

export async function findUserByEmail(
  email: string
): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  const sql = await ensureSchema();
  if (!sql) {
    const id = memory().usersByEmail.get(normalized);
    const user = id ? memory().users.get(id) || null : null;
    return user ? withLiveTier(user) : null;
  }
  const rows = asRows(
    await sql`
      SELECT id, email, name, password_hash, provider, created_at, plan_tier, paid_until
      FROM genghis_users WHERE email = ${normalized} LIMIT 1
    `
  );
  return rows[0] ? withLiveTier(mapUser(rows[0])) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const sql = await ensureSchema();
  if (!sql) {
    const user = memory().users.get(id) || null;
    return user ? withLiveTier(user) : null;
  }
  const rows = asRows(
    await sql`
      SELECT id, email, name, password_hash, provider, created_at, plan_tier, paid_until
      FROM genghis_users WHERE id = ${id} LIMIT 1
    `
  );
  return rows[0] ? withLiveTier(mapUser(rows[0])) : null;
}

export async function createUser(input: {
  email: string;
  name?: string | null;
  passwordHash?: string | null;
  provider: AuthProvider;
}): Promise<UserRecord> {
  const email = input.email.trim().toLowerCase();
  const id = newId("usr");
  const createdAt = new Date().toISOString();
  const user: UserRecord = {
    id,
    email,
    name: input.name?.trim() || null,
    passwordHash: input.passwordHash || null,
    provider: input.provider,
    createdAt,
    planTier: "free",
    paidUntil: null,
  };

  const sql = await ensureSchema();
  if (!sql) {
    if (memory().usersByEmail.has(email)) {
      throw new Error("EMAIL_TAKEN");
    }
    memory().users.set(id, user);
    memory().usersByEmail.set(email, id);
    if (input.provider !== "guest") {
      await recordEvent(id, "signup");
    }
    return user;
  }

  try {
    await sql`
      INSERT INTO genghis_users (
        id, email, name, password_hash, provider, created_at, plan_tier, paid_until
      )
      VALUES (
        ${id}, ${email}, ${user.name}, ${user.passwordHash}, ${user.provider},
        ${createdAt}, 'free', NULL
      )
    `;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(message)) throw new Error("EMAIL_TAKEN");
    throw err;
  }
  if (input.provider !== "guest") {
    await recordEvent(id, "signup");
  }
  return user;
}

/** Ensure a durable guest user for anonymous quota tracking. */
export async function ensureGuestUser(guestId: string): Promise<UserRecord> {
  const email = `guest-${guestId}@genghis.local`;
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  try {
    return await createUser({
      email,
      name: null,
      passwordHash: null,
      provider: "guest",
    });
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      const again = await findUserByEmail(email);
      if (again) return again;
    }
    throw err;
  }
}

export async function markUserPaid(
  userId: string,
  days = 30,
  from: Date = new Date()
): Promise<UserRecord | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  const base =
    user.paidUntil && new Date(user.paidUntil).getTime() > from.getTime()
      ? new Date(user.paidUntil)
      : from;
  const paidUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const paidUntilIso = paidUntil.toISOString();

  const sql = await ensureSchema();
  if (!sql) {
    const next = withLiveTier({
      ...user,
      planTier: "paid",
      paidUntil: paidUntilIso,
    });
    memory().users.set(userId, next);
    return next;
  }

  await sql`
    UPDATE genghis_users
    SET plan_tier = 'paid', paid_until = ${paidUntilIso}
    WHERE id = ${userId}
  `;
  return findUserById(userId);
}

export async function recordEvent(
  userId: string,
  eventType: UsageEventType
): Promise<void> {
  const id = newId("evt");
  const day = todayUtc();
  const createdAt = new Date().toISOString();
  const sql = await ensureSchema();

  if (!sql) {
    if (eventType === "signup" || eventType === "active") {
      const exists = memory().events.some(
        (e) =>
          e.userId === userId && e.day === day && e.eventType === eventType
      );
      if (exists) return;
    }
    memory().events.push({ id, userId, eventType, day, createdAt });
    return;
  }

  if (eventType === "signup" || eventType === "active") {
    const existing = asRows(
      await sql`
        SELECT id FROM genghis_usage_events
        WHERE user_id = ${userId}
          AND day = ${day}::date
          AND event_type = ${eventType}
        LIMIT 1
      `
    );
    if (existing[0]) return;
  }

  await sql`
    INSERT INTO genghis_usage_events (id, user_id, event_type, day, created_at)
    VALUES (${id}, ${userId}, ${eventType}, ${day}::date, ${createdAt})
  `;
}

export async function countEventsSince(
  userId: string,
  eventType: UsageEventType,
  sinceDay: string
): Promise<number> {
  const sql = await ensureSchema();
  if (!sql) {
    return memory().events.filter(
      (e) =>
        e.userId === userId &&
        e.eventType === eventType &&
        e.day >= sinceDay
    ).length;
  }
  const rows = asRows(
    await sql`
      SELECT COUNT(*)::int AS c
      FROM genghis_usage_events
      WHERE user_id = ${userId}
        AND event_type = ${eventType}
        AND day >= ${sinceDay}::date
    `
  );
  return Number(rows[0]?.c || 0);
}

export async function getPlanUsage(userId: string): Promise<PlanUsageSnapshot> {
  const user = await findUserById(userId);
  const tier = user?.planTier || "free";
  const plan = planForTier(tier);
  const since = monthStartUtc();
  const [messagesUsed, imagesUsed] = await Promise.all([
    countEventsSince(userId, "message", since),
    countEventsSince(userId, "image", since),
  ]);
  return {
    tier,
    messagesUsed,
    messagesLimit: plan.messagesPerMonth,
    imagesUsed,
    imagesLimit: plan.imagesPerMonth,
    model: plan.chatModel,
    paidUntil: user?.paidUntil || null,
    period: monthKeyUtc(),
  };
}

export async function recordTokenUsage(input: {
  userId?: string | null;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
}): Promise<void> {
  const promptTokens = Math.max(0, Math.floor(input.promptTokens || 0));
  const completionTokens = Math.max(0, Math.floor(input.completionTokens || 0));
  const reasoningTokens = Math.max(0, Math.floor(input.reasoningTokens || 0));
  const cachedTokens = Math.max(0, Math.floor(input.cachedTokens || 0));
  const totalTokens =
    input.totalTokens != null
      ? Math.max(0, Math.floor(input.totalTokens))
      : promptTokens + completionTokens;
  const estimated =
    input.estimatedCostUsd != null
      ? input.estimatedCostUsd
      : estimateCostUsd({
          promptTokens,
          completionTokens,
          reasoningTokens,
          cachedTokens,
        });

  const id = newId("tok");
  const createdAt = new Date().toISOString();
  const sql = await ensureSchema();

  if (!sql) {
    memory().tokenUsage.push({
      id,
      userId: input.userId || null,
      model: input.model,
      promptTokens,
      completionTokens,
      reasoningTokens,
      cachedTokens,
      totalTokens,
      estimatedCostUsd: estimated,
      createdAt,
    });
    return;
  }

  await sql`
    INSERT INTO genghis_token_usage (
      id, user_id, model, prompt_tokens, completion_tokens, reasoning_tokens,
      cached_tokens, total_tokens, estimated_cost_usd, created_at
    )
    VALUES (
      ${id},
      ${input.userId || null},
      ${input.model},
      ${promptTokens},
      ${completionTokens},
      ${reasoningTokens},
      ${cachedTokens},
      ${totalTokens},
      ${estimated},
      ${createdAt}
    )
  `;
}

export async function getTokenUsageTotals(): Promise<TokenUsageTotals> {
  const sql = await ensureSchema();
  if (!sql) {
    const rows = memory().tokenUsage;
    return {
      requests: rows.length,
      promptTokens: rows.reduce((s, r) => s + r.promptTokens, 0),
      completionTokens: rows.reduce((s, r) => s + r.completionTokens, 0),
      reasoningTokens: rows.reduce((s, r) => s + r.reasoningTokens, 0),
      cachedTokens: rows.reduce((s, r) => s + r.cachedTokens, 0),
      totalTokens: rows.reduce((s, r) => s + r.totalTokens, 0),
      estimatedCostUsd: rows.reduce((s, r) => s + r.estimatedCostUsd, 0),
      asOf: new Date().toISOString(),
    };
  }

  const rows = asRows(
    await sql`
      SELECT
        COUNT(*)::int AS requests,
        COALESCE(SUM(prompt_tokens), 0)::int AS prompt_tokens,
        COALESCE(SUM(completion_tokens), 0)::int AS completion_tokens,
        COALESCE(SUM(reasoning_tokens), 0)::int AS reasoning_tokens,
        COALESCE(SUM(cached_tokens), 0)::int AS cached_tokens,
        COALESCE(SUM(total_tokens), 0)::int AS total_tokens,
        COALESCE(SUM(estimated_cost_usd), 0)::float AS estimated_cost_usd
      FROM genghis_token_usage
    `
  );
  const row = rows[0] || {};
  return {
    requests: Number(row.requests || 0),
    promptTokens: Number(row.prompt_tokens || 0),
    completionTokens: Number(row.completion_tokens || 0),
    reasoningTokens: Number(row.reasoning_tokens || 0),
    cachedTokens: Number(row.cached_tokens || 0),
    totalTokens: Number(row.total_tokens || 0),
    estimatedCostUsd: Number(row.estimated_cost_usd || 0),
    asOf: new Date().toISOString(),
  };
}

function mapInvoice(row: Row): InvoiceRecord {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    senderInvoiceNo: String(row.sender_invoice_no),
    qpayInvoiceId:
      row.qpay_invoice_id == null ? null : String(row.qpay_invoice_id),
    amountMnt: Number(row.amount_mnt || 0),
    status: (String(row.status || "pending") as InvoiceStatus) || "pending",
    mock: Boolean(row.mock),
    paidAt:
      row.paid_at == null ? null : new Date(String(row.paid_at)).toISOString(),
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}

export async function createInvoiceRecord(input: {
  userId: string;
  senderInvoiceNo: string;
  qpayInvoiceId?: string | null;
  amountMnt: number;
  mock?: boolean;
}): Promise<InvoiceRecord> {
  const id = newId("inv");
  const createdAt = new Date().toISOString();
  const record: InvoiceRecord = {
    id,
    userId: input.userId,
    senderInvoiceNo: input.senderInvoiceNo,
    qpayInvoiceId: input.qpayInvoiceId || null,
    amountMnt: input.amountMnt,
    status: "pending",
    mock: Boolean(input.mock),
    paidAt: null,
    createdAt,
  };

  const sql = await ensureSchema();
  if (!sql) {
    memory().invoices.set(id, record);
    memory().invoicesBySender.set(record.senderInvoiceNo, id);
    if (record.qpayInvoiceId) {
      memory().invoicesByQpay.set(record.qpayInvoiceId, id);
    }
    return record;
  }

  await sql`
    INSERT INTO genghis_invoices (
      id, user_id, sender_invoice_no, qpay_invoice_id, amount_mnt, status, mock, paid_at, created_at
    )
    VALUES (
      ${id},
      ${record.userId},
      ${record.senderInvoiceNo},
      ${record.qpayInvoiceId},
      ${record.amountMnt},
      ${record.status},
      ${record.mock},
      NULL,
      ${createdAt}
    )
  `;
  return record;
}

export async function findInvoiceById(id: string): Promise<InvoiceRecord | null> {
  const sql = await ensureSchema();
  if (!sql) return memory().invoices.get(id) || null;
  const rows = asRows(
    await sql`
      SELECT id, user_id, sender_invoice_no, qpay_invoice_id, amount_mnt, status, mock, paid_at, created_at
      FROM genghis_invoices WHERE id = ${id} LIMIT 1
    `
  );
  return rows[0] ? mapInvoice(rows[0]) : null;
}

export async function findInvoiceByQpayId(
  qpayInvoiceId: string
): Promise<InvoiceRecord | null> {
  const sql = await ensureSchema();
  if (!sql) {
    const id = memory().invoicesByQpay.get(qpayInvoiceId);
    return id ? memory().invoices.get(id) || null : null;
  }
  const rows = asRows(
    await sql`
      SELECT id, user_id, sender_invoice_no, qpay_invoice_id, amount_mnt, status, mock, paid_at, created_at
      FROM genghis_invoices WHERE qpay_invoice_id = ${qpayInvoiceId} LIMIT 1
    `
  );
  return rows[0] ? mapInvoice(rows[0]) : null;
}

export async function findInvoiceBySenderNo(
  senderInvoiceNo: string
): Promise<InvoiceRecord | null> {
  const sql = await ensureSchema();
  if (!sql) {
    const id = memory().invoicesBySender.get(senderInvoiceNo);
    return id ? memory().invoices.get(id) || null : null;
  }
  const rows = asRows(
    await sql`
      SELECT id, user_id, sender_invoice_no, qpay_invoice_id, amount_mnt, status, mock, paid_at, created_at
      FROM genghis_invoices WHERE sender_invoice_no = ${senderInvoiceNo} LIMIT 1
    `
  );
  return rows[0] ? mapInvoice(rows[0]) : null;
}

export async function markInvoicePaid(
  invoiceId: string
): Promise<InvoiceRecord | null> {
  const existing = await findInvoiceById(invoiceId);
  if (!existing) return null;
  if (existing.status === "paid") return existing;

  const paidAt = new Date().toISOString();
  const sql = await ensureSchema();
  if (!sql) {
    const next: InvoiceRecord = { ...existing, status: "paid", paidAt };
    memory().invoices.set(invoiceId, next);
    return next;
  }

  await sql`
    UPDATE genghis_invoices
    SET status = 'paid', paid_at = ${paidAt}
    WHERE id = ${invoiceId}
  `;
  return findInvoiceById(invoiceId);
}

export async function getUsageStats(): Promise<UsageStats> {
  const day = todayUtc();
  const sql = await ensureSchema();
  const nowIso = new Date().toISOString();

  if (!sql) {
    const store = memory();
    const signups = [...store.users.values()].filter(
      (u) => u.provider !== "guest"
    ).length;
    const dau = new Set(
      store.events
        .filter(
          (e) =>
            e.day === day &&
            (e.eventType === "active" || e.eventType === "message")
        )
        .map((e) => e.userId)
    ).size;
    const messagesSent = store.events.filter(
      (e) => e.eventType === "message"
    ).length;
    const messagesToday = store.events.filter(
      (e) => e.eventType === "message" && e.day === day
    ).length;
    const imagesSent = store.events.filter((e) => e.eventType === "image").length;
    const imagesToday = store.events.filter(
      (e) => e.eventType === "image" && e.day === day
    ).length;
    let paidUsers = 0;
    let freeUsers = 0;
    for (const u of store.users.values()) {
      if (u.provider === "guest") continue;
      if (resolvePlanTier(u.paidUntil) === "paid") paidUsers += 1;
      else freeUsers += 1;
    }
    return {
      signups,
      uniqueUsers: signups,
      dau,
      messagesSent,
      messagesToday,
      imagesSent,
      imagesToday,
      freeUsers,
      paidUsers,
      asOf: nowIso,
    };
  }

  const [
    signupRows,
    dauRows,
    msgRows,
    msgTodayRows,
    imgRows,
    imgTodayRows,
    paidRows,
    freeRows,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS c FROM genghis_users WHERE provider <> 'guest'`,
    sql`
      SELECT COUNT(DISTINCT user_id)::int AS c
      FROM genghis_usage_events
      WHERE day = ${day}::date
        AND event_type IN ('active', 'message')
    `,
    sql`
      SELECT COUNT(*)::int AS c
      FROM genghis_usage_events
      WHERE event_type = 'message'
    `,
    sql`
      SELECT COUNT(*)::int AS c
      FROM genghis_usage_events
      WHERE event_type = 'message' AND day = ${day}::date
    `,
    sql`
      SELECT COUNT(*)::int AS c
      FROM genghis_usage_events
      WHERE event_type = 'image'
    `,
    sql`
      SELECT COUNT(*)::int AS c
      FROM genghis_usage_events
      WHERE event_type = 'image' AND day = ${day}::date
    `,
    sql`
      SELECT COUNT(*)::int AS c
      FROM genghis_users
      WHERE provider <> 'guest'
        AND paid_until IS NOT NULL
        AND paid_until > ${nowIso}::timestamptz
    `,
    sql`
      SELECT COUNT(*)::int AS c
      FROM genghis_users
      WHERE provider <> 'guest'
        AND (paid_until IS NULL OR paid_until <= ${nowIso}::timestamptz)
    `,
  ]);

  const signups = Number(asRows(signupRows)[0]?.c || 0);
  return {
    signups,
    uniqueUsers: signups,
    dau: Number(asRows(dauRows)[0]?.c || 0),
    messagesSent: Number(asRows(msgRows)[0]?.c || 0),
    messagesToday: Number(asRows(msgTodayRows)[0]?.c || 0),
    imagesSent: Number(asRows(imgRows)[0]?.c || 0),
    imagesToday: Number(asRows(imgTodayRows)[0]?.c || 0),
    freeUsers: Number(asRows(freeRows)[0]?.c || 0),
    paidUsers: Number(asRows(paidRows)[0]?.c || 0),
    asOf: nowIso,
  };
}
