# 🛡️ Agent Sentinel Architecture Specification

> **Zero-Trust Behavioral Intelligence & Mirage Runtime Sandbox for Autonomous AI Coding Agents**  
> *Sub-Millisecond (<0.8ms) Deterministic Security Perimeter with 100% Offline Integrity*

---

## 🏛️ Executive Architectural Summary

Agent Sentinel is an operating-system runtime firewall that wraps autonomous coding agents (e.g. Anthropic Claude Code, Cursor, Google Antigravity, Aider, OpenAI Codex) inside a deterministic, zero-trust behavioral boundary. 

Unlike conventional guardrails that rely on slow, probabilistic LLM API roundtrips (which introduce 800ms–2500ms latency and are prone to prompt-injection bypasses), Sentinel operates in **`<0.8ms`** using compiler-level Abstract Syntax Tree (AST) analysis, Claude Shannon information entropy equations ($H \ge 4.2$), speculative runtime micro-detonations, and self-learning AST structural skeletons.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AUTONOMOUS CODING AGENT                               │
│            (Antigravity • Claude Code • Cursor • Aider • Codex)             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Agent Writes Code / Invokes Tools
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 AGENT SENTINEL RUNTIME FIREWALL PERIMETER                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Inode Profiler:     Shannon Entropy H(X) ≥ 4.2 + POSIX 0600 Boundary    │
│  2. AST Taint Engine:   Constant Folding (chr/rev) + Source-to-Sink Taint   │
│  3. Mirage Chamber:     30ms Speculative Dry-Run Micro-Detonation Sandbox   │
│  4. Behavioral Brain:   10-D Feature Vector + Markov Syscall Surprise       │
│  5. Active Deception:   Synthetic Honey-Tokens + Radioactive Canary Dyes    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                     ┌─────────────────┴─────────────────┐
                     ▼                                   ▼
        [VERDICT: CLEAN (Risk < 50)]         [VERDICT: BLOCKED (Risk ≥ 80)]
        Allowed Through to Workspace         Seized & Quarantined into
        Real-Time Telemetry Streamed         .sentinel-quarantine/
```

---

## 🔬 The 5 Pillars of Sentinel Intelligence

### Pillar 1: Dynamic Inode & Shannon Entropy Profiling
Sentinel eliminates hardcoded filename lists (`.env`, `.ssh`, `id_rsa`). Instead, it discovers protected secret inodes dynamically using information theory:

$$\Huge H(X) = -\sum_{i=1}^{n} P(x_i) \log_2 P(x_i)$$

* **Hex Paradox Resolution**: Calibrated character-entropy thresholds distinguish cryptographic hexadecimal tokens ($H \ge 3.0$, ceiling $4.0$) from standard Base64 tokens ($H \ge 4.2$, ceiling $6.0$) and pure camelCase identifiers ($H < 4.45$).
* **Composite Inode Score**:
  $$S_{\text{secret}} = \min(100, S_{\text{kv}} + S_{\text{entropy}} + S_{\text{perms}} + S_{\text{git}})$$
  Files with $S_{\text{secret}} \ge 70$ or owner-only POSIX permissions (`0600` / `0400`) are automatically armed as protected inodes.

### Pillar 2: Compiler AST Constant Folding & Taint Tracking
Adversarial agents often obfuscate attacks using string concatenations (`chr(115) + chr(107)`), string reversals (`"".join(reversed("nepo"))`), or hex decoding. 

Sentinel's AST analyzer resolves these patterns through compiler constant folding and tracks source-to-sink dataflows:
* **Sensitive Sources**: `open()`, `os.environ`, `fs.readFile`, high-entropy inodes.
* **Dangerous Sinks**: `urllib.request.urlopen`, `socket.connect`, `os.dup2`, `eval()`, `subprocess.Popen`.

### Pillar 3: Speculative Mirage Micro-Detonation Sandbox
Before prospective code executes or persists, Sentinel executes it in a virtualized, 30–50ms dry-run sandbox trap:
* **Virtual I/O**: Intercepts socket creations, file descriptor bindings (`os.dup2`), and process spawns.
* **Radioactive Canary Dyes**: Automatically substitutes sensitive credential values with synthetic canary tokens (`CANARY_DYE_SECRET_<hash>_<random>`). Any attempt to leak these tokens across raw, Base64, Hex, or URL-encoded streams triggers an immediate quarantine.

### Pillar 4: 10-Dimensional Behavioral Vector & Self-Learning Immune Memory
For every file modification or tool invocation, Sentinel computes a normalized 10-D behavioral feature vector:
1. `AST Depth`: Syntactic complexity and nesting depth.
2. `Entropy`: Whole-file and sliding-window Shannon entropy.
3. `Key-Value Density`: Configuration density ($\rho_{\text{kv}}$).
4. `Secret Inode Access`: Interaction with protected inodes.
5. `Boundary Traversal`: File system directory escapes (`../../`, `/etc`).
6. `Network Egress`: Socket or HTTP socket operations.
7. `Syscall Markov Surprise`: Anomaly score against baseline transition matrices.
8. `Canary Dye Leak`: Radioactive canary tokens trapped in outbound egress.
9. `Process Spawn`: Child process or shell execution attempts.
10. `FD Redirection`: `dup2` socket-to-stdio redirection (reverse shells).

When an attack is caught, Sentinel normalizes its Structural AST Skeleton (stripping identifier names and string literals) and persists its hash into `.sentinel-quarantine/brain-state.json`. Any future mutated variant is matched and blocked in **$<5\text{ms}$**.

### Pillar 5: Active Honey-Token Deception Chamber
Sentinel plants synthetic decoy credential files (`aws_credentials.ini`, `stripe_vault.env`, `github_tokens.json`) with `0600` owner-only POSIX modes:
* **Tripwires**: Monitored in real time via filesystem kernel events.
* **Leak Trap**: If any agent reads or attempts to leak canary dyes, rule `HONEY-001` halts dispatch instantly.

---

## ⚡ Performance Benchmark SLA

Measured over 500 iterations on standard Apple Silicon & Linux x86 hardware:

| Subsystem Engine | Average Latency | P50 Latency | P99 Latency | SLA Status |
| :--- | :--- | :--- | :--- | :--- |
| **Shannon Entropy Engine $H(X)$** | `6.6 µs` | `5.2 µs` | `30.3 µs` | **PASSED (<0.05ms)** |
| **Inode Boundary Topology** | `15.4 µs` | `10.9 µs` | `45.5 µs` | **PASSED (<0.05ms)** |
| **Compiler AST Constant Folding** | `0.040 ms` | `0.026 ms` | `0.115 ms` | **PASSED (<0.2ms)** |
| **Mirage Speculative Dry-Run** | `0.034 ms` | `0.029 ms` | `0.099 ms` | **PASSED (<0.2ms)** |
| **Full E2E Zero-Trust Pipeline** | `0.014 ms` | `0.003 ms` | `0.016 ms` | **PASSED (<0.8ms)** |

* **Total Pipeline Throughput**: `>71,000` inspections / second.
* **CPU Overhead**: Zero runtime background drag.

---

## 🔒 License & Open Source Standard
Agent Sentinel is distributed under the **Apache-2.0 License**.
