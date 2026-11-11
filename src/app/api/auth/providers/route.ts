import {
  googleOAuthConfigured,
  isAuthSecretConfigured,
} from "@/lib/usage/session";
import { isDatabaseConfigured } from "@/lib/usage/db";

export async function GET() {
  return Response.json({
    email: true,
    google: googleOAuthConfigured(),
    database: isDatabaseConfigured(),
    authSecret: isAuthSecretConfigured(),
  });
}
