# Launch readiness (owner-only)

Agents do **not** merge, deploy, or spend. Short checklist of what **you** must do before public launch after [#61](https://github.com/amarbayarariun-collab/genghis-ai/pull/61) preview QA.

**Leave untouched:** [#39](https://github.com/amarbayarariun-collab/genghis-ai/pull/39), [#40](https://github.com/amarbayarariun-collab/genghis-ai/pull/40).

Detail: [LAUNCH_CHECKLIST.md](./LAUNCH_CHECKLIST.md) · [MERGE_ORDER.md](./MERGE_ORDER.md). Mock E2E: [#66](https://github.com/amarbayarariun-collab/genghis-ai/pull/66).

---

## 1) Env vars and API keys (owner)

Set these on the Vercel project (Production; Preview only if you want live keys there):

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes (prod) | Neon/Postgres users + usage |
| `AUTH_SECRET` | Yes (prod) | Session JWT signing |
| `AUTH_URL` | Yes (OAuth / absolute URLs) | Canonical site URL (`https://YOUR_DOMAIN`) |
| `ADMIN_SECRET` | Yes if using `/admin` | Admin gate |
| `OPENAI_API_KEY` or `AP` | Yes for live chat + default image | xAI key (`xai-…`) → `https://api.x.ai/v1` |
| `OPENAI_IMAGE_API_KEY` | Optional | OpenAI GPT Image **opt-in** fallback only |
| `IMAGE_PROVIDER` | Optional | unset/`auto` = **xAI Imagine `grok-imagine-image` primary**; `openai` / `xai` to force |
| `CHAT_*` | Optional | Provider overrides / self-host |
| `CHAT_HISTORY_LIMIT` / `CHAT_MAX_TOKENS` / `ATTACH_TEXT_LIMIT` | Optional | Cost controls |

Plans: Free = `grok-4.3`, 30 msgs/mo, **no images**. Pro = `grok-4.7` + `reasoning_effort=low`, 500 msgs + 10 images/mo, 72,000₮.

Without chat keys the app stays in **mock** mode (`X-Genghis-Mode: mock`). Fine for agent QA; not for prod.

Tagline: «Монголоос дэлхийтэй холбогд». Do not use «Монголын анхны ChatGPT» or em dashes in user-facing copy.

---

## 2) QPay merchant setup (owner)

Unset `QPAY_*` → **mock checkout only** («Mock төлбөр дуусгах (мөнгө авахгүй)»). No live charges.

For real payments:

1. Sign merchant contract; confirm ~1% domestic fee  
2. Set `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE`  
3. Sandbox first (`QPAY_SANDBOX=1` / sandbox base URL)  
4. `QPAY_CALLBACK_URL=https://YOUR_DOMAIN/api/billing/qpay/callback`  
5. Optional `QPAY_AMOUNT_MNT` (default `72000`)  
6. Smoke invoice → pay → confirm Pro in `/admin`, then switch to production base URL  

Agents must not configure live merchant credentials or run live charges.

---

## 3) Google OAuth setup (owner, optional)

1. Create a Google Cloud OAuth client  
2. Authorized redirect: `https://YOUR_DOMAIN/api/auth/google/callback`  
3. Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and matching `AUTH_URL`  

Email/password signup works without Google.

---

## 4) Merge sequence (owner; no agent merge)

Linear stack tip = **#60**, then **#42** (image) per checklist option 2:

`#38 → #41 → #44 → #45 → #46 → #47 → #48 → #49 → #54 → #56 → #58 → #60 → #42`

[#61](https://github.com/amarbayarariun-collab/genghis-ai/pull/61) is a **draft integration preview**. Prefer merging the stacked PRs in order, then #42. Do **not** merge #61 as a squash of the stack unless you intentionally want that path.

Excluded: game / overnight PRs; #39 / #40.

Smoke CI [#66](https://github.com/amarbayarariun-collab/genghis-ai/pull/66) can merge with or after the stack (mock-only; no spend).

---

## 5) Production deploy step (owner only)

1. Merge stacked PRs in the order above (or accept #61 contents consciously). **Agents do not merge.**  
2. Set Production env vars from §1–§3 on Vercel.  
3. Disable or scope **Vercel Deployment Protection** so the public app (and trusted preview QA) is reachable without SSO. Preview SSO currently blocks unattended browser E2E on the #61 Vercel URL.  
4. Deploy Production. Verify live: signup/login → MN chat → Free 30-msg limit + upgrade dialog → `/pricing` (sandbox QPay) → image via xAI Imagine → mobile ~360px → `/privacy` `/terms`.  
5. Replace legal `[PLACEHOLDER · …]` company fields before calling drafts final.  
6. Optional: enable Vercel Web Analytics (`@vercel/analytics` already wired).  

---

## Cheap verify (no spend; agents / CI)

```bash
npm test          # image config (xAI Imagine primary) + legal + translit + actions + starters
npm run build
npm run test:e2e  # Playwright on #66 tip: mocked xAI/QPay, desktop + 360px
```
