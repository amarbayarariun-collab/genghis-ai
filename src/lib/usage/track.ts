import { recordEvent } from "@/lib/usage/db";
import { readSession } from "@/lib/usage/session";

/** Best-effort message + DAU tracking for signed-in users. Never throws. */
export async function trackSignedInMessage(): Promise<void> {
  try {
    const session = await readSession();
    if (!session?.sub) return;
    await recordEvent(session.sub, "active");
    await recordEvent(session.sub, "message");
  } catch {
    // Usage tracking must not break chat.
  }
}
