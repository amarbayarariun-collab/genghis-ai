import { createUser } from "@/lib/usage/db";
import {
  hashPassword,
  validateEmail,
  validatePassword,
} from "@/lib/usage/password";
import {
  createSessionToken,
  setSessionCookie,
} from "@/lib/usage/session";

export async function POST(request: Request) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const email = body.email?.trim() || "";
  const password = body.password || "";
  const name = body.name?.trim() || null;

  if (!validateEmail(email)) {
    return Response.json({ error: "Enter a valid email." }, { status: 400 });
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return Response.json({ error: passwordError }, { status: 400 });
  }

  try {
    const passwordHash = await hashPassword(password);
    const user = await createUser({
      email,
      name,
      passwordHash,
      provider: "email",
    });
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
  } catch (err) {
    if (err instanceof Error && err.message === "EMAIL_TAKEN") {
      return Response.json(
        { error: "That email is already registered. Log in instead." },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Signup failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
