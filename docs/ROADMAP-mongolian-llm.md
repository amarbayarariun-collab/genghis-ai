# Roadmap: Independent Mongolian LLM for Genghis AI

**Product:** Genghis AI  
**Tagline:** Монголоос дэлхийтэй холбогд  
**Goal:** Move from third-party chat APIs (xAI / OpenAI-compatible) to a Mongolian-strong model we fine-tune, then eventually train and host ourselves.

This document is a realistic, costed path. Numbers are **ballpark USD** for planning. Do not treat them as quotes. Rental GPU marketplaces (RunPod, Vast.ai, Lambda, etc.) change prices often; re-check before renting. **Do not sign up or spend from this doc alone.** Owner decides budget and vendors.

---

## North star

| Horizon | Outcome |
| --- | --- |
| Now | Chat app on xAI/OpenAI APIs; Mongolian-first UX |
| Phase 1 | Strong Mongolian Cyrillic chat via LoRA/QLoRA on an open-weight base |
| Phase 2 | Continued pretraining on a larger Mongolian (+ bilingual) corpus |
| Phase 3 | Own base / heavily customized model + self-hosted inference |

Success for Genghis AI is **usable Mongolian assistant quality + controllable cost**, not claiming to be “the first ChatGPT of Mongolia” in product copy.

---

## Phase 1 — Fine-tune open-weight base (LoRA / QLoRA)

### What

Take a strong open-weight instruct model (Qwen2.5 / Llama 3.x / Gemma 2 class, 7B–14B first) and adapt it to **Mongolian Cyrillic** with parameter-efficient fine-tuning (LoRA or QLoRA).

### Why this first

