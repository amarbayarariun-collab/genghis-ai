import { findUserById, getPlanUsage, recordEvent } from "@/lib/usage/db";
import { resolveQuotaSubject } from "@/lib/usage/quotas";
import { readSession } from "@/lib/usage/session";

export async function GET() {
  const session = await readSession();
  if (session?.sub) {
    const user = await findUserById(session.sub);
    if (user && user.provider !== "guest") {
      void recordEvent(user.id, "active");
      const usage = await getPlanUsage(user.id);
      return Response.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: usage.tier,
          paidUntil: user.paidUntil,
        },
        usage,
      });
    }
  }

  // Anonymous visitors still get a guest quota snapshot for UI hints.
  try {
    const subject = await resolveQuotaSubject();
    return Response.json({
      user: null,
      usage: subject.usage,
      guest: true,
    });
  } catch {
    return Response.json({ user: null, usage: null });
  }
}
