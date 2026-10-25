# Genghis AI

Монголын анхны ChatGPT шиг AI чат туслах — **Genghis AI** MVP.

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
OPENAI_API_KEY=sk-...
# optional overrides
# OPENAI_BASE_URL=https://api.openai.com/v1
# OPENAI_MODEL=gpt-4o-mini
```

Restart the dev server. The chat route (`/api/chat`) streams from the OpenAI-compatible endpoint when `OPENAI_API_KEY` is set; without it, Genghis AI answers in **демо горим** with streamed mock replies.

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
