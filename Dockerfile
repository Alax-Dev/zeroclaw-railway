FROM node:24-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    wget \
    python3 \
    python3-pip \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    jq \
    psmisc \
    && rm -rf /var/lib/apt/lists/*

# Suppress EBADENGINE warnings globally (packages requiring Node >=24 are non-fatal)
RUN npm config set engine-strict false

# Install OpenClaw globally
RUN npm install -g openclaw@latest

# Create openclaw directories
RUN mkdir -p /root/.openclaw/workspace \
    /root/.openclaw/agents/main/agent \
    /root/.openclaw/telegram \
    /root/.openclaw/logs

# Copy configuration
COPY openclaw.json /root/.openclaw/openclaw.json

# Copy workspace files
COPY workspace/ /root/.openclaw/workspace/

# Copy startup script
COPY start.sh /start.sh
COPY copilot-auth-server.js /copilot-auth-server.js
RUN chmod +x /start.sh

# Set working directory
WORKDIR /root/.openclaw/workspace

# Expose port for webhooks (optional)
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD openclaw health || exit 1

# Start
CMD ["/start.sh"]