- Lowest capital risk; validates data quality and eval before buying more GPU hours.
- Fits rented single-GPU boxes (24–48 GB VRAM for 7B–14B QLoRA).
- Output is an OpenAI-compatible chat checkpoint you can serve with vLLM / Ollama / TGI and point the app at via `CHAT_*` env vars (see [App cutover](#app-cutover-third-party-api--self-hosted)).

### Candidate bases (pick one to start)

| Family | Example sizes | Notes |
| --- | --- | --- |
| Qwen2.5 / Qwen3 | 7B, 14B | Strong multilingual; good default for MN+EN |
| Llama 3.1 / 3.2 | 8B, 11B vision variants | Wide tooling; check licence for commercial use |
| Gemma 2 | 9B, 27B | Solid quality; 27B needs more VRAM |

Start with **one** 7B–14B instruct checkpoint. Scale size only after eval plateaus.

### Data for Phase 1

- Public Mongolian Cyrillic text (news, wiki, books with clear licences).
- Instruction / chat pairs: translate + rewrite high-quality EN instruct data into MN; hand-curate a small gold set; optional synthetic pairs **reviewed by a Mongolian speaker**.
- Deduplicate, language-ID filter (keep Cyrillic MN), strip boilerplate, PII heuristics.

In-repo scripts live under `ml/` (Phase 1 PR). Prefer a **fixture sample** locally; full downloads on a GPU box later.

### Training sketch

- Method: QLoRA 4-bit + LoRA adapters (r=16–64), SFT then optional preference (DPO/ORPO) on a tiny ranked set.
- Seq length: 2k–4k to start.
- Do **not** run paid training from CI or cloud agents; owner rents GPU when ready.

### Phase 1 cost ballpark (USD)

| Item | Low | Mid | High | Notes |
| --- | --- | --- | --- | --- |
| Data prep (CPU / small GPU) | $20 | $50 | $150 | Cleaning + packing; often DIY on a laptop |
| QLoRA SFT 7B–8B, 1–3 epochs | $30 | $80 | $200 | ~10–40 GPU-hours on 24GB class |
| QLoRA SFT 14B | $80 | $200 | $450 | 40GB+ card preferred |
| Eval + iteration (2–3 rounds) | $40 | $120 | $300 | Same rental box |
| **Phase 1 total (typical)** | **~$100** | **~$250–400** | **~$900** | Excludes human labeling time |

**Rental options (research only, no signup required here):** RunPod, Vast.ai, Lambda Cloud, Paperspace, local university / coworking GPUs. Prefer spot/interruptible for SFT; keep checkpoints on object storage you control.

### Phase 1 exit criteria

- Beats base model on the Mongolian eval set (see [Evaluation](#evaluation-plan)).
- Greeting / brand rules respected (no forbidden “анхны ChatGPT” claims; no em dashes in assistant style).
- Serves via OpenAI-compatible `/v1/chat/completions` and works with the app abstraction.

---

## Phase 2 — Continued pretraining on larger Mongolian corpus

### What

Further train the **base** (or a continued-pretrained intermediate) on a much larger raw Mongolian (+ MN↔EN parallel) corpus **before** or in addition to instruct SFT. Goal: better fluency, rarer words, local entities (places, agencies, products).

### Data scale targets (order of magnitude)

| Stage | Tokens (ballpark) | Comment |
| --- | --- | --- |
| Phase 1 SFT | 10M–100M tokens equivalent (much less unique text) | Instruction mix |
| Phase 2 CPT | 1B–10B+ Mongolian-dominant tokens | Quality > raw crawl size |
| Stretch | 20B+ | Only if licences and dedupe hold |

### Cost ballpark (USD)

| Item | Mid estimate | High | Notes |
| --- | --- | --- | --- |
| Corpus crawl/clean (eng + storage) | $200–800 | $2k+ | Storage + one-off engineering |
| CPT 7B on 1–3B tokens | $1.5k–4k | $8k+ | Multi-GPU or long single-GPU runs |
| CPT 14B | $4k–12k | $25k+ | Needs A100/H100 class hours |
| Re-SFT + align after CPT | $200–600 | $1.5k | Reuse Phase 1 recipe |
| **Phase 2 total** | **~$2k–8k** | **$15k–30k+** | Dominated by GPU hours |

Phase 2 should wait until Phase 1 eval and product usage show clear Mongolian gaps that SFT alone cannot fix.

### Phase 2 exit criteria

- Measurable gains on fluency / knowledge probes vs Phase 1 adapter-only.
- Stable training loss; no severe English regression (keep bilingual mix).
- Documented licence ledger for every major corpus shard.

---

## Phase 3 — Own model

### What “own” can mean (choose deliberately)

1. **Deep customization:** large CPT + multi-stage alignment on a public architecture; we own weights we trained, not the original pretraining.
2. **From-scratch / heavily original:** new tokenizer, architecture tweaks, full pretraining on a curated mix. Highest cost and research risk.
3. **Distillation stack:** teacher (API or large open model) → smaller MN-specialist student for cheap inference.

For a small team, **(1) then optionally (3)** is the realistic path before true from-scratch.

### Cost ballpark (USD)

| Path | Mid | High | Notes |
| --- | --- | --- | --- |
| Deep CPT + align on 7B–14B | $10k–40k | $100k+ | Serious multi-week GPU campaign |
| From-scratch 1B–3B | $50k–200k | $500k+ | Usually not justified early |
| Always-on inference (prod) | $50–300 / mo | $1k+ / mo | 1×24GB for 7B; scale with users |

Phase 3 also needs MLOps: checkpointing, eval gates, rollback, abuse filters, and a clear commercial licence story.

---

## Candidate public Mongolian datasets and licences

**Always re-read the licence before training or redistribution.** This table is a starting ledger, not legal advice. Prefer sources with explicit open licences; avoid scraping personal social media.

| Source | Type | Licence (verify) | Use notes |
| --- | --- | --- | --- |
| [Wikipedia Mongolian](https://dumps.wikimedia.org/) dumps | Encyclopedic Cyrillic | CC BY-SA 4.0 (+ GFDL historically for some) | Great quality; share-alike if you distribute derivatives that include wiki text |
| [Wikimedia / WikiSource](https://dumps.wikimedia.org/) MN | Books / docs | Often CC BY-SA | Check per-page licences |
| [OSCAR](https://huggingface.co/datasets/oscar-corpus/OSCAR-2301) / similar Common Crawl derivatives | Web crawl shards | Check OSCAR / CC-NET terms | Filter `mn`; high noise; dedupe aggressively |
| [CC-100](https://data.statmt.org/cc-100/) Mongolian | Web | See StatMT / CC notes | Classic multilingual crawl |
| [Leipzig Corpora](https://wortschatz.uni-leipzig.de/en/download) Mongolian | News / web sentences | Research / citation terms | Good for language ID and short sentences |
| [FLORES-200](https://github.com/facebookresearch/flores) | MN↔EN eval / bitext | Research licence (Meta) | Prefer for **eval / translation**, check commercial terms |
| [OpenSubtitles](https://opus.nlpl.eu/OpenSubtitles.php) (if MN present) | Parallel | Check OPUS / OpenSubtitles | Informal register |
| Mongolian government open data / laws portals | Formal text | Often public domain or open; **confirm per portal** | Excellent formal register; cite |
| Academic papers / theses with open deposit | Long-form | Author / uni licence | Manual curation |
| Hand-curated Genghis eval / gold SFT | Chat quality | **Owned by project** if written in-house | Keep under `ml/eval` / `ml/data` with licence notes |

**Avoid for training unless cleared:** copyrighted news full-text without licence, Facebook/Telegram dumps, personal chats, pirated ebooks.

In-repo: keep a `ml/data/LICENCES.md` ledger that lists every shard actually downloaded.

---

## Evaluation plan

### Mongolian benchmark set (v0)

Ship a **small, versioned** set under `ml/eval/` (hand-curated + carefully sourced items with licence notes):

| Slice | Examples | Scoring |
| --- | --- | --- |
| Greeting / brand | Мэндчилгээ, “чи хэн бэ?” | Exact / rubric: correct intro; forbid banned claims |
| Everyday MN | Хоол, аялал, банкны энгийн асуулт | Rubric 1–5 fluency + helpfulness |
| Formal MN | Албан бичиг, CV засах | Structure + tone |
| Knowledge (MN) | УБ, аймаг, баяр ёслол | Factual checks with references |
| Code-switch | MN question needing EN term | Stays MN-first unless asked |
| Safety / refusal | Хакерийн тусламж гэх мэт | Must refuse appropriately |
| No em dash | Style probe | Regex / judge: no `—` |

### Metrics

1. **Automatic:** exact match / contains for closed items; character error proxies optional; MN language-ID rate of outputs.
2. **LLM-as-judge (careful):** bilingual rubric only as a weak signal; humans win for MN nuance.
3. **Human panel:** 2–3 Mongolian speakers score blind A/B (base vs adapter) on 30–50 prompts.
4. **Regression:** English smoke set so MN fine-tune does not destroy EN.

### Cadence

- Every training run: full v0 suite + smoke.
- Before app cutover: human panel gate.
- After production switch: weekly sample of real (privacy-redacted) prompts.

---

## App cutover: third-party API → self-hosted

The chat UI should **not** hardcode xAI. Backend resolves provider from env:

| Variable | Role |
| --- | --- |
| `CHAT_PROVIDER` | `xai` \| `openai` \| `self` (or omit for auto) |
| `CHAT_BASE_URL` | OpenAI-compatible root, e.g. `https://api.x.ai/v1` or `http://vllm:8000/v1` |
| `CHAT_MODEL` | Model id served by that endpoint |
| `CHAT_API_KEY` | Bearer token (optional for local trusted networks) |
| Legacy | `OPENAI_API_KEY` / `AP`, `OPENAI_BASE_URL`, `OPENAI_MODEL` still work |

**Image generation stays separate** (`OPENAI_IMAGE_API_KEY`, etc.).

### Cutover steps (ops)

1. Train Phase 1 adapter; export / merge weights.
2. Serve with vLLM, Ollama, or llama.cpp OpenAI-compatible server.
3. Set `CHAT_PROVIDER=self`, `CHAT_BASE_URL`, `CHAT_MODEL` on Vercel / host.
4. Canary: internal users only; compare latency and MN quality.
5. Keep xAI credentials as instant rollback (flip env back).
6. Monitor cost: self-host GPU monthly vs API spend.

No UI rewrite required if the abstraction layer is in place.

---

## Simple monetisation plan (no payments code yet)

### Principles

- Free tier builds habit in Mongolia; paid removes limits and funds GPU.
- Pricing in **MNT**; local payment rails matter more than Stripe-first.
- Do **not** integrate payments until signup/usage tracking is stable (see separate signup PR). Avoid colliding with that work.

### Suggested tiers (starting point for owner decision)

| Tier | Price (MNT / month) | Limits (sketch) |
| --- | --- | --- |
| Free | 0₮ | N messages / day, slower model or shared queue, no image or low image cap |
| Plus | 29,000₮ | Higher message cap, priority, image gen included |
| Pro | 79,000₮ | Highest caps, longer context, early access to MN model |

Adjust after seeing real unit economics (API $ + future GPU $ + support).

### Local payments (later)

- **QPay** and other MN wallets / bank QR as primary checkout.
- Card gateways as secondary for diaspora.
- Invoicing for schools / SMEs (manual at first).

### Free → paid funnel

1. Generous free daily cap with clear upgrade CTA in Mongolian.
2. Soft paywall on image / deep research first (higher cost features).
3. Annual discount in MNT to improve cash flow for GPU reservations.

### What not to do yet

- No Stripe/QPay integration in the app until product + usage analytics exist.
- No crypto-only pricing.
- No enterprise SSO until there is demand.

---

## Recommended sequencing

```text
[Done / current]  Mongolian-first chat MVP on xAI API
       ↓
[Docs]            This roadmap + licence ledger habit
       ↓
[Phase 1 code]    ml/ data → train → eval scripts (no paid runs in CI)
       ↓
[Product]         CHAT_* abstraction + stronger MN system prompt
       ↓
[Owner]           Rent GPU, run Phase 1, human eval gate
       ↓
[Cutover]         Self-hosted OpenAI-compatible endpoint
       ↓
[Revenue]         Free + paid in MNT (QPay later) → fund Phase 2
       ↓
[Phase 2 / 3]     CPT then deeper own-model investment
```

---

## Owner checklist (later; no secrets in chat)

- [ ] Choose Phase 1 base model and confirm commercial licence.
- [ ] Set GPU budget band (suggest start **$200–400** for Phase 1 experiments).
- [ ] Decide human eval reviewers (Mongolian speakers).
- [ ] Add production env for chat abstraction when ready to canary self-host.
- [ ] Decide Free / Plus / Pro MNT prices before building checkout.
- [ ] Keep image key separate from chat provider during cutover.

---

## Related paths in this repo

- `ml/` — Phase 1 data, train, eval scripts and README  
- `src/lib/chat-provider.ts` (or equivalent) — runtime provider abstraction  
- Root `README.md` — how to run the app and where to find ML docs  
