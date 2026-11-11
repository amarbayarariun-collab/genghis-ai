import {
  googleOAuthConfigured,
  publicAppUrl,
} from "@/lib/usage/session";

export async function GET(request: Request) {
  if (!googleOAuthConfigured()) {
    return Response.json(
      {
        error:
          "Google signup is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
      },
      { status: 503 }
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!.trim();
  const redirectUri = `${publicAppUrl(request)}/api/auth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");

  return Response.redirect(url.toString(), 302);
}
