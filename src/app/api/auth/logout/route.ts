import { clearSessionCookie } from "@/lib/usage/session";

export async function POST() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
