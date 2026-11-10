import { createUser, findUserByEmail, recordEvent } from "@/lib/usage/db";
import {
  createSessionToken,
  googleOAuthConfigured,
  publicAppUrl,
  setSessionCookie,
} from "@/lib/usage/session";

export async function GET(request: Request) {
  const appUrl = publicAppUrl(request);
  if (!googleOAuthConfigured()) {
    return Response.redirect(`${appUrl}/?authError=google_not_configured`);
  }

  const incoming = new URL(request.url);
  const code = incoming.searchParams.get("code");
  const oauthError = incoming.searchParams.get("error");
  if (oauthError || !code) {
    return Response.redirect(`${appUrl}/?authError=google_denied`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!.trim();
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      return Response.redirect(`${appUrl}/?authError=google_token`);
    }

    const profileRes = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      { headers: { Authorization: `Bearer ${tokenJson.access_token}` } }
    );
    const profile = (await profileRes.json()) as {
      email?: string;
      name?: string;
    };
    if (!profile.email) {
      return Response.redirect(`${appUrl}/?authError=google_email`);
    }

    let user = await findUserByEmail(profile.email);
    if (!user) {
      user = await createUser({
        email: profile.email,
        name: profile.name || null,
        passwordHash: null,
        provider: "google",
      });
    } else {
      await recordEvent(user.id, "active");
    }

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
    await setSessionCookie(token);
    return Response.redirect(`${appUrl}/`);
  } catch {
    return Response.redirect(`${appUrl}/?authError=google_failed`);
  }
}
