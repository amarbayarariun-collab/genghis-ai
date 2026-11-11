import { cookies } from "next/headers";
import { planForTier } from "@/lib/plans";
import {
  ensureGuestUser,
  findUserById,
  getPlanUsage,
  recordEvent,
} from "@/lib/usage/db";
import { newId } from "@/lib/usage/ids";
import {
  imageLimitBlock,
  messageLimitBlock,
  type QuotaBlock,
} from "@/lib/usage/quota-messages";
import { readSession } from "@/lib/usage/session";
import type { PlanUsageSnapshot, UserRecord } from "@/lib/usage/types";

export const GUEST_COOKIE = "genghis_guest";

export type QuotaSubject = {
  user: UserRecord;
  usage: PlanUsageSnapshot;
  isGuest: boolean;
};

export type { QuotaBlock };
export {
  buildImageLimitCopy,
  buildMessageLimitCopy,
  imageLimitBlock,
  messageLimitBlock,
} from "@/lib/usage/quota-messages";

async function readOrCreateGuestId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value?.trim();
  if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing;
  const id = newId("gst").replace(/^gst_/, "").slice(0, 24);
  jar.set(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

/** Resolve signed-in user or durable guest for quota + model selection. */
export async function resolveQuotaSubject(): Promise<QuotaSubject> {
  const session = await readSession();
  if (session?.sub) {
    const user = await findUserById(session.sub);
    if (user && user.provider !== "guest") {
      const usage = await getPlanUsage(user.id);
      return { user, usage, isGuest: false };
    }
  }

  const guestId = await readOrCreateGuestId();
  const user = await ensureGuestUser(guestId);
  const usage = await getPlanUsage(user.id);
  return { user, usage, isGuest: true };
}

export async function assertCanSendMessage(): Promise<
  { ok: true; subject: QuotaSubject } | { ok: false; block: QuotaBlock }
> {
  const subject = await resolveQuotaSubject();
  if (subject.usage.messagesUsed >= subject.usage.messagesLimit) {
    return { ok: false, block: messageLimitBlock(subject.usage) };
  }
  return { ok: true, subject };
}

export async function assertCanGenerateImage(): Promise<
  { ok: true; subject: QuotaSubject } | { ok: false; block: QuotaBlock }
> {
  const subject = await resolveQuotaSubject();
  const plan = planForTier(subject.usage.tier);
  if (plan.imagesPerMonth <= 0 || subject.usage.imagesUsed >= plan.imagesPerMonth) {
    return { ok: false, block: imageLimitBlock(subject.usage) };
  }
  return { ok: true, subject };
}

export async function trackMessageForUser(userId: string): Promise<void> {
  try {
    await recordEvent(userId, "active");
    await recordEvent(userId, "message");
  } catch {
    // never break chat
  }
}

export async function trackImageForUser(userId: string): Promise<void> {
  try {
    await recordEvent(userId, "active");
    await recordEvent(userId, "image");
  } catch {
    // never break image
  }
}
