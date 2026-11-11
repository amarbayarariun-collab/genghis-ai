# Genghis AI

Монголын хэрэглэгчдэд зориулсан AI чат туслах: **Genghis AI** MVP.

This repo is the first usable chat slice: a Next.js web app with streaming replies, Mongolian UI copy, and a local mock fallback so the demo works without API keys.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui
- OpenAI-compatible chat API when configured; otherwise mock streaming

## Run locally

```bash
npm install
npm run dev -- -p 4317 -H 127.0.0.1
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

## Plug in a real model later

Create `.env.local` in the project root:

```bash
OPENAI_API_KEY=sk-...   # or AP= for xAI (xai-… keys auto-route to api.x.ai)
# optional legacy chat overrides
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o-mini

# preferred chat provider abstraction (xAI today → self-hosted later)
# CHAT_PROVIDER=xai          # or openai | self
# CHAT_BASE_URL=https://api.x.ai/v1
# CHAT_MODEL=grok-4.7
# CHAT_API_KEY=              # defaults to OPENAI_API_KEY / AP if unset
# self-hosted example:
# CHAT_PROVIDER=self
# CHAT_BASE_URL=http://127.0.0.1:8000/v1
# CHAT_MODEL=genghis-mn

# optional: separate OpenAI key for image generation while chat stays on xAI
# OPENAI_IMAGE_API_KEY=sk-...
# OPENAI_IMAGE_MODEL=dall-e-3
```

Restart the dev server. The chat route (`/api/chat`) uses `resolveChatProvider()` (`src/lib/chat-provider.ts`): `CHAT_*` first, then legacy `OPENAI_*` / `AP`. Without a configured backend, Genghis AI answers in **демо горим**.

`/api/image` stays separate (`OPENAI_IMAGE_API_KEY` → OpenAI Images API). Chat cutover to a Mongolian self-hosted model does not require rewriting the UI.

## What’s in this slice

- Full-screen chat UI (desktop + mobile)
- Sidebar conversation list (localStorage only)
- Empty / loading / error states
- Streaming assistant replies
- Mock fallback without secrets

## Signup + usage (lean)

Sidebar email signup/login (optional Google). Signed-in `/api/chat` and `/api/image` calls increment message + DAU counters. Owner dashboard: `/admin`.

Also wires `@vercel/analytics` (enable Web Analytics on the Vercel project).

### Owner setup (Vercel env — no secrets in git)

| Env | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon/Postgres for users + usage (durable). Without it, in-memory only. |
| `AUTH_SECRET` | Signs session cookies (set in production). |
| `ADMIN_SECRET` | Unlocks `/admin` stats. |
| `AUTH_URL` | Public origin, e.g. `https://genghis-ai-delta.vercel.app` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google signup; redirect URI `…/api/auth/google/callback` |

Admin checks: signups/unique users, DAU (UTC), messages all-time + today.

## Out of scope (for now)

- Hard paywall / forcing signup before chat
- Full profile settings, billing, teams
- Marketing-only landing page

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

