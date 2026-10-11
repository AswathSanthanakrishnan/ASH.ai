#!/usr/bin/env python3
"""Run simple generation evals for Ash."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from peft import PeftModel
from tqdm import tqdm
from transformers import AutoModelForCausalLM, AutoTokenizer


SYSTEM_PROMPT = (
    "You are Ash, a practical AI assistant created by Ash AI. "
    "Answer clearly, honestly, and step by step when useful."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Ash eval prompts")
    parser.add_argument("--base-model", default="Qwen/Qwen3-0.6B")
    parser.add_argument("--adapter", default=None)
    parser.add_argument("--prompts", default="evals/test_prompts.jsonl")
    parser.add_argument("--output", default="evals/results/ash_outputs.jsonl")
    parser.add_argument("--max-new-tokens", type=int, default=300)
    parser.add_argument("--temperature", type=float, default=0.7)
    return parser.parse_args()


def load_prompts(path: Path) -> list[dict]:
    prompts: list[dict] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if line.strip():
                prompts.append(json.loads(line))
    return prompts


def main() -> int:
    args = parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        torch_dtype="auto",
        trust_remote_code=True,
    )
    if args.adapter:
        model = PeftModel.from_pretrained(model, args.adapter)

    device = "cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu"
    model.to(device)
    model.eval()

    prompts = load_prompts(Path(args.prompts))

    with output_path.open("w", encoding="utf-8") as output:
        for item in tqdm(prompts, desc="Evaluating"):
            messages = [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": item["prompt"]},
            ]
            text = tokenizer.apply_chat_template(
                messages,
                tokenize=False,
                add_generation_prompt=True,
            )
            inputs = tokenizer(text, return_tensors="pt").to(device)

            with torch.no_grad():
                generated = model.generate(
                    **inputs,
                    max_new_tokens=args.max_new_tokens,
                    do_sample=args.temperature > 0,
                    temperature=args.temperature,
                    pad_token_id=tokenizer.eos_token_id,
                )

            answer_tokens = generated[0][inputs["input_ids"].shape[-1] :]
            answer = tokenizer.decode(answer_tokens, skip_special_tokens=True).strip()
            output.write(
                json.dumps(
                    {"id": item.get("id"), "prompt": item["prompt"], "answer": answer},
                    ensure_ascii=False,
                )
                + "\n"
            )

    print(f"Wrote eval outputs to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

