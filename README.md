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
# optional chat overrides
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o-mini

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

Restart the dev server. The chat route (`/api/chat`) streams from the OpenAI-compatible endpoint when `OPENAI_API_KEY` (or `AP`) is set; without it, Genghis AI answers in **демо горим** with streamed mock replies.

`/api/image` is controlled by `IMAGE_PROVIDER` (default `auto` when unset):

- **Primary — xAI Imagine:** chat key `OPENAI_API_KEY` / `AP` (`xai-…`) on `https://api.x.ai/v1` with `grok-imagine-image` ($0.02; retired `grok-2-image*` skipped). This is the default when `IMAGE_PROVIDER` is unset.
- **Opt-in — OpenAI GPT Image:** set `IMAGE_PROVIDER=openai`, or leave `auto` and set `OPENAI_IMAGE_API_KEY` (models `OPENAI_IMAGE_MODEL` → `gpt-image-2.5-flare` → `gpt-image-2` → `gpt-image-1.5` → `gpt-image-1-mini`; retired `dall-e-3` / `gpt-image-1` skipped). Defaults `OPENAI_IMAGE_QUALITY=low`, `OPENAI_IMAGE_SIZE=1024x1024`. A real OpenAI `OPENAI_API_KEY` (`sk-…`, not `xai-`) may also opt in; the xAI key mapped into `OPENAI_API_KEY` / `AP` is never treated as OpenAI.
- `IMAGE_PROVIDER=openai` / `xai` forces a single provider.
- Each successful generation logs `provider`, `model`, and estimated `$` cost (`[genghis-image-usage]`). Paid **10 images/month** quota is owned by the plan-limits PR (#44); this PR does not change that contract.

Any OpenAI-compatible base URL works via `OPENAI_BASE_URL` (e.g. Azure OpenAI proxy, Groq, local gateways).

## What’s in this slice

- Full-screen chat UI (desktop + mobile)
- Sidebar conversation list (localStorage only)
- Empty / loading / error states
- Streaming assistant replies
- Mock fallback without secrets

## Out of scope (for now)

- Auth / accounts
- Database persistence
- File uploads, tools, voice
- Marketing-only landing page

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

