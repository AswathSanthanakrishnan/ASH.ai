# Ash AI

Ash AI is the starter workspace for building and releasing `Ash-0.6B-Instruct v0.1`: a small local assistant model that can later scale into larger Ash models, coder models, and apps.

The first milestone is simple:

```bash
ollama run ash
```

That means the full pipeline works: dataset, fine-tuning, evaluation, model export, Ollama packaging, and release notes.

## Current Goal

Build `Ash-0.6B-Instruct v0.1` as a fine-tuned model from a small open base model.

Recommended base model:

```text
Qwen/Qwen3-0.6B
```

This first version is not trained from scratch. It is a LoRA fine-tune so we can learn the real model release workflow before scaling to larger models.

## Project Layout

```text
ash-ai/
  datasets/
    ash_v0_1_train.jsonl
    ash_v0_1_eval.jsonl
  docs/
    ash_v0_1_spec.md
    dataset_guide.md
    roadmap.md
  evals/
    run_eval.py
    test_prompts.jsonl
  ollama/
    Modelfile
    README.md
  scripts/
    validate_jsonl.py
  training/
    train_lora.py
    merge_lora.py
  requirements.txt
```

## Step 1: Validate the Dataset

```bash
python scripts/validate_jsonl.py datasets/ash_v0_1_train.jsonl
python scripts/validate_jsonl.py datasets/ash_v0_1_eval.jsonl
```

## Step 2: Install Dependencies

Use a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Training downloads the base model from Hugging Face, so it needs internet access and enough disk space.

## Step 3: Fine-Tune Ash v0.1

Small starter run:

```bash
python training/train_lora.py \
  --base-model Qwen/Qwen3-0.6B \
  --train-file datasets/ash_v0_1_train.jsonl \
  --eval-file datasets/ash_v0_1_eval.jsonl \
  --output-dir outputs/ash-0.6b-lora-v0.1 \
  --epochs 1
```

The output is a LoRA adapter, not a full merged model.

## Step 4: Test the Adapter

```bash
python evals/run_eval.py \
  --base-model Qwen/Qwen3-0.6B \
  --adapter outputs/ash-0.6b-lora-v0.1 \
  --prompts evals/test_prompts.jsonl \
  --output evals/results/ash_v0_1_outputs.jsonl
```

## Step 5: Merge the Adapter

```bash
python training/merge_lora.py \
  --base-model Qwen/Qwen3-0.6B \
  --adapter outputs/ash-0.6b-lora-v0.1 \
  --output-dir outputs/Ash-0.6B-Instruct-v0.1
```

## Step 6: Package for Ollama

After converting the merged model to GGUF, update `ollama/Modelfile` so `FROM` points to the GGUF file.

Then run:

```bash
ollama create ash -f ollama/Modelfile
ollama run ash
```

## What We Build Next

1. Expand the dataset from starter examples to 500 high-quality examples.
2. Run a first LoRA training job.
3. Compare base model vs Ash v0.1.
4. Convert to GGUF and run in Ollama.
5. Create the Hugging Face model card and release package.

