export type AuthProvider = "email" | "google";

export type UsageEventType = "signup" | "active" | "message";

export type UserRecord = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  provider: AuthProvider;
  createdAt: string;
};

export type SessionPayload = {
  sub: string;
  email: string;
  name?: string | null;
};

export type UsageStats = {
  signups: number;
  uniqueUsers: number;
  dau: number;
  messagesSent: number;
  messagesToday: number;
  asOf: string;
};
