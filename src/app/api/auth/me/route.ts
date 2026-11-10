import { findUserById, recordEvent } from "@/lib/usage/db";
import { readSession } from "@/lib/usage/session";

export async function GET() {
  const session = await readSession();
  if (!session) {
    return Response.json({ user: null });
  }

  const user = await findUserById(session.sub);
  if (!user) {
    return Response.json({ user: null });
  }

  // Cheap DAU ping once the client asks who is signed in.
  void recordEvent(user.id, "active");

  return Response.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
