#!/usr/bin/env python3
"""LoRA / QLoRA SFT for Genghis AI Phase 1 (Mongolian Cyrillic).

Run on a rented GPU after installing ml/requirements.txt. This script does not
start training unless you invoke it with data + config on a machine that has
torch/transformers/peft/trl installed.

Example:
  python train/train_qlora.py \\
    --config train/config.example.yaml \\
    --data data/work/sft.jsonl \\
    --output-dir outputs/genghis-mn-qlora \\
    --max-steps 20

Use --max-steps for a cheap smoke test; omit for full epochs from the YAML.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def load_yaml(path: Path) -> dict:
    try:
        import yaml
    except ImportError as exc:
        raise SystemExit(
            "PyYAML missing. On the GPU box: pip install -r requirements.txt"
        ) from exc
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def read_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--data", type=Path, required=True, help="SFT JSONL with messages[]")
    parser.add_argument("--output-dir", type=Path, default=None)
    parser.add_argument(
        "--max-steps",
        type=int,
        default=None,
        help="Optional cap for smoke tests (overrides epochs)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate config + data only; do not import torch or train",
    )
    args = parser.parse_args()

    cfg = load_yaml(args.config)
    rows = read_jsonl(args.data)
    if not rows:
        print("No training rows found.", file=sys.stderr)
        return 2
    for i, row in enumerate(rows[:3]):
        if "messages" not in row:
            print(f"Row {i} missing messages[]", file=sys.stderr)
            return 2

    out_dir = Path(args.output_dir or cfg.get("output_dir") or "outputs/genghis-mn-qlora")
    print(f"Config model: {cfg.get('model_name_or_path')}")
    print(f"Examples: {len(rows)}")
    print(f"Output: {out_dir}")

    if args.dry_run:
        print("Dry run OK. Skipping training.")
        return 0

    try:
        import torch
        from datasets import Dataset
        from peft import LoraConfig
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
        from trl import SFTConfig, SFTTrainer
    except ImportError as exc:
        print(
            "Training deps missing. On a rented GPU box run:\n"
            "  pip install -r requirements.txt\n"
            f"Import error: {exc}",
            file=sys.stderr,
        )
        return 3

    if not torch.cuda.is_available():
        print(
            "CUDA GPU not available. QLoRA expects an NVIDIA GPU. "
            "Use --dry-run to validate data on CPU.",
            file=sys.stderr,
        )
        return 4

    model_id = cfg["model_name_or_path"]
    compute_dtype = getattr(torch, cfg.get("bnb_4bit_compute_dtype", "bfloat16"))

    quant = None
    if cfg.get("load_in_4bit", True):
        quant = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_compute_dtype=compute_dtype,
            bnb_4bit_quant_type=cfg.get("bnb_4bit_quant_type", "nf4"),
            bnb_4bit_use_double_quant=True,
        )

    tokenizer = AutoTokenizer.from_pretrained(model_id, use_fast=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=quant,
        device_map="auto",
        torch_dtype=compute_dtype,
    )
    if cfg.get("gradient_checkpointing", True):
        model.gradient_checkpointing_enable()
        model.enable_input_require_grads()

    peft_config = LoraConfig(
        r=int(cfg.get("lora_r", 32)),
        lora_alpha=int(cfg.get("lora_alpha", 16)),
        lora_dropout=float(cfg.get("lora_dropout", 0.05)),
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=cfg.get("target_modules"),
    )

    def to_text(example: dict) -> dict:
        messages = example["messages"]
        if hasattr(tokenizer, "apply_chat_template"):
            text = tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=False
            )
        else:
            parts = []
            for m in messages:
                parts.append(f"{m['role'].upper()}: {m['content']}")
            text = "\n".join(parts)
        return {"text": text}

    dataset = Dataset.from_list(rows).map(to_text)

    sft_kwargs = dict(
        output_dir=str(out_dir),
        num_train_epochs=float(cfg.get("num_train_epochs", 2)),
        per_device_train_batch_size=int(cfg.get("per_device_train_batch_size", 1)),
        gradient_accumulation_steps=int(cfg.get("gradient_accumulation_steps", 8)),
        learning_rate=float(cfg.get("learning_rate", 1.5e-4)),
        warmup_ratio=float(cfg.get("warmup_ratio", 0.03)),
        logging_steps=int(cfg.get("logging_steps", 10)),
        save_steps=int(cfg.get("save_steps", 100)),
        lr_scheduler_type=cfg.get("lr_scheduler_type", "cosine"),
        optim=cfg.get("optim", "paged_adamw_8bit"),
        bf16=bool(cfg.get("bf16", True)),
        report_to=cfg.get("report_to", "none"),
        seed=int(cfg.get("seed", 42)),
        max_seq_length=int(cfg.get("max_seq_length", 2048)),
        packing=False,
    )
    if args.max_steps is not None:
        sft_kwargs["max_steps"] = args.max_steps

    training_args = SFTConfig(**sft_kwargs)

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        peft_config=peft_config,
        processing_class=tokenizer,
        dataset_text_field="text",
    )

    trainer.train()
    trainer.save_model(str(out_dir))
    tokenizer.save_pretrained(str(out_dir))
    print(f"Saved adapter / tokenizer to {out_dir}")
    print("Next: serve with vLLM/Ollama and point CHAT_BASE_URL at it.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
