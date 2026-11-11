# Launch readiness (owner-only)

Agents do **not** merge, deploy, or spend. This is the short owner checklist for public launch after [#61](https://github.com/amarbayarariun-collab/genghis-ai/pull/61) preview QA.

**Leave untouched:** [#39](https://github.com/amarbayarariun-collab/genghis-ai/pull/39), [#40](https://github.com/amarbayarariun-collab/genghis-ai/pull/40).

Canonical detail: [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) · [MERGE_ORDER.md](./MERGE_ORDER.md).

---

## 1) Merge sequence (no agent merge)

Linear stack tip = **#60**, then **#42** (image) per checklist option 2:

`#38 → #41 → #44 → #45 → #46 → #47 → #48 → #49 → #54 → #56 → #58 → #60 → #42`

Integration preview: **#61** (draft, DO NOT MERGE as a squash of the stack unless you intend that path). Prefer merging the stacked PRs in order, then #42, rather than merging #61 itself.

Excluded: game / overnight PRs; #39 / #40.

---

## 2) Vercel env / API keys (owner)

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes (prod) | Neon/Postgres users + usage |
| `AUTH_SECRET` | Yes (prod) | Session JWT signing |
| `AUTH_URL` | Yes (OAuth / absolute URLs) | Canonical site URL |
| `ADMIN_SECRET` | Yes if using `/admin` | Admin gate |
| `OPENAI_API_KEY` or `AP` | Yes for live chat + default image | xAI key (`xai-…`) → `https://api.x.ai/v1` |
| `OPENAI_IMAGE_API_KEY` | Optional | OpenAI GPT Image **opt-in** fallback only |
| `IMAGE_PROVIDER` | Optional | unset/`auto` = **xAI Imagine `grok-imagine-image` primary**; `openai` / `xai` to force |
| `CHAT_*` | Optional | Provider overrides / self-host |
| `CHAT_HISTORY_LIMIT` / `CHAT_MAX_TOKENS` / `ATTACH_TEXT_LIMIT` | Optional | Cost controls |

Free plan: `grok-4.3`, 30 msgs/mo, **no images**. Pro: `grok-4.7` + `reasoning_effort=low`, 500 msgs + 10 images/mo.

Without chat keys the app stays in **mock** mode (`X-Genghis-Mode: mock`) — fine for preview QA, not for prod.

---

## 3) QPay merchant (owner)

Unset `QPAY_*` → **mock checkout only** (button: «Mock төлбөр дуусгах (мөнгө авахгүй)»). No live charges.

For real payments:

1. Merchant contract; confirm ~1% domestic fee  
2. Set `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE`  
3. Sandbox first (`QPAY_SANDBOX=1` / sandbox base URL)  
4. `QPAY_CALLBACK_URL=https://YOUR_DOMAIN/api/billing/qpay/callback`  
5. Optional `QPAY_AMOUNT_MNT` (default 72000)  
6. Smoke invoice → pay → Pro in `/admin`, then production base URL  

Agents must not configure live merchant credentials or run live charges.

---

## 4) Google OAuth (optional, owner)

1. Google Cloud OAuth client  
2. Redirect: `https://YOUR_DOMAIN/api/auth/google/callback`  
3. Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_URL`  

Email/password signup works without Google.

---

## 5) Prod deploy (owner only)

1. Merge stacked PRs in order (or accept #61 contents consciously) — **agents do not merge**  
2. Set production env vars above on Vercel  
3. Disable or scope **Vercel Deployment Protection** so the public app (and trusted preview QA) is reachable without SSO  
4. Deploy production; verify: landing → signup → live MN chat → Free limit UI → `/pricing` (sandbox QPay) → image with xAI Imagine → `/privacy` `/terms`  
5. Replace legal `[PLACEHOLDER · …]` company fields before calling drafts final  
6. Optional: enable Vercel Web Analytics (`@vercel/analytics` already wired)  

---

## 6) Cheap verify (no spend)

```bash
npm test          # image config (xAI Imagine primary) + legal + translit + actions + starters
npm run build
npm run test:e2e  # Playwright smoke with mocked xAI/QPay (desktop + 360px)
```
