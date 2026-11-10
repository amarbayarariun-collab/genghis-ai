import {
  adminSecret,
  clearAdminCookie,
  setAdminCookie,
} from "@/lib/usage/session";

export async function POST(request: Request) {
  const expected = adminSecret();
  if (!expected) {
    return Response.json(
      { error: "ADMIN_SECRET is not configured on the server." },
      { status: 503 }
    );
  }

  let body: { secret?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (body.secret?.trim() !== expected) {
    return Response.json({ error: "Invalid admin secret." }, { status: 401 });
  }

  await setAdminCookie(expected);
  return Response.json({ ok: true });
}

export async function DELETE() {
  await clearAdminCookie();
  return Response.json({ ok: true });
}
