#!/bin/bash
set -e

echo "⚡ ============================================"
echo "⚡  ZEROCKLA RAILWAY - Starting Up"
echo "⚡ ============================================"

validate_env() {
    local missing=0
    local has_ai=0
    
    if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
        echo "❌ TELEGRAM_BOT_TOKEN is not set!"
        missing=1
    else
        # Basic format check: Telegram bot tokens start with digits followed by a colon
        if ! [[ "$TELEGRAM_BOT_TOKEN" =~ ^[0-9]+:[A-Za-z0-9_-]+$ ]]; then
            echo "⚠️  TELEGRAM_BOT_TOKEN format looks invalid (should be like: 123456:ABC...)"
        fi
    fi
    
    if [ -z "$TELEGRAM_ADMIN_ID" ]; then
        echo "❌ TELEGRAM_ADMIN_ID is not set!"
        missing=1
    fi
    
    # AI provider keys — at least one required
    if [ -n "$NVIDIA_NIM_API_KEY" ] || [ -n "$GITHUB_TOKEN" ]; then
        has_ai=1
    else
        echo "⚠️  No AI provider keys detected. Set at least one:"
        echo "   NVIDIA_NIM_API_KEY (for NIM models)"
        echo "   GITHUB_TOKEN (for GitHub Models)"
        missing=1
    fi
    
    if [ $missing -eq 1 ]; then
        echo ""
        echo "Set the required variables in Railway (Settings → Variables) and redeploy."
        echo ""
        exit 1
    fi
}

# Substitute environment variables in config
substitute_env() {
    echo "🔧 Substituting environment variables in config..."
    
    local config="/root/.openclaw/openclaw.json"
    
    # Sed in-place on the original file (preserves inode — avoids
    # the "missing-meta-before-write" / sha256 anomaly on reload)
    sed -i "s|\${TELEGRAM_BOT_TOKEN}|${TELEGRAM_BOT_TOKEN}|g" "$config"
    sed -i "s|\${TELEGRAM_ADMIN_ID}|${TELEGRAM_ADMIN_ID}|g" "$config"
    sed -i "s|\${NVIDIA_NIM_API_KEY}|${NVIDIA_NIM_API_KEY}|g" "$config"
    sed -i "s|\${GITHUB_TOKEN}|${GITHUB_TOKEN}|g" "$config"
    
    echo "✅ Config resolved"
}

# Start Copilot auth server (non-fatal - don't crash if it fails)
start_copilot_auth() {
    echo "🔑 Starting Copilot auth server on port ${COPILOT_AUTH_PORT:-8789}..."
    if node /copilot-auth-server.js >> /tmp/copilot-auth.log 2>&1 &
    then
        COPILOT_PID=$!
        echo "   Copilot auth server PID: $COPILOT_PID"
        echo "   Visit http://localhost:${COPILOT_AUTH_PORT:-8789}/ to authenticate"
    else
        echo "⚠️  Copilot auth server failed to start (non-fatal)"
    fi
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

# Clean corrupted npm caches and stale plugin-runtime-deps
cleanup_plugin_deps() {
    echo "🧹 Cleaning stale plugin-runtime-deps..."
    local deps_dir="/root/.openclaw/plugin-runtime-deps"
    
    if [ -d "$deps_dir" ]; then
        # Remove any lock files/directories
        find "$deps_dir" -name ".openclaw-runtime-deps.lock" -type d -exec rm -rf {} + 2>/dev/null || true
        
        # Remove corrupted temp directories (dot-prefixed like .hono-asFCTDcb)
        find "$deps_dir" -maxdepth 3 -name ".*" -type d -exec rm -rf {} + 2>/dev/null || true
        
        # Remove any ENOTEMPTY-causing stale node_modules with failed renames
        find "$deps_dir" -maxdepth 4 -name "node_modules" -type d | while read -r nm_dir; do
            # Clean temp/dot-prefixed dirs inside node_modules (failed npm renames)
            find "$nm_dir" -maxdepth 1 -name ".*" -type d -exec rm -rf {} + 2>/dev/null || true
        done
        
        echo "   ✅ Cleaned plugin-runtime-deps"
    else
        echo "   (no plugin-runtime-deps dir — skipping)"
    fi
    
    # Also clean npm cache to avoid stale tarballs
    npm cache clean --force 2>/dev/null || true
    echo "   ✅ Cleaned npm cache"
}

# Main startup
main() {
    validate_env
    substitute_env
    init_workspace
    setup_git
    start_copilot_auth
    
    # Aggressively clean corrupted plugin-runtime-deps before gateway starts
    cleanup_plugin_deps
    
    echo ""
    echo "⚡ ============================================"
    echo "⚡  ZEROCKLA RAILWAY - Ready"
    echo "⚡ ============================================"
    echo ""
    echo "🤖 Telegram Bot: Active"
    echo "👤 Admin ID: $TELEGRAM_ADMIN_ID"
    echo ""
    echo "📦 Models configured:"
    echo "   NIM: Kimi-K2.6, DeepSeek-V4-Pro, GLM-5.1, Qwen3.5, Qwen3-Coder, Phi-4"
    echo "   NIM Images: Stable Diffusion 3.5, FLUX 2"
    echo "   GitHub: GPT-5, Grok-3"
    echo ""
    echo "⚡ Starting OpenClaw Gateway..."
    echo ""
    
    # Kill any existing gateway processes (ignore errors)
    pkill -f "openclaw gateway" 2>/dev/null || true
    sleep 2
    
    # Fix IPv6 issues on some hosts
    export OPENCLAW_TELEGRAM_DISABLE_AUTO_SELECT_FAMILY=1
    export OPENCLAW_TELEGRAM_DNS_RESULT_ORDER=ipv4first
    
    # Suppress npm engine-strict errors (EBADENGINE warnings for packages requiring Node >=24)
    # The warnings are non-fatal; ENOTEMPTY is the real blocker, handled by cleanup_plugin_deps
    export npm_config_engine_strict=false
    
    # Start the gateway with --force to kill any lingering listeners
    exec openclaw gateway --force
}

main "$@"
