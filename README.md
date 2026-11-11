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
# CHAT_MODEL=                # ops override; else plan picks grok-4.3 / grok-4.7
# CHAT_API_KEY=              # defaults to OPENAI_API_KEY / AP if unset
# CHAT_HISTORY_LIMIT=16
# CHAT_MAX_TOKENS=1500
# ATTACH_TEXT_LIMIT=15000
# self-hosted example:
# CHAT_PROVIDER=self
# CHAT_BASE_URL=http://127.0.0.1:8000/v1
# CHAT_MODEL=genghis-mn

# image provider: auto (default when unset) | openai | xai
# IMAGE_PROVIDER=auto

# PRIMARY (default): xAI Imagine via chat key AP / OPENAI_API_KEY (xai-…)
# model grok-imagine-image (~$0.02)

# OPT-IN: OpenAI GPT Image (only when IMAGE_PROVIDER=openai or key set as auto fallback)
# OPENAI_IMAGE_API_KEY=sk-...
# OPENAI_IMAGE_MODEL=gpt-image-2.5-flare
# OPENAI_IMAGE_QUALITY=low
# OPENAI_IMAGE_SIZE=1024x1024
```

Restart the dev server. The chat route (`/api/chat`) uses `resolveChatProvider()` (`src/lib/chat-provider.ts`): `CHAT_*` first, then legacy `OPENAI_*` / `AP`. Without a configured backend, Genghis AI answers in **демо горим**.

`/api/image` stays separate from chat cutover and is controlled by `IMAGE_PROVIDER` (default `auto` when unset):


- **Primary — xAI Imagine:** chat key `OPENAI_API_KEY` / `AP` (`xai-…`) on `https://api.x.ai/v1` with `grok-imagine-image` ($0.02; retired `grok-2-image*` skipped). This is the default when `IMAGE_PROVIDER` is unset.
- **Opt-in — OpenAI GPT Image:** set `IMAGE_PROVIDER=openai`, or leave `auto` and set `OPENAI_IMAGE_API_KEY` (models `OPENAI_IMAGE_MODEL` → `gpt-image-2.5-flare` → `gpt-image-2` → `gpt-image-1.5` → `gpt-image-1-mini`; retired `dall-e-3` / `gpt-image-1` skipped). Defaults `OPENAI_IMAGE_QUALITY=low`, `OPENAI_IMAGE_SIZE=1024x1024`. A real OpenAI `OPENAI_API_KEY` (`sk-…`, not `xai-`) may also opt in; the xAI key mapped into `OPENAI_API_KEY` / `AP` is never treated as OpenAI.
- `IMAGE_PROVIDER=openai` / `xai` forces a single provider.
- Each successful generation logs `provider`, `model`, and estimated `$` cost (`[genghis-image-usage]`). Paid **10 images/month** quota is enforced by plan limits (#44).

## Plan limits (launch)

| Tier | Price | Chat | Images |
| --- | --- | --- | --- |
| Free | 0 | 30 msgs/mo on `grok-4.3` | none |
| Pro | $20 (~72,000₮)/mo | 500 msgs/mo on `grok-4.7` (`reasoning_effort=low`) | 10/mo |

Cost controls on `/api/chat`: history trim (`CHAT_HISTORY_LIMIT`), `max_tokens`, attach text cap (`ATTACH_TEXT_LIMIT`), xAI `x-grok-conv-id` / `prompt_cache_key`, and token usage logged for `/admin` estimates.

## QPay checkout

Pricing + checkout: `/pricing`. Invoice create → callback → `POST /v2/payment/check` verify → mark Pro for 30 days (`paid_until`). Without `QPAY_CLIENT_ID` / `QPAY_CLIENT_SECRET` / `QPAY_INVOICE_CODE` the flow stays **mock** (no live charges). Domestic QPay merchant fee is typically **~1%** (confirm in contract).

## Legal (drafts)

Mongolian-first drafts for owner review: [`/privacy`](./src/app/privacy/page.tsx) (Нууцлалын бодлого), [`/terms`](./src/app/terms/page.tsx) (Үйлчилгээний нөхцөл, including short refund/cancellation). Company reg/address are labelled `[PLACEHOLDER · …]`. Linked from landing, pricing, and signup.

Launch merge order + owner-only env/OAuth/QPay/xAI steps: [`docs/LAUNCH_CHECKLIST.md`](./docs/LAUNCH_CHECKLIST.md) (see also [`docs/MERGE_ORDER.md`](./docs/MERGE_ORDER.md)). Leave #39/#40 untouched.

```bash
npm run test:legal
```

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

- Shipping real QPay merchant secrets in git (owner sets Vercel env after contract)
- Full profile settings, teams
- Marketing-only landing page

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

