import { findUserByEmail, recordEvent } from "@/lib/usage/db";
import { validateEmail, verifyPassword } from "@/lib/usage/password";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/usage/session";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = body.email?.trim() || "";
  const password = body.password || "";
  if (!validateEmail(email) || !password) {
    return Response.json(
      { error: "Email and password required." },
      { status: 400 }
    );
  }

  const user = await findUserByEmail(email);
  if (!user?.passwordHash) {
    return Response.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return Response.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  await recordEvent(user.id, "active");
  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
  });
  await setSessionCookie(token);

  return Response.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
  });
}
