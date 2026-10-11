# Ollama Packaging

This folder is for packaging Ash as a local Ollama model.

The target user command is:

```bash
ollama run ash
```

## Expected Flow

1. Fine-tune the LoRA adapter.
2. Merge the adapter into the base model.
3. Convert the merged model to GGUF.
4. Put or reference the GGUF file next to `Modelfile`.
5. Create the local Ollama model.

```bash
ollama create ash -f ollama/Modelfile
ollama run ash
```

## Notes

The `FROM` line currently points to a placeholder GGUF filename:

```text
Ash-0.6B-Instruct-v0.1-Q4_K_M.gguf
```

After conversion, update `FROM` if the actual filename is different.

