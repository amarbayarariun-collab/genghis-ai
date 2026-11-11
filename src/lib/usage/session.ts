import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionPayload } from "@/lib/usage/types";

export const SESSION_COOKIE = "genghis_session";
export const ADMIN_COOKIE = "genghis_admin";

function authSecret(): Uint8Array {
  const raw =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "";
  if (!raw) {
    // Dev-only fallback so local mock mode still runs. Production must set AUTH_SECRET.
    return new TextEncoder().encode("genghis-dev-auth-secret-change-me");
  }
  return new TextEncoder().encode(raw);
}

export function isAuthSecretConfigured(): boolean {
  return Boolean(
    process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  );
}

export async function createSessionToken(
  payload: SessionPayload
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name ?? null,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(authSecret());
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (!payload.sub || typeof payload.email !== "string") return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name:
        typeof payload.name === "string" || payload.name === null
          ? (payload.name as string | null)
          : null,
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function readSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export function adminSecret(): string | undefined {
  return process.env.ADMIN_SECRET?.trim() || undefined;
}

export async function isAdminRequest(request?: Request): Promise<boolean> {
  const secret = adminSecret();
  if (!secret) return false;

  if (request) {
    const header = request.headers.get("x-admin-secret")?.trim();
    if (header && header === secret) return true;
    const auth = request.headers.get("authorization");
    if (auth?.startsWith("Bearer ") && auth.slice(7).trim() === secret) {
      return true;
    }
  }

  const jar = await cookies();
  const cookie = jar.get(ADMIN_COOKIE)?.value;
  return Boolean(cookie && cookie === secret);
}

export async function setAdminCookie(secret: string): Promise<void> {
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, secret, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function publicAppUrl(request?: Request): string {
  const fromEnv =
    process.env.AUTH_URL?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (request) {
    const host =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  }
  return "http://127.0.0.1:4317";
}
