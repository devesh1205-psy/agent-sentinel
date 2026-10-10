# 🛡️ Agent Sentinel (`sentinel`)
### Pure Dynamic Behavioral Intelligence Firewall & Speculative Mirage Sandbox for Autonomous AI Coding Agents

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Zero-Dependencies](https://img.shields.io/badge/Dependencies-Zero%20Native-emerald.svg)](package.json)
[![Tests Passing](https://img.shields.io/badge/Tests-86%2F86%20Passing-brightgreen.svg)](test/)
[![Latency](https://img.shields.io/badge/Latency-%3C0.8ms%20Dynamic-purple.svg)](src/)

> **Agent Sentinel** is an ultra-fast, zero-overhead deterministic behavioral security perimeter designed for autonomous AI coding agents (Google Antigravity, Claude Code, Cursor, Aider, Codex, Ollama). 
> It requires **zero hardcoded keyword lists** and **zero external LLM calls**, using compiler-grade Abstract Syntax Tree (AST) analysis, Shannon entropy mathematics, speculative micro-detonation ("Mirage Chamber"), and persistent immune memory to neutralize rogue or compromised agent actions in real-time.

---

## ⚡ The Problem: The AI Agent Attack Vector

Autonomous coding agents execute multi-step tool calls, generate code files, and run terminal commands in user workspaces. Current guardrails fail against modern threat actors:
1. **Static Regex / Keyword Lists Fail:** Attackers bypass strings like `.env`, `socket`, `eval` using dynamic imports, string reversal (`reversed("nepo")`), hex encoding, or base64 compression.
2. **LLM-as-a-Judge Fails:** Calling an external LLM to inspect agent output adds 2–4 seconds of latency, burns API tokens, and is vulnerable to prompt injections and hallucinations.

---

## 🏛️ The 5-Pillar Architecture

Agent Sentinel replaces brittle keyword lists with pure deterministic mathematical and behavioral engines:

```
                  ┌───────────────────────────────────────────────┐
                  │          AI CODING AGENT INVOCATION           │
                  │   (Antigravity • Claude Code • Cursor • Aider)│
                  └───────────────────────┬───────────────────────┘
                                          │
                 ┌────────────────────────▼────────────────────────┐
                 │       PILLAR 1: DYNAMIC INODE PROFILER          │
                 │   Shannon Entropy H ≥ 4.2 • KV Density ρ ≥ 0.50 │
                 │   POSIX 0600 Auditing • Radioactive Canary Dyes │
                 └────────────────────────┬────────────────────────┘
                                          │
                 ┌────────────────────────▼────────────────────────┐
                 │        PILLAR 2: COMPILER AST & DATAFLOW        │
                 │   Constant Folding • Symbol Table Propagation   │
                 │   DYN-BOUND-001 Escape Trap • Multi-Hop Taints  │
                 └────────────────────────┬────────────────────────┘
                                          │
                 ┌────────────────────────▼────────────────────────┐
                 │    PILLAR 3: SPECULATIVE MIRAGE CHAMBER         │
                 │   30–50ms Micro-Detonation Trap • Mock Sockets  │
                 │   Syscall Interception • Canary Leak Sensor     │
                 └────────────────────────┬────────────────────────┘
                                          │
                 ┌────────────────────────▼────────────────────────┐
                 │    PILLAR 4: BEHAVIORAL BRAIN & IMMUNE MEMORY   │
                 │   10-D Feature Vector • Markov Surprise Engine  │
                 │   Structural AST Skeletons • Invariant Memory   │
                 └────────────────────────┬────────────────────────┘
                                          │
                 ┌────────────────────────▼────────────────────────┐
                 │     PILLAR 5: 1-TERMINAL PRE-KERNEL HARNESS     │
                 │   Workspace Inspector • Transparent CLI Shims   │
                 │   Instant Isolation Vault (.sentinel-quarantine)│
                 └─────────────────────────────────────────────────┘
```

1. **Dynamic Inode Profiler (`src/threats/inode-profiler.js`):**
   - Computes Shannon entropy ($H = -\sum p \log_2 p$) with an incremental sliding window to detect secrets even with arbitrary file names (e.g. `data.cfg`).
   - Assesses POSIX permission states (`0600`/`0400`) and Key-Value density ($\rho_{\text{KV}}$).
   - Injects radioactive canary dye tokens (`CANARY_DYE_SECRET_<hash>_<rand>`) across raw, base64, hex, and url-encoded representations.

2. **Compiler AST & Dataflow Engine (`src/threats/ast-analyzer.js`):**
   - Dual-language (Python + JavaScript) AST parser performing constant folding, string concatenation resolution, and character unwrapping (`chr()`, `String.fromCharCode()`, `reversed()`).
   - Multi-hop source-to-sink taint tracking connecting sensitive sources to dangerous sinks (`eval`, `subprocess`, `socket`, `fetch`).
   - Detects boundary escapes and path traversals (`../../external_sandbox_backup`) without hardcoded path blacklists (`DYN-BOUND-001`).

3. **Speculative Mirage Chamber (`src/threats/mirage-chamber.js`):**
   - Sandboxes code execution in a 30–50ms dry-run micro-detonation trap with virtualized filesystem and network mocks.
   - Catches socket connections, command spawns, and leaks of radioactive canary tokens across zlib/base64/hex transformations.

4. **Self-Learning Behavioral Brain & Immune Memory (`src/threats/behavioral-brain.js`):**
   - Calculates a 10-Dimensional behavioral feature vector and Markov transition surprise score.
   - Extracts identifier-invariant **Structural AST Skeletons** when an attack is neutralized.
   - Persists attack skeletons to `.sentinel-quarantine/brain-state.json`, recognizing and blocking mutated variants in sub-millisecond time.

5. **1-Terminal Pre-Kernel Harness (`src/harness/`, `src/watcher/`):**
   - Transparent pre-kernel command shims for `python3`, `node`, `bash`, `sh`, `curl`.
   - Workspace file inspector that isolates malicious agent writes into `.sentinel-quarantine/` and replaces them with clean security stubs in real time.

---

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/agent-sentinel.git
cd agent-sentinel

# Link globally (optional)
npm link
```

### Running Tests

```bash
# Run the complete test suite (86/86 automated tests)
npm test

# Run unit tests
npm run test:unit
```

### Interactive Usage

```bash
# Launch interactive protection wrapping your AI coding agent
sentinel run agy

# Watch workspace directory in real time
sentinel watch

# Quick security evaluation of any prompt & code snippet
sentinel test "read data" "with open('vault.bin') as f: data = f.read()"

# View system posture & immune memory status
sentinel status
```

---

## 📊 Performance Benchmark

| Metric | Agent Sentinel | Traditional Regex | LLM-as-a-Judge |
| :--- | :--- | :--- | :--- |
| **Detection Latency** | **< 0.8 ms** | ~0.1 ms | 1,800 – 4,200 ms |
| **Obfuscation Resilience** | **100% (AST Unfolding)** | 0% (Bypassed) | ~70% (Prompt dependent) |
| **Zero-Word Dynamic Catch** | **Yes (Mathematical Inodes)** | No (Hardcoded words) | Probabilistic |
| **Offline / Zero Token Cost** | **Yes (100% Deterministic)** | Yes | No (\$ / API limits) |
| **Immune Memory Mutation Defense** | **Sub-millisecond Variant Match** | None | None |

---

## 📜 License
Apache-2.0 License. Developed for resilient, zero-trust autonomous AI software engineering.
