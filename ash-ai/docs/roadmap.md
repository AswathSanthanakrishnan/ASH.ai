# Ash AI Roadmap

## Phase 1: Ash-0.6B v0.1

Goal: prove the full model release pipeline.

Deliverables:

- model spec
- starter dataset
- LoRA training script
- eval script
- merged model export script
- Ollama Modelfile
- model card draft

Success command:

```bash
ollama run ash
```

## Phase 2: Ash-1.5B or Ash-3B

Goal: improve assistant quality while staying affordable.

Work:

- expand dataset to 2,000+ examples
- add better eval prompts
- compare model sizes
- add basic safety and refusal data
- publish Hugging Face release

## Phase 3: Ash-4B / Ash-8B / Ash-9B

Goal: public-quality local assistant models.

Work:

- higher-quality dataset
- stronger benchmarks
- quantized GGUF releases
- Ollama release
- model card with limitations
- inference server option

## Phase 4: Ash-Coder

Goal: coding-focused model.

Work:

- coding instruction dataset
- repo Q&A examples
- debugging examples
- terminal command examples
- benchmark on coding tasks

## Phase 5: Ash-Mobile

Goal: phone-friendly model.

Work:

- small model architecture choice
- quantization
- Core ML / ONNX / mobile runtime research
- mobile app integration

## Phase 6: Ash App and API

Goal: Claude/Gemini-style app experience powered by Ash models.

Work:

- chat app
- memory
- file upload
- web search
- tools/agents
- cloud API
- user accounts and billing

