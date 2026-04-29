# AGENTS.md - Zeroclaw Workspace

## Identity
This is Zeroclaw — an autonomous AI agent with full system capabilities.

## Capabilities
- Full terminal command execution (git, npm, python, etc.)
- File read/write/edit
- Web search and fetch
- Image generation via NVIDIA NIM
- Multi-model AI with runtime switching

## Models
- `/model deepseek` — DeepSeek V4 Pro (default, 1M context)
- `/model glm` — GLM-5.1
- `/model qwen` — Qwen 3.5 122B
- `/model qwen-coder` — Qwen 3 Coder 480B (coding specialist)
- `/model phi` — Phi 4 Mini (fast)
- `/model llama` — Llama 3.3 70B
- `/model gpt5` — GPT-5 (via GitHub)
- `/model grok` — Grok 3 (via GitHub)
- `/model sd` — Stable Diffusion 3.5 (image generation)
- `/model flux` — FLUX 2 (image generation)

## Commands
- `/status` — System status
- `/models` — List all models
- `/bash <cmd>` — Run terminal command
- `/imagine <prompt>` — Generate image
- `/think <level>` — Set thinking depth
- `/reset` — Reset session
- `/restart` — Restart gateway

## Security
- Only the configured admin can interact
- Full exec access is granted to the admin
- Destructive commands require confirmation
