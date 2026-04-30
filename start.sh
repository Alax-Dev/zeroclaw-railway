#!/bin/bash
set -e

echo "⚡ ============================================"
echo "⚡  ZEROCKLA RAILWAY - Starting Up"
echo "⚡ ============================================"

# Validate required environment variables
validate_env() {
    local missing=0
    
    if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
        echo "❌ TELEGRAM_BOT_TOKEN is not set!"
        missing=1
    fi
    
    if [ -z "$TELEGRAM_ADMIN_ID" ]; then
        echo "❌ TELEGRAM_ADMIN_ID is not set!"
        missing=1
    fi
    
    if [ -z "$NVIDIA_NIM_API_KEY" ]; then
        echo "⚠️  NVIDIA_NIM_API_KEY is not set - NIM models will be unavailable"
    fi
    
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "⚠️  GITHUB_TOKEN is not set - GitHub Models will be unavailable"
    fi
    
    if [ $missing -eq 1 ]; then
        echo ""
        echo "Required environment variables:"
        echo "  TELEGRAM_BOT_TOKEN   - Get from @BotFather on Telegram"
        echo "  TELEGRAM_ADMIN_ID    - Your Telegram numeric user ID"
        echo ""
        echo "Optional:"
        echo "  NVIDIA_NIM_API_KEY   - Get from build.nvidia.com"
        echo "  GITHUB_TOKEN         - Get from github.com/settings/tokens"
        echo ""
        exit 1
    fi
}

# Substitute environment variables in config
substitute_env() {
    echo "🔧 Substituting environment variables in config..."
    
    local config="/root/.openclaw/openclaw.json"
    local temp="/tmp/openclaw-resolved.json"
    
    # Use envsubst for variable substitution
    envsubst < "$config" > "$temp"
    mv "$temp" "$config"
    
    echo "✅ Config resolved"
}

# Start Copilot auth server
start_copilot_auth() {
    echo "🔑 Starting Copilot auth server on port ${COPILOT_AUTH_PORT:-8789}..."
    node /copilot-auth-server.js &
    COPILOT_PID=$!
    echo "   Copilot auth server PID: $COPILOT_PID"
    echo "   Visit http://localhost:${COPILOT_AUTH_PORT:-8789}/ to authenticate"
}

# Initialize workspace if needed
init_workspace() {
    if [ ! -f /root/.openclaw/workspace/SOUL.md ]; then
        echo "📝 Initializing workspace files..."
        cp -r /workspace-init/* /root/.openclaw/workspace/ 2>/dev/null || true
    fi
}

# Configure git if available
setup_git() {
    if command -v git &> /dev/null; then
        git config --global user.email "zeroclaw@railway.app" 2>/dev/null || true
        git config --global user.name "Zeroclaw" 2>/dev/null || true
        git config --global init.defaultBranch main 2>/dev/null || true
    fi
}

# Main startup
main() {
    validate_env
    substitute_env
    init_workspace
    setup_git
    start_copilot_auth
    
    echo ""
    echo "⚡ ============================================"
    echo "⚡  ZEROCKLA RAILWAY - Ready"
    echo "⚡ ============================================"
    echo ""
    echo "🤖 Telegram Bot: Active"
    echo "👤 Admin ID: $TELEGRAM_ADMIN_ID"
    echo ""
    echo "📦 Models configured:"
    echo "   NIM: DeepSeek-V4-Pro, GLM-5.1, Qwen3.5, Qwen3-Coder, Phi-4, Llama-3.3"
    echo "   NIM Images: Stable Diffusion 3.5, FLUX 2"
    echo "   GitHub: GPT-5, Grok-3"
    echo ""
    echo "⚡ Starting OpenClaw Gateway..."
    echo ""
    
    # Start the gateway
    exec openclaw gateway --no-color
}

main "$@"
