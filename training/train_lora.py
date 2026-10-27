#!/usr/bin/env python3
"""Train an approved private LoRA adapter on a CUDA machine; never auto-upload records."""
import argparse
import os
import json
from pathlib import Path
import sys


def checked_dataset(path):
    rows = []
    with path.open(encoding="utf-8") as stream:
        for line in stream:
            if not line.strip():
                continue
            data = json.loads(line)
            if set(data) != {"prompt", "completion"}:
                raise ValueError(f"Invalid JSONL columns in {path}")
            if not isinstance(data["prompt"], list) or not isinstance(data["completion"], list):
                raise ValueError("Expected conversational prompt and completion messages")
            if len(data["prompt"]) != 1 or len(data["completion"]) != 1:
                raise ValueError("Expected one user message and one assistant reply")
            if data["prompt"][0].get("role") != "user" or data["completion"][0].get("role") != "assistant":
                raise ValueError("Invalid chat roles")
            if not all(isinstance(item.get("content"), str) and item["content"].strip() for item in [*data["prompt"], *data["completion"]]):
                raise ValueError("Blank training content")
            rows.append(data)
    if not rows:
        raise ValueError(f"Empty dataset: {path}")
    return rows


def main():
    parser = argparse.ArgumentParser(description="Train LoRA/QLoRA using owner-approved Echo examples. Requires a compatible NVIDIA CUDA GPU.")
    parser.add_argument("--model", default="meta-llama/Llama-3.2-3B-Instruct", help="Hugging Face model ID; must be the EXACT model to which the adapter will later be applied")
    parser.add_argument("--train", type=Path, required=True)
    parser.add_argument("--eval", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("data/training/runs/lora-run"))
    parser.add_argument("--epochs", type=float, default=1)
    parser.add_argument("--max-length", type=int, default=768)
    parser.add_argument("--dry-run", action="store_true", help="Validate files without downloading weights or loading CUDA libraries")
    args = parser.parse_args()
    os.umask(0o077)
    args.output = args.output.resolve()
    private_training = (Path.cwd() / "data/training").resolve()
    if not args.output.is_relative_to(private_training):
        parser.error("Training output must be under data/training/ to avoid accidentally committing adapter files.")
    if args.epochs <= 0 or args.epochs > 5 or args.max_length < 128 or args.max_length > 2048:
        parser.error("Invalid resource budget")
    train_rows, eval_rows = checked_dataset(args.train), checked_dataset(args.eval)
    prompts = [x["prompt"][0]["content"].strip().lower() for x in [*train_rows, *eval_rows]]
    if len(prompts) != len(set(prompts)):
        raise ValueError("Duplicate prompts between train and validation sets")
    print(f"Dataset verified: train={len(train_rows)}, holdout={len(eval_rows)}. Output path={args.output}")
    if args.dry_run:
        print("DRY RUN ONLY. No model downloaded or trained.")
        return
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError("CUDA GPU required by this QLoRA pipeline. Do not train the 3B model on Echo's 8GB CPU-only laptop.")
    from datasets import Dataset
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import LoraConfig, prepare_model_for_kbit_training
    from trl import SFTConfig, SFTTrainer
    bf16 = torch.cuda.is_bf16_supported()
    quantization = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_use_double_quant=True,
                                       bnb_4bit_compute_dtype=torch.bfloat16 if bf16 else torch.float16)
    tokenizer = AutoTokenizer.from_pretrained(args.model)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    model = AutoModelForCausalLM.from_pretrained(args.model, quantization_config=quantization, device_map={"": 0})
    model.config.use_cache = False
    model = prepare_model_for_kbit_training(model)
    config = SFTConfig(output_dir=str(args.output), num_train_epochs=args.epochs, per_device_train_batch_size=1,
                       gradient_accumulation_steps=4, learning_rate=0.0002, max_length=args.max_length,
                       gradient_checkpointing=True, bf16=bf16, fp16=not bf16, logging_steps=5,
                       report_to="none", save_strategy="no", seed=42)
    adapter_config = LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05, bias="none", target_modules="all-linear", task_type="CAUSAL_LM")
    trainer = SFTTrainer(model=model, args=config, train_dataset=Dataset.from_list(train_rows), eval_dataset=Dataset.from_list(eval_rows),
                         peft_config=adapter_config, processing_class=tokenizer)
    trainer.train()
    metrics = trainer.evaluate()
    args.output.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(args.output / "adapter"))
    tokenizer.save_pretrained(str(args.output / "adapter"))
    (args.output / "training-metrics.json").write_text(json.dumps({"model": args.model, "train_examples": len(train_rows),
        "eval_examples": len(eval_rows), "eval_metrics": metrics, "note": "Held-out loss is not a factual-accuracy score. No deployment or Ollama integration performed."}, indent=2), encoding="utf-8")
    print("Adapter training complete. Evaluate it against the unmodified model before any deployment.")


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, RuntimeError) as exc:
        print(f"Training stopped safely: {exc}", file=sys.stderr)
        sys.exit(1)
