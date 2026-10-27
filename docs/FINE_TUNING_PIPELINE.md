# Echo v0.4 — True Model Fine-Tuning: Data, GPU Training and Evaluation

## What “learning” means and does not mean

Echo has **three separate improvement paths**:

1. `/learn`, `/context`, `/interview`: user-approved private memory and retrieval. Model weights do not change.
2. `/train`: owner-approved **training examples**, validated and exported into a private supervised fine-tuning dataset. Model weights still do not change.
3. `training/train_lora.py`: real **parameter-efficient supervised fine-tuning**. When run on a compatible NVIDIA CUDA GPU with matching Hugging Face model weights, this changes LoRA adapter parameters and saves a new adapter. This script is not invoked from chat and never trains automatically.

The current 8 GB RAM ThinkPad with CPU-only Ollama is **not suitable for training Llama 3.2 3B with this GPU pipeline**. Use a suitably provisioned CUDA machine that you trust (local GPU workstation or explicitly approved rented VM). Never upload private learning/context data unintentionally. The training adapter is not automatically integrated into Ollama or Echo.

## Build the training set (on your Ubuntu Echo terminal)

Start Echo and enter, for every good example:

```
/train add Explain the CIA triad briefly. | Confidentiality, integrity and availability are the three principles of the CIA triad.
```

Preview the proposed training pair, then use `/train confirm REAL_ID`. Use `/train reject REAL_ID` to discard; `/train list` to inspect approved examples and `/train delete REAL_ID` to remove one. **Only teach answers you have fact-checked.** The private journal is `data/training/approved.json` and is excluded from Git.

Prepare the train/held-out validation split from the Ubuntu terminal:

```bash
cd ~/Documents/echo
npm run finetune:prepare
```

At least **eight** owner-approved question-and-answer examples are required to export anything. Eight examples are sufficient to test the pipeline, **not to demonstrate meaningful model improvement**. A meaningful model project should include many more diverse, verified examples and independent evaluation cases, with duplicate/near-duplicate audits. The current export detects exact duplicate prompts, but does not guarantee no paraphrase leakage.

The exporter creates `data/training/ready/train.jsonl` and `eval.jsonl` with conversational prompt/completion fields and 0600 permissions. Review both files and remove credentials, financial/account data, names, and private projects before transferring them anywhere. The basic credential scanner is **not** comprehensive. Data is not automatically harvested from conversations or uploaded.

## Run true QLoRA training on a CUDA GPU machine

Copy only the reviewed `train.jsonl` and `eval.jsonl` files to a trusted GPU machine along with the Python script and requirements. Check your rights to use the exact model. `meta-llama/Llama-3.2-3B-Instruct` may require agreeing to license terms and authenticating with a model host. A LoRA adapter trained for one base model must not be applied to a different base model, even one with a similar name.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r training/requirements-gpu.txt
python training/train_lora.py --train data/training/ready/train.jsonl \
  --eval data/training/ready/eval.jsonl \
  --output data/training/runs/lora-run --model meta-llama/Llama-3.2-3B-Instruct --dry-run
```

The `--dry-run` step works without Torch/CUDA and only checks the JSONL. **It is not training.**

Then on the CUDA host (actual learning):

```bash
python training/train_lora.py --train data/training/ready/train.jsonl \
  --eval data/training/ready/eval.jsonl \
  --output data/training/runs/lora-run --model meta-llama/Llama-3.2-3B-Instruct \
  --epochs 1 --max-length 768
```

The script refuses output outside the Git-ignored `data/training/` directory and creates adapter artifacts with a restrictive process umask.

The script uses NF4 four-bit loading with bitsandbytes and PEFT's LoRA adapter. CUDA compatibility, Python package releases, VRAM, accepted license, tokenization templates and actual training remain **unverified in this build environment**. Expect to pin exact dependency versions once a working GPU combination is established; `requirements-gpu.txt` specifies ranges, not a fully reproducible lockfile. If your GPU doesn't support bfloat16, the script uses float16. Resource use depends heavily on model and sequence length; start with conservative settings and watch VRAM, temperature and validation loss.

The output `data/training/runs/lora-run/adapter` contains *adapter weights*, not a merged standalone model. `training-metrics.json` records validation loss and identifies the base model. No automatic deployment occurs. The owner must explicitly evaluate and package the model for Ollama separately (merging adapters and GGUF conversion may be necessary); that integration is **not implemented** here.

## Accuracy acceptance before deployment

1. Freeze a held-out factual and programming evaluation suite not used in training or prompt selection.
2. Run the **same** questions against original base model and trained adapter with matched system instructions, temperature, and context.
3. Score mathematical and coding correctness with deterministic or execution-based checks; score factual responses against reliable human-verified references.
4. Compare percentages, timeouts, unsafe claims and hallucinations, not only validation loss.
5. Reject any adapter that worsens critical accuracy or privacy behavior. Keep a reproducible backup of the original model and settings.
6. Never feed model-generated confident errors into the dataset without independent checking.

LoRA is parameter-efficient **weight training**, not a guarantee of general reasoning improvement. Your highest-confidence gains will still come from deterministic tools, retrieval from reliable documentation, and well-structured context.

## Technical references

- TRL SFTTrainer: https://huggingface.co/docs/trl/sft_trainer
- PEFT quantization/QLoRA: https://huggingface.co/docs/peft/developer_guides/quantization
- Hugging Face dataset privacy: review data access and model-card licensing before any network download or upload.
