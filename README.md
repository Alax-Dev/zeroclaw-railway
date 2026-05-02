# ⚡ Zeroclaw Railway

> Autonomous AI agent on Railway — powered by OpenClaw, NVIDIA NIM, and GitHub Models. Fully controllable via Telegram.

## What Is This?

**Zeroclaw** is a self-hosted AI agent that runs on Railway and connects to your Telegram. It's built on [OpenClaw](https://github.com/openclaw/openclaw) — an open-source automation platform — and gives you:

- **Multiple AI models** switchable from Telegram
- **Full terminal access** — run any command from chat
- **Image generation** via NVIDIA NIM
- **Admin-only access** — only your Telegram ID can interact
- **14+ AI models** from three providers (NIM, GitHub Models, GitHub Copilot)

## 🤖 Available Models

### NVIDIA NIM (LLM)
| Model | Alias | Use Case |
|-------|-------|----------|
| DeepSeek V4 Pro | `/model deepseek` | Default — 1M context, reasoning |
| GLM-5.1 | `/model glm` | General purpose |
| Qwen 3.5 122B | `/model qwen` | Balanced performance |
| Qwen 3 Coder 480B | `/model qwen-coder` | **Coding specialist** |
| Phi 4 Mini | `/model phi` | Fast responses |
| Kimi K2.6 | `/model kimi` | Moonshot AI — reasoning + 128K context |

### NVIDIA NIM (Image Generation)
| Model | Alias | Use Case |
|-------|-------|----------|
| Stable Diffusion 3.5 Large | `/model sd` | High quality images |
| FLUX 2 Klein | `/model flux` | Fast image generation |

### GitHub Models
| Model | Alias | Use Case |
|-------|-------|----------|
| GPT-5 | `/model gpt5` | OpenAI's latest |
| Grok 3 | `/model grok` | xAI's model |

### GitHub Copilot (requires login)
| Model | Alias | Use Case |
|-------|-------|----------|
| Claude 3.5 Haiku | `/model copilot-haiku` (was copilot-haiku-4.5) | Fast, lightweight |
| GPT-4o | `/model copilot-gpt4o` | Vision + text |
| GPT-4o Mini | `/model copilot-gpt5mini` | Fast GPT-5 |
| Claude Sonnet 4 | `/model copilot-sonnet` | Balanced reasoning |

> **Note:** Copilot models require a GitHub Copilot subscription. Send `/copilot-login` in Telegram to authenticate via device flow.

## 🚀 Deploy to Railway

### Prerequisites

