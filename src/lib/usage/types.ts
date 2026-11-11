import type { PlanTier } from "@/lib/plans";

export type AuthProvider = "email" | "google" | "guest";

export type UsageEventType = "signup" | "active" | "message" | "image";

export type UserRecord = {
  id: string;
  email: string;
  name: string | null;
  passwordHash: string | null;
  provider: AuthProvider;
  createdAt: string;
  planTier: PlanTier;
  paidUntil: string | null;
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
  imagesSent: number;
  imagesToday: number;
  freeUsers: number;
  paidUsers: number;
  asOf: string;
};

export type TokenUsageRecord = {
  id: string;
  userId: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
};

export type TokenUsageTotals = {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  asOf: string;
};

export type PlanUsageSnapshot = {
  tier: PlanTier;
  messagesUsed: number;
  messagesLimit: number;
  imagesUsed: number;
  imagesLimit: number;
  model: string;
  paidUntil: string | null;
  period: string;
};
