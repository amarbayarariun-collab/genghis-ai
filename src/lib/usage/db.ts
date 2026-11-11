import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { newId } from "@/lib/usage/ids";
import type {
  AuthProvider,
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
    };
  }
  return globalThis.__genghisUsageMemory;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
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
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
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
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name == null ? null : String(row.name),
    passwordHash:
      row.password_hash == null ? null : String(row.password_hash),
    provider: (row.provider as AuthProvider) || "email",
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
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
    return id ? memory().users.get(id) || null : null;
  }
  const rows = asRows(
    await sql`
      SELECT id, email, name, password_hash, provider, created_at
      FROM genghis_users WHERE email = ${normalized} LIMIT 1
    `
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const sql = await ensureSchema();
  if (!sql) {
    return memory().users.get(id) || null;
  }
  const rows = asRows(
    await sql`
      SELECT id, email, name, password_hash, provider, created_at
      FROM genghis_users WHERE id = ${id} LIMIT 1
    `
  );
  return rows[0] ? mapUser(rows[0]) : null;
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
  };

  const sql = await ensureSchema();
  if (!sql) {
    if (memory().usersByEmail.has(email)) {
      throw new Error("EMAIL_TAKEN");
    }
    memory().users.set(id, user);
    memory().usersByEmail.set(email, id);
    await recordEvent(id, "signup");
    return user;
  }

  try {
    await sql`
      INSERT INTO genghis_users (id, email, name, password_hash, provider, created_at)
      VALUES (${id}, ${email}, ${user.name}, ${user.passwordHash}, ${user.provider}, ${createdAt})
    `;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(message)) throw new Error("EMAIL_TAKEN");
    throw err;
  }
  await recordEvent(id, "signup");
  return user;
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

export async function getUsageStats(): Promise<UsageStats> {
  const day = todayUtc();
  const sql = await ensureSchema();

  if (!sql) {
    const store = memory();
    const signups = store.users.size;
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
    return {
      signups,
      uniqueUsers: signups,
      dau,
      messagesSent,
      messagesToday,
      asOf: new Date().toISOString(),
    };
  }

  const [signupRows, dauRows, msgRows, msgTodayRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS c FROM genghis_users`,
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
  ]);

  const signups = Number(asRows(signupRows)[0]?.c || 0);
  return {
    signups,
    uniqueUsers: signups,
    dau: Number(asRows(dauRows)[0]?.c || 0),
    messagesSent: Number(asRows(msgRows)[0]?.c || 0),
    messagesToday: Number(asRows(msgTodayRows)[0]?.c || 0),
    asOf: new Date().toISOString(),
  };
}
