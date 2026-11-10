# Data licence ledger (Phase 1)

Record every corpus shard before training. **Re-verify licences yourself**; this is a planning ledger, not legal advice.

| Shard id | Source | URL / dump date | Licence | Used for | Notes |
| --- | --- | --- | --- | --- | --- |
| `fixture-mn-sample` | In-repo fixture | `ml/data/fixtures/mn_sample.txt` | Written for Genghis AI / CC0-equivalent project sample | pipeline dry-run | Not enough for real training |
| `fixture-sft-pairs` | In-repo fixture | `ml/data/fixtures/sft_pairs.jsonl` | Project-owned gold style examples | SFT dry-run | Expand with human review |
| `wikipedia-mn` *(when downloaded)* | Wikimedia dumps | https://dumps.wikimedia.org/mnwiki/ | CC BY-SA 4.0 (+ check dump notice) | CPT / domain text | Share-alike if redistributing wiki-derived text |
| `leipzig-mn` *(optional)* | Leipzig Corpora Collection | https://wortschatz.uni-leipzig.de/en/download | Check Leipzig terms | language filter / short sentences | Citation required |
| `oscar-mn` *(optional)* | OSCAR / HF | https://huggingface.co/datasets/oscar-corpus/OSCAR-2301 | Check OSCAR terms | web text | Noisy; heavy dedupe |
| `flores-mn` *(eval / bitext only)* | FLORES-200 | https://github.com/facebookresearch/flores | Meta research licence | eval / translation probes | Confirm commercial terms |

When you download a shard, append a dated row with the exact file hash and whether it was used in a named training run.
