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

# optional: separate OpenAI key for image generation while chat stays on xAI
# OPENAI_IMAGE_API_KEY=sk-...
# OPENAI_IMAGE_MODEL=dall-e-3
```

Restart the dev server. The chat route (`/api/chat`) streams from the OpenAI-compatible endpoint when `OPENAI_API_KEY` (or `AP`) is set; without it, Genghis AI answers in **демо горим** with streamed mock replies.

`/api/image` uses `OPENAI_IMAGE_API_KEY` when set (always `https://api.openai.com/v1`, models `OPENAI_IMAGE_MODEL` → `dall-e-3` → `gpt-image-1`). Otherwise it falls back to the shared chat key / xAI image models.

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

