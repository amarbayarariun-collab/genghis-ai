# Genghis AI — Phase 1 Mongolian fine-tune toolkit

Scripts to prepare Mongolian Cyrillic data, run LoRA/QLoRA SFT on an open-weight instruct model, and score a small Mongolian eval set.

**Do not run paid GPU training from CI or a cloud agent.** Use a rented box (RunPod, Vast.ai, etc.) when the owner approves a budget. See [`docs/ROADMAP-mongolian-llm.md`](../docs/ROADMAP-mongolian-llm.md) for cost bands.

## Layout

```text
ml/
  README.md                 # this file
  requirements.txt          # Python deps for train/eval (install on the GPU box)
  data/
    LICENCES.md             # licence ledger for every shard you download
    fixtures/               # tiny sample MN text + SFT pairs (safe to commit)
    prepare_corpus.py       # download/clean/pack public MN text
    build_sft_jsonl.py      # turn cleaned text + pairs into chat JSONL
  train/
    train_qlora.py          # LoRA / QLoRA SFT (Hugging Face + PEFT + bitsandbytes)
    config.example.yaml     # starter hyperparams
  eval/
    sets/mn_v0.jsonl        # hand-curated Mongolian eval items
    LICENCE.md              # notes for the eval set
    run_eval.py             # score a local OpenAI-compatible endpoint or HF model
```

## Quick path (rented GPU later)

1. Rent a **24 GB+** NVIDIA GPU (QLoRA 7B–8B) or **40 GB+** for 14B.
2. Clone this repo; `cd ml && python -m venv .venv && source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. Dry-run on fixtures (no download):

   ```bash
   python data/prepare_corpus.py --fixture-only --out data/work/cleaned.jsonl
   python data/build_sft_jsonl.py --cleaned data/work/cleaned.jsonl --pairs data/fixtures/sft_pairs.jsonl --out data/work/sft.jsonl
   ```

5. Optional full public downloads (Wikipedia dump URL, etc.):

   ```bash
   python data/prepare_corpus.py --sources wikipedia,fixture --out data/work/cleaned.jsonl
   # Update data/LICENCES.md with the exact dump date/URL you used.
   ```

6. Train (example Qwen2.5-7B-Instruct QLoRA):

   ```bash
   python train/train_qlora.py \
     --config train/config.example.yaml \
     --data data/work/sft.jsonl \
     --output-dir outputs/genghis-mn-qlora
   ```

7. Serve with vLLM / Ollama / text-generation-inference (OpenAI-compatible), then point the app at it via `CHAT_BASE_URL` / `CHAT_MODEL` (product PR).

8. Eval:

   ```bash
   python eval/run_eval.py --set eval/sets/mn_v0.jsonl --base-url http://127.0.0.1:8000/v1 --model your-served-name
   ```

## Design choices

- **Python** stays under `ml/`; the Next.js app stays TypeScript.
- Training uses standard HF `transformers` + `peft` + `trl` SFT so it is easy to resume later.
- Fixtures are tiny on purpose: prove the pipeline without shipping large corpora.
- Always record licences in `data/LICENCES.md` before any commercial use.

## What this does *not* do

- No automatic cloud billing or marketplace signup.
- No merge of adapters into production without a human eval gate.
- No payment or auth changes in the web app.
