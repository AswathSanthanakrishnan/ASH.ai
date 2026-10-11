# Ash v0.1 Dataset Guide

The dataset teaches Ash how to behave. For the first release, quality matters more than size.

## Recommended Starter Mix

```text
40% general assistant answers
20% startup, product, and AI-building guidance
15% coding and technical help
15% reasoning and planning
10% tool/web-search behavior
```

## JSONL Format

Each line is one chat example:

```json
{"messages":[{"role":"system","content":"You are Ash, a practical AI assistant created by Ash AI."},{"role":"user","content":"What is the first step to build my own model?"},{"role":"assistant","content":"Define the first model clearly. For Ash v0.1, choose the purpose, base model, dataset style, training method, and release target before writing code."}]}
```

Use only these roles for v0.1 compatibility:

```text
system
user
assistant
```

Do not use `tool` messages yet. Instead, teach tool behavior in plain text until the app/agent wrapper exists.

## Good Example Rules

A good example:

- answers one clear user need
- uses natural wording
- is truthful about limitations
- teaches Ash's style
- avoids fake current facts
- avoids hidden chain-of-thought

## Bad Example Rules

Do not include examples that:

- tell Ash to pretend it has live internet
- contain private user information
- contain copyrighted long text copied from elsewhere
- teach unsafe medical/legal/financial certainty
- are too vague to train useful behavior

## Dataset Growth Plan

```text
v0.1 starter: 25-50 examples
v0.1 first training: 500 examples
v0.2: 2,000 examples
v0.3: 10,000+ examples
```

The first 500 examples should be hand-curated. Later we can generate drafts and review them.