1. **Telegram Bot Token** — Create via [@BotFather](https://t.me/BotFather)
2. **Your Telegram User ID** — Get from [@userinfobot](https://t.me/userinfobot)
3. **NVIDIA NIM API Key** — Get from [build.nvidia.com](https://build.nvidia.com)
4. **GitHub Token** — Get from [github.com/settings/tokens](https://github.com/settings/tokens) (fine-grained or classic PAT)
5. **Railway Account** — Sign up at [railway.app](https://railway.app)

### Step 1: Fork or Clone

```bash
# Option A: Fork this repo on GitHub
# Option B: Clone and push to your own repo
git clone https://github.com/YOUR_USERNAME/zeroclaw-railway.git
cd zeroclaw-railway
```

### Step 2: Deploy on Railway

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub Repo"**
4. Choose your forked repo
5. Railway will detect the `Dockerfile` and build automatically

### Step 3: Set Environment Variables

In Railway dashboard → your service → **Variables** tab:

```
TELEGRAM_BOT_TOKEN = 123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_ID = 123456789
NVIDIA_NIM_API_KEY = nvapi-xxxxxxxxxxxx
GITHUB_TOKEN = ghp_xxxxxxxxxxxx
```

### Step 4: Deploy

Click **"Deploy"** and wait for the build to complete. The bot will start automatically.

### Step 5: Start Chatting

Open Telegram, find your bot, and send `/status` to verify it's working.

## 📱 Telegram Commands

### Model Management
- `/model` — Show current model + picker
- `/model deepseek` — Switch to DeepSeek V4 Pro
- `/model gpt5` — Switch to GPT-5
- `/model grok` — Switch to Grok 3
- `/model qwen-coder` — Switch to Qwen Coder (coding)
- `/model sd` — Switch to Stable Diffusion (images)
- `/models` — List all available models

### System Control
- `/status` — System status + model info
- `/bash <command>` — Run any terminal command
- `! <command>` — Shortcut for bash
- `/think <level>` — Set thinking depth (off/minimal/low/medium/high)
- `/elevated on` — Enable elevated mode
- `/restart` — Restart the gateway
- `/reset` — Reset current session
- `/copilot-login` — Login to GitHub Copilot (device flow)

### Image Generation
- `/model sd` then describe your image
- `/model flux` then describe your image

### Examples
```
/model deepseek
What is quantum computing?

/bash git status
/bash ls -la
/bash python3 --version

/model qwen-coder
Write a Python web scraper

/model sd
A cyberpunk city at night, neon lights, rain

/bash git add . && git commit -m "update" && git push
```

## 🔑 GitHub Copilot Setup (Optional)

If you have a GitHub Copilot subscription, you can use Copilot models (Claude 3.5 Haiku, GPT-4o, etc.) as an additional provider.

### How It Works

1. Send `/copilot-login` to your bot on Telegram
2. The bot gives you a **device code** (format: XXXX-XXXX)
3. Go to https://github.com/login/device and enter the code
4. Authorize the device
5. The bot confirms authentication — you can now use Copilot models

### Available Copilot Models

- `/model copilot-haiku` (was copilot-haiku-4.5) — Claude 3.5 Haiku (fast)
- `/model copilot-gpt4o` — GPT-4o (vision capable)
- `/model copilot-gpt5mini` — GPT-4o Mini
- `/model copilot-sonnet` — Claude Sonnet 4 (reasoning)

### Auth Server

The Copilot auth server runs on port `8789` alongside the gateway. It handles:
- OAuth device flow authentication
- Automatic token refresh (Copilot tokens expire every 25 min)
- Proxying requests to the Copilot API with fresh tokens

You can also access the auth UI directly at `https://your-railway-url:8789/`

## 🔧 Local Development

```bash
# Install OpenClaw
npm install -g openclaw

# Copy environment variables
cp .env.example .env
# Edit .env with your keys

# Copy config
cp openclaw.json ~/.openclaw/openclaw.json

# Start
openclaw gateway
```

## 🏗️ Project Structure

```
zeroclaw-railway/
├── Dockerfile              # Railway container build
├── railway.json            # Railway deployment config
├── openclaw.json           # OpenClaw configuration (models, channels, tools)
├── start.sh                # Startup script with env validation
├── copilot-auth-server.js  # Copilot OAuth device flow + token proxy
├── .env.example            # Environment variables template
├── README.md               # This file
└── workspace/              # Agent workspace
    ├── SOUL.md             # Agent personality
    ├── AGENTS.md           # Agent capabilities
    ├── USER.md             # Admin info
    └── TOOLS.md            # Environment notes
```

## ⚙️ Configuration Details

### API Endpoints

| Provider | Base URL | API Type |
|----------|----------|----------|
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` | OpenAI-compatible |
| GitHub Models | `https://models.inference.ai.azure.com` | OpenAI-compatible |
| GitHub Copilot | `https://api.githubcopilot.com` | OpenAI-compatible (via proxy) |

### Security Model

- **Admin-only:** Only your Telegram user ID can interact
- **Full exec:** Admin has unrestricted terminal access
- **No sandboxing:** Commands run directly on the Railway container
- **Config writes:** Admin can modify config from Telegram

### Customization

Edit `openclaw.json` to:
- Change the default model
- Add/remove models
- Adjust fallback order
- Configure image models
- Modify agent personality (workspace/SOUL.md)

## 🆘 Troubleshooting

### Bot doesn't respond
1. Check `TELEGRAM_BOT_TOKEN` is correct
2. Check `TELEGRAM_ADMIN_ID` matches your numeric ID
3. Check Railway logs for errors

### Model errors
1. Verify API keys are set correctly
2. Check if the model is available on the provider
3. Try switching to a different model with `/model`

### Commands not working
1. Ensure you're the admin (check with `/whoami`)
2. Try `/restart` to restart the gateway
3. Check Railway deployment logs

## 📄 License

MIT — Based on [OpenClaw](https://github.com/openclaw/openclaw) (also MIT).

## 🔗 Links

- [OpenClaw Documentation](https://docs.openclaw.ai)
- [OpenClaw GitHub](https://github.com/openclaw/openclaw)
- [NVIDIA NIM](https://build.nvidia.com)
- [GitHub Models](https://github.com/marketplace/models)
- [Railway](https://railway.app)
