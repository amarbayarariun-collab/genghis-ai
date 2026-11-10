import { getUsageStats, isDatabaseConfigured } from "@/lib/usage/db";
import {
  adminSecret,
  googleOAuthConfigured,
  isAdminRequest,
  isAuthSecretConfigured,
} from "@/lib/usage/session";

export async function GET(request: Request) {
  if (!(await isAdminRequest(request))) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const stats = await getUsageStats();
  return Response.json({
    ok: true,
    stats,
    setup: {
      database: isDatabaseConfigured(),
      authSecret: isAuthSecretConfigured(),
      adminSecret: Boolean(adminSecret()),
      googleOAuth: googleOAuthConfigured(),
    },
  });
}
