#!/usr/bin/env node
/**
 * GitHub Copilot Auth Server
 * Handles OAuth device flow + automatic token refresh
 * 
 * Endpoints:
 *   GET  /          - Status page
 *   GET  /status    - JSON status
 *   POST /login     - Start device flow auth
 *   GET  /token     - Get current copilot token (for OpenClaw)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.COPILOT_AUTH_PORT || 8789;
const TOKEN_FILE = '/tmp/copilot-token.json';
const CLIENT_ID = 'Iv1.b507a08c87ecfe98'; // VSCode's public client ID

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'accept': 'application/json',
        'editor-version': 'Neovim/0.6.1',
        'editor-plugin-version': 'copilot.vim/1.16.0',
        'content-type': 'application/json',
        'user-agent': 'GithubCopilot/1.155.0',
        ...options.headers
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

// ─── Token management ────────────────────────────────────────────────────────

function loadToken() {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); }
  catch { return null; }
}

function saveToken(data) {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

async function refreshCopilotToken(githubToken) {
  const resp = await httpsRequest('https://api.github.com/copilot_internal/v2/token', {
    method: 'GET',
    headers: { 'authorization': `token ${githubToken}` }
  });
  
  if (resp.status === 200 && resp.data.token) {
    const entry = {
      copilot_token: resp.data.token,
      expires_at: resp.data.expires_at || (Date.now() + 25 * 60 * 1000),
      github_token: githubToken,
      refreshed_at: Date.now()
    };
    saveToken(entry);
    console.log(`[${new Date().toISOString()}] ✅ Copilot token refreshed (expires: ${new Date(entry.expires_at).toISOString()})`);
    return entry;
  }
  
  console.error(`[${new Date().toISOString()}] ❌ Failed to refresh copilot token: ${resp.status} ${JSON.stringify(resp.data)}`);
  return null;
}

// ─── Background refresh loop ─────────────────────────────────────────────────

let refreshInterval = null;

function startRefreshLoop() {
  if (refreshInterval) return;
  
  refreshInterval = setInterval(async () => {
    const token = loadToken();
    if (!token?.github_token) return;
    
    // Refresh if expiring in < 5 minutes
    if (token.expires_at && Date.now() < token.expires_at - 5 * 60 * 1000) return;
    
    await refreshCopilotToken(token.github_token);
  }, 60 * 1000); // Check every minute
  
  console.log(`[${new Date().toISOString()}] 🔄 Token refresh loop started (check every 60s)`);
}

// ─── Device flow auth ────────────────────────────────────────────────────────

async function startDeviceFlow() {
  // Step 1: Request device code
  const codeResp = await httpsRequest('https://github.com/login/device/code', {
    method: 'POST'
  }, {
    client_id: CLIENT_ID,
    scope: 'read:user'
  });
  
  if (codeResp.status !== 200) {
    throw new Error(`Device code request failed: ${codeResp.status}`);
  }
  
  return codeResp.data;
}

async function pollForToken(deviceCode, interval = 5, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, interval * 1000));
    
    const resp = await httpsRequest('https://github.com/login/oauth/access_token', {
      method: 'POST'
    }, {
      client_id: CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    });
    
    if (resp.data.access_token) {
      return resp.data.access_token;
    }
    
    if (resp.data.error === 'authorization_pending') continue;
    if (resp.data.error === 'slow_down') {
      interval = Math.min(interval + 5, 30);
      continue;
    }
    
    throw new Error(`Auth error: ${resp.data.error} - ${resp.data.error_description}`);
  }
  
  throw new Error('Auth timed out (15 minutes)');
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  
  try {
    // ── GET / ── Status page ──
    if (url.pathname === '/' && req.method === 'GET') {
      const token = loadToken();
      const hasGithub = !!token?.github_token;
      const hasCopilot = !!token?.copilot_token;
      const expiresIn = token?.expires_at ? Math.max(0, Math.round((token.expires_at - Date.now()) / 60000)) : 0;
      
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(`<!DOCTYPE html>
<html>
<head><title>Zeroclaw - Copilot Auth</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 60px auto; padding: 20px; background: #0d1117; color: #c9d1d9; }
  h1 { color: #58a6ff; }
  .status { padding: 16px; border-radius: 8px; margin: 16px 0; }
  .ok { background: #0d2818; border: 1px solid #238636; }
  .warn { background: #2d1b00; border: 1px solid #d29922; }
  .err { background: #2d0d0d; border: 1px solid #f85149; }
  button { background: #238636; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; margin: 8px 0; }
  button:hover { background: #2ea043; }
  code { background: #161b22; padding: 2px 6px; border-radius: 4px; }
  .code-display { font-size: 28px; font-family: monospace; letter-spacing: 4px; color: #f0f6fc; background: #161b22; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0; }
</style>
</head>
<body>
  <h1>⚡ Zeroclaw - Copilot Auth</h1>
  ${hasCopilot ? `
    <div class="status ok">
      <strong>✅ Authenticated</strong><br>
      Copilot token expires in <strong>${expiresIn} min</strong>
    </div>
  ` : hasGithub ? `
    <div class="status warn">
      <strong>⚠️ GitHub token found, refreshing Copilot token...</strong>
    </div>
  ` : `
    <div class="status err">
      <strong>❌ Not authenticated</strong><br>
      Click the button below to log in with GitHub Copilot.
    </div>
    <button onclick="startLogin()">🔑 Copilot Login</button>
    <div id="login-area"></div>
  `}
  <p style="margin-top:32px;color:#8b949e;font-size:13px;">
    Token endpoint: <code>GET /token</code> • Status: <code>GET /status</code>
  </p>
<script>
async function startLogin() {
  const area = document.getElementById('login-area');
  area.innerHTML = '<p>Requesting device code...</p>';
  
  const resp = await fetch('/login', { method: 'POST' });
  const data = await resp.json();
  
  if (data.error) {
    area.innerHTML = '<p style="color:#f85149">Error: ' + data.error + '</p>';
    return;
  }
  
  area.innerHTML = \`
    <div class="code-display">\${data.user_code}</div>
    <p>1. Go to <a href="\${data.verification_uri}" target="_blank" style="color:#58a6ff">\${data.verification_uri}</a></p>
    <p>2. Enter the code above</p>
    <p>3. Authorize, then come back here</p>
    <p id="poll-status" style="color:#d29922">⏳ Waiting for authorization...</p>
  \`;
  
  // Poll for completion
  const pollResp = await fetch('/login/poll', { method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: data.device_code, interval: data.interval || 5 })
  });
  const result = await pollResp.json();
  
  if (result.ok) {
    document.getElementById('poll-status').innerHTML = '✅ <strong>Authenticated!</strong> Copilot is ready. Reloading...';
    setTimeout(() => location.reload(), 2000);
  } else {
    document.getElementById('poll-status').innerHTML = '❌ ' + (result.error || 'Failed');
  }
}
</script>
</body></html>`);
    }
    
    // ── GET /status ── JSON status ──
    if (url.pathname === '/status') {
      const token = loadToken();
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        authenticated: !!token?.copilot_token,
        has_github_token: !!token?.github_token,
        expires_at: token?.expires_at || null,
        expires_in_minutes: token?.expires_at ? Math.max(0, Math.round((token.expires_at - Date.now()) / 60000)) : 0,
        refreshed_at: token?.refreshed_at || null
      }));
    }
    
    // ── POST /login ── Start device flow ──
    if (url.pathname === '/login' && req.method === 'POST') {
      const data = await startDeviceFlow();
      console.log(`[${new Date().toISOString()}] 🔑 Device flow started. Code: ${data.user_code}`);
      
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        user_code: data.user_code,
        verification_uri: data.verification_uri,
        device_code: data.device_code,
        expires_in: data.expires_in,
        interval: data.interval
      }));
    }
    
    // ── POST /login/poll ── Poll for token ──
    if (url.pathname === '/login/poll' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const { device_code, interval } = JSON.parse(body);
      
      try {
        const githubToken = await pollForToken(device_code, interval || 5);
        console.log(`[${new Date().toISOString()}] ✅ GitHub token obtained`);
        
        // Get copilot token
        const copilotResult = await refreshCopilotToken(githubToken);
        
        if (copilotResult) {
          res.writeHead(200, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(500, { 'content-type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Failed to get Copilot token' }));
        }
      } catch (err) {
        res.writeHead(400, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }
    
    // ── GET /token ── Get current copilot token ──
    if (url.pathname === '/token') {
      const token = loadToken();
      if (!token?.copilot_token) {
        res.writeHead(401, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Not authenticated' }));
      }
      
      // Refresh if expiring in < 2 minutes
      if (token.expires_at && Date.now() > token.expires_at - 2 * 60 * 1000) {
        if (token.github_token) {
          const refreshed = await refreshCopilotToken(token.github_token);
          if (refreshed) {
            res.writeHead(200, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ token: refreshed.copilot_token }));
          }
        }
      }
      
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ token: token.copilot_token }));
    }
    
    // ── POST /v1/chat/completions ── Proxy to Copilot ──
    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
      const token = loadToken();
      if (!token?.copilot_token) {
        res.writeHead(401, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'Not authenticated. Visit /login first.', type: 'auth_error' } }));
      }
      
      // Refresh if expiring in < 2 minutes
      if (token.expires_at && Date.now() > token.expires_at - 2 * 60 * 1000) {
        if (token.github_token) await refreshCopilotToken(token.github_token);
      }
      
      const freshToken = loadToken();
      let body = '';
      for await (const chunk of req) body += chunk;
      
      // Forward to Copilot API
      const copilotResp = await httpsRequest('https://api.githubcopilot.com/chat/completions', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${freshToken.copilot_token}`,
          'Copilot-Integration-Id': 'vscode-chat',
          'content-type': 'application/json',
          'openai-organization': 'github-copilot'
        }
      }, body);
      
      res.writeHead(copilotResp.status, { 'content-type': 'application/json' });
      return res.end(typeof copilotResp.data === 'string' ? copilotResp.data : JSON.stringify(copilotResp.data));
    }
    
    // ── GET /v1/models ── Proxy models list ──
    if (url.pathname === '/v1/models' && req.method === 'GET') {
      const token = loadToken();
      if (!token?.copilot_token) {
        res.writeHead(401, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: 'Not authenticated' } }));
      }
      
      const copilotResp = await httpsRequest('https://api.githubcopilot.com/models', {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${token.copilot_token}`,
          'Copilot-Integration-Id': 'vscode-chat'
        }
      });
      
      res.writeHead(copilotResp.status, { 'content-type': 'application/json' });
      return res.end(typeof copilotResp.data === 'string' ? copilotResp.data : JSON.stringify(copilotResp.data));
    }
    
    // ── 404 ──
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Error:`, err.message);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

// ─── Startup ─────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`\n🔑 Copilot Auth Server running on port ${PORT}`);
  console.log(`   Status:  http://localhost:${PORT}/`);
  console.log(`   Token:   http://localhost:${PORT}/token`);
  console.log(`   Login:   POST http://localhost:${PORT}/login\n`);
  
  // If we have a saved github token, try to refresh copilot token on startup
  const existing = loadToken();
  if (existing?.github_token) {
    console.log(`[${new Date().toISOString()}] 🔄 Found saved GitHub token, refreshing Copilot token...`);
    refreshCopilotToken(existing.github_token).then(() => startRefreshLoop());
  } else {
    startRefreshLoop();
  }
});
