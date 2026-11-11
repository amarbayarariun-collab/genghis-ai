# Launch checklist + merge order

Owner-review only. Agents do **not** merge, deploy, or spend.

**Deferred (leave untouched):** [#39](https://github.com/amarbayarariun-collab/genghis-ai/pull/39), [#40](https://github.com/amarbayarariun-collab/genghis-ai/pull/40).

Legal drafts on this tip: `/privacy` (Нууцлалын бодлого), `/terms` (Үйлчилгээний нөхцөл) — placeholders for company reg/address.

---

## Recommended merge order

Linear launch stack (base → tip):

| Step | PR | Branch | Bases on | Notes |
| --- | --- | --- | --- | --- |
| 1 | [#38](https://github.com/amarbayarariun-collab/genghis-ai/pull/38) | `cursor/signup-usage-tracking-0147` | `main` | Signup + usage + `/admin` |
| 2 | [#41](https://github.com/amarbayarariun-collab/genghis-ai/pull/41) | `cursor/mn-chat-provider-df07` | #38 | MN prompts + chat provider |
| 3 | [#44](https://github.com/amarbayarariun-collab/genghis-ai/pull/44) | `cursor/plan-limits-33e9` | #41 | Free/Pro limits + cost controls |
| 4 | [#45](https://github.com/amarbayarariun-collab/genghis-ai/pull/45) | `cursor/qpay-checkout-33e9` | #44 | QPay /pricing (mock-safe) |
| 5 | [#46](https://github.com/amarbayarariun-collab/genghis-ai/pull/46) | `cursor/mn-landing-pricing-1b5e` | #45 | MN landing/pricing copy |
| 6 | [#47](https://github.com/amarbayarariun-collab/genghis-ai/pull/47) | `cursor/mn-error-messages-1b5e` | #46 | MN user-facing errors |
| 7 | [#48](https://github.com/amarbayarariun-collab/genghis-ai/pull/48) | `cursor/limit-upgrade-flow-1b5e` | #47 | Limit → Pro dialog |
| 8 | [#49](https://github.com/amarbayarariun-collab/genghis-ai/pull/49) | `cursor/mobile-chat-ux-150b` | #48 | Mobile chat UX |
| 9 | This PR (legal + checklist) | `cursor/legal-launch-checklist-55ca` | #49 | `/privacy`, `/terms`, this doc |

### Where #42 fits (known conflicts)

[#42](https://github.com/amarbayarariun-collab/genghis-ai/pull/42) (`cursor/fix-image-models-3d50`) is **based on `main`**, not the launch stack. A merge-tree of **#42 tip vs #49 tip** conflicts in:

- `src/app/api/image/route.ts`
- `src/lib/api-config.ts`
- `.env.example`
- `README.md`

**Cleaner options (pick one):**

1. **Preferred for image fix first:** merge #42 → `main`, then rebase/restack #38…#49 (+ legal) onto updated `main` (resolve once at the stack base that touches image).
2. **Preferred for launch path first:** merge #38→#49 (+ legal) → `main`, then rebase #42 onto `main` and resolve the four files above (keep GPT Image primary + xAI fallback from #42; keep plan quotas / tracking from the stack).

Do **not** merge #42 into the middle of the stack without a rebase plan — overlapping image route will conflict.

---

## Known non-blockers

- `main` / stack lint baseline: 4× `react-hooks/set-state-in-effect` in wallpaper/theme/sidebar hooks (pre-existing).
- QPay stays **mock** until owner sets merchant env (no live charges from agents).
- #39 / #40 stay open deferred (no GPU / own-model spend now).

---

## Owner-only steps (once)

Do these after merges you accept; agents do not set production secrets or deploy.

### 1) Vercel project env

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon/Postgres for users + usage |
| `AUTH_SECRET` | Session signing |
| `AUTH_URL` | Canonical site URL (OAuth callbacks) |
| `ADMIN_SECRET` | `/admin` gate |
| `OPENAI_API_KEY` or `AP` | xAI chat key (`xai-…` → `https://api.x.ai/v1`) |
| `OPENAI_IMAGE_API_KEY` | OpenAI Images (after #42) |
| Optional | `CHAT_*`, `CHAT_HISTORY_LIMIT`, `CHAT_MAX_TOKENS`, `ATTACH_TEXT_LIMIT`, `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`, `IMAGE_PROVIDER` |

Enable Vercel Web Analytics on the project if desired (`@vercel/analytics` already wired).

### 2) OAuth (optional Google)

1. Google Cloud OAuth client
2. Redirect: `https://YOUR_DOMAIN/api/auth/google/callback`
3. Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (+ `AUTH_URL`)

### 3) QPay contract

1. Merchant contract; confirm ~1% domestic fee
2. Receive `client_id` / `client_secret` / `invoice_code`
3. Sandbox first: `QPAY_BASE_URL` sandbox or `QPAY_SANDBOX=1`
4. Callback: `https://YOUR_DOMAIN/api/billing/qpay/callback`
5. Set `QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, `QPAY_INVOICE_CODE`, optional `QPAY_AMOUNT_MNT`, `QPAY_CALLBACK_URL`
6. Smoke: invoice → pay → Pro in `/admin` → then production base URL

### 4) xAI key

1. Create xAI API key
2. Map to `OPENAI_API_KEY` or `AP` (Febbas secret name `AP` if used)
3. Confirm Free uses `grok-4.3`, Pro `grok-4.7` (plan defaults in `src/lib/plans.ts`)

### 5) Legal placeholders

Replace `[PLACEHOLDER · …]` on `/privacy` and `/terms` (company name, reg/РД, address, support/privacy email) before calling the drafts final.

---

## Cheap verify

```bash
node scripts/verify-legal-launch.mjs
npm run build
```
