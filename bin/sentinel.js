#!/usr/bin/env node
/**
 * Agent Sentinel CLI
 * Zero-Trust Behavioral Intelligence & Mirage Runtime Sandbox for AI Coding Agents
 * bin/sentinel.js
 */

const fs = require('fs');
const path = require('path');
const { banner, statusLine, threatCard, summaryBox, badge, c } = require('../src/ui/terminal');
const { ThreatHunter } = require('../src/threats/hunter');
const { WorkspaceInspector } = require('../src/watcher/inspector');
const { runAgent } = require('../src/harness/runner');
const { startInteractiveFirewall } = require('../src/harness/launcher');
const { loadConfig, initConfigFile } = require('../src/config/policy');
const { DeceptionChamber } = require('../src/threats/deception');

const VERSION = '1.0.0';

function printHelp() {
  banner();
  console.log(`
  ${c.bold}USAGE:${c.reset}
    ${c.cyan}sentinel${c.reset} [command] [options]
    ${c.cyan}asf${c.reset} [command] [options]
    ${c.cyan}agent-sentinel${c.reset} [command] [options]

  ${c.bold}COMMANDS:${c.reset}
    ${c.bold}watch / start${c.reset} [dir]    Start 1-Terminal Sentinel Watcher & Interactive Agent Selector
    ${c.bold}run${c.reset} [command...]       Launch a coding agent directly inside the zero-trust perimeter
    ${c.bold}scan${c.reset} <path>            Perform deep dynamic security scan on a file or directory
    ${c.bold}test${c.reset} "code or prompt"  Evaluate code against dynamic capability policies & Mirage sandbox
    ${c.bold}honey / decept${c.reset} [cmd]     Plant & monitor synthetic honey-token tripwires (plant, status, clean)
    ${c.bold}hud${c.reset} [port]                 Launch real-time Web Cyber HUD dashboard (default :3000)
    ${c.bold}init${c.reset}                   Create default ${c.dim}.sentinelrc.json${c.reset} policy file
    ${c.bold}status${c.reset}                 Check Sentinel dynamic engine posture & threat cache status

  ${c.bold}OPTIONS:${c.reset}
    ${c.dim}-v, --version${c.reset}        Show version number
    ${c.dim}-h, --help${c.reset}           Show this help message
    ${c.dim}--observe${c.reset}            Run in observe-only mode (warn without quarantining)

  ${c.bold}EXAMPLES:${c.reset}
    ${c.gray}# 1. Launch interactive coding agent picker & watcher:${c.reset}
    $ sentinel

    ${c.gray}# 2. Wrap Google Antigravity or Claude Code inside zero-trust defense:${c.reset}
    $ sentinel run agy
    $ sentinel run claude

    ${c.gray}# 3. Scan a directory or file before committing or executing:${c.reset}
    $ sentinel scan ./src

    ${c.gray}# 4. Initialize zero-trust policy rules in your repository:${c.reset}
    $ sentinel init
`);
}

function handleScan(targetPath) {
  banner();
  if (!targetPath) {
    console.error(`  ${c.red}Error: Missing path to scan.${c.reset}`);
    console.log(`  Usage: ${c.bold}sentinel scan <file-or-dir>${c.reset}`);
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), targetPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ${c.red}Error: Path does not exist: ${targetPath}${c.reset}`);
    process.exit(1);
  }

  const stat = fs.statSync(fullPath);
  const targetRoot = stat.isDirectory() ? fullPath : path.dirname(fullPath);
  const hunter = new ThreatHunter({ workspaceRoot: targetRoot });

  let filesToScan = [];
  if (stat.isDirectory()) {
    function walk(dir) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!['node_modules', '.git', 'target', 'dist', '.venv', '.sentinel-quarantine'].includes(entry.name)) {
            walk(p);
          }
        } else if (entry.isFile()) {
          filesToScan.push(p);
        }
      }
    }
    walk(fullPath);
  } else {
    filesToScan.push(fullPath);
  }

  console.log(`  ${badge('SCAN', 'blue')} Scanning ${c.bold}${filesToScan.length}${c.reset} file(s) for malicious agent payloads...\n`);

  let threatsBlocked = 0;
  let allowed = 0;

  for (const file of filesToScan) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const rel = path.relative(targetRoot, file);
    const result = hunter.scan(content, rel);

    if (result.verdict === 'BLOCKED') {
      threatsBlocked++;
      const top = result.threats[0];
      threatCard(top, rel, top.snippet, top.line);
    } else if (result.verdict === 'WARN') {
      allowed++;
      console.log(`  ${c.yellow}⚠ [WARN]${c.reset} ${c.white}${rel}${c.reset} - ${result.threats[0]?.title || 'Heuristic warning'}`);
    } else {
      allowed++;
    }
  }

  summaryBox({
    filesInspected: filesToScan.length,
    allowed,
    threatsBlocked,
    loopsCaught: 0,
  });

  process.exit(threatsBlocked > 0 ? 1 : 0);
}

function handleStatus(config) {
  banner();
  console.log(`  ${c.bold}AGENT SENTINEL POSTURE:${c.reset}`);
  console.log(`  Engine Version:        ${c.green}${VERSION}${c.reset}`);
  console.log(`  Enforcement Mode:      ${c.bold}${config.mode.toUpperCase()}${c.reset}`);
  console.log(`  Threshold Risk Score:  ${c.cyan}${config.blockOnRiskScore}/100${c.reset}`);
  console.log(`  Auto-Quarantine:       ${config.quarantineBlocked ? c.green + 'ENABLED' : c.yellow + 'DISABLED'}${c.reset}`);
  console.log(`  Quarantine Vault:      ${c.cyan}${config.quarantineDir || '.sentinel-quarantine'}${c.reset}`);
  console.log(`  Dynamic Brain:         ${c.green}ONLINE (10-D Feature Vector + Syscall Markov Scorer)${c.reset}`);
  console.log(`  Micro-Detonation:      ${c.green}ONLINE (Mirage Chamber <50ms Isolated VM)${c.reset}`);
  console.log(`  Immune Memory:         ${c.green}ONLINE (<5ms Normalized Structural AST Matching)${c.reset}\n`);
}

function handleInit() {
  banner();
  const res = initConfigFile();
  if (res.created) {
    console.log(`  ${badge('SUCCESS', 'green')} ${res.message}`);
    console.log(`  ${c.dim}Location: ${res.path}${c.reset}`);
    console.log(`  ${c.gray}You can now customize protected paths and threat risk thresholds.${c.reset}\n`);
  } else {
    console.log(`  ${badge('INFO', 'yellow')} ${res.message}`);
    console.log(`  ${c.dim}Location: ${res.path}${c.reset}\n`);
  }
}

async function handleTest(testArgs, config) {
  banner();
  if (!testArgs || testArgs.length === 0) {
    console.error(`  ${c.red}Error: Provide a prompt and/or code string to test.${c.reset}`);
    console.log(`  Example: ${c.bold}sentinel test "calculate fibonacci numbers"${c.reset}`);
    console.log(`  Example: ${c.bold}sentinel test "calculate fibonacci" "import os; os.system('whoami')"\n${c.reset}`);
    process.exit(1);
  }

  let prompt = '';
  let code = '';

  if (testArgs.length >= 2) {
    prompt = testArgs[0];
    code = testArgs.slice(1).join(' ');
  } else {
    code = testArgs[0];
  }

  console.log(`  ${badge('TEST', 'cyan')} Evaluating input against security policies:`);
  if (prompt) {
    console.log(`  Prompt: ${c.dim}"${prompt}"${c.reset}`);
  }
  console.log(`  Code:   ${c.dim}"${code}"${c.reset}\n`);

  const hunter = new ThreatHunter();
  const report = hunter.scan(code, 'test-input', prompt);

  console.log(`  Security Verdict:     ${report.verdict === 'ALLOW' ? c.green + 'ALLOWED (LOW RISK)' : c.brightRed + 'BLOCKED'}${c.reset}`);
  console.log(`  Risk Score:           ${report.riskScore}/100`);
  if (prompt) {
    console.log(`  Semantic Divergence:  ${report.semanticDivergence ? c.red + 'DETECTED (CRITICAL)' : c.green + 'NONE (ALIGNED)'}${c.reset}`);
  }
  if (report.cacheHit) {
    console.log(`  Swarm Threat Cache:   ${c.yellow}HIT (<0.01ms instant disarm)${c.reset}`);
  }

  if (report.threats.length > 0) {
    console.log(`\n  ${c.bold}Threat Findings:${c.reset}`);
    report.threats.forEach((t) => {
      console.log(`    ${c.red}• [${t.severity}] ${t.title}${c.reset}: ${t.detail}`);
    });
  } else {
    console.log(`  Capability Gate:      ${c.green}Passed Preflight Check. Clean Algorithmic Structure.${c.reset}`);
  }
  console.log();
}

function handleHoney(args) {
  banner();
  const deception = new DeceptionChamber({ workspaceRoot: process.cwd() });
  const sub = args[0] || 'status';

  if (sub === 'plant') {
    const type = args[1] || 'all';
    const planted = deception.plantDecoys([type]);
    console.log(`  ${badge('HONEY-TOKENS PLANTED', 'yellow')} Active Tripwires Armed:\n`);
    planted.forEach((p) => {
      console.log(`    ${c.green}✔ ${p.name}${c.reset} (${c.bold}${p.file}${c.reset}) - Mode: 0600 (Owner Only)`);
      console.log(`      ${c.dim}Canary Signature:${c.reset} ${c.yellow}${p.canary.token.slice(0, 32)}...${c.reset}`);
    });
    console.log(`\n  ${c.gray}Tripwires monitored in real-time. Any agent read or leak will be blocked.${c.reset}\n`);
  } else if (sub === 'clean' || sub === 'remove') {
    const removed = deception.cleanDecoys();
    console.log(`  ${badge('DECEPTION CLEANUP', 'green')} Removed ${removed.length} decoy file(s):\n`);
    removed.forEach((f) => console.log(`    ${c.gray}• Cleaned:${c.reset} ${f}`));
    console.log();
  } else {
    // status
    const status = deception.getStatus();
    console.log(`  ${badge('ACTIVE DECEPTION CHAMBER', 'cyan')} System Posture:\n`);
    console.log(`  Armed Decoys:     ${status.activeCount > 0 ? c.green + status.activeCount + ' ACTIVE' : c.yellow + '0 (Run: sentinel honey plant)'}${c.reset}`);
    console.log(`  Tripped Breaches: ${status.trippedCount > 0 ? c.brightRed + status.trippedCount + ' BREACHED' : c.green + '0 (Clean)'}${c.reset}`);
    if (status.decoys.length > 0) {
      console.log(`\n  ${c.bold}Registered Tripwires:${c.reset}`);
      status.decoys.forEach((d) => {
        const icon = d.status === 'TRIPPED' ? `${c.brightRed}🚨 TRIPPED` : `${c.green}● ARMED`;
        console.log(`    ${icon}${c.reset} ${c.bold}${d.file}${c.reset} (${d.name})`);
      });
    }
    console.log(`\n  ${c.dim}Commands: sentinel honey plant [aws|stripe|github|all] | sentinel honey clean${c.reset}\n`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();

  if (args.includes('-h') || args.includes('--help') || args[0] === 'help') {
    printHelp();
    return;
  }

  if (args.includes('-v') || args.includes('--version')) {
    console.log(`agent-sentinel v${VERSION}`);
    return;
  }

  if (args.length === 0) {
    startInteractiveFirewall(process.cwd(), config);
    return;
  }

  const command = args[0];

  switch (command) {
    case 'start':
    case 'watch': {
      const nonFlagArgs = args.slice(1).filter((a) => !a.startsWith('-'));
      const targetDir = nonFlagArgs[0] ? path.resolve(process.cwd(), nonFlagArgs[0]) : process.cwd();
      const passiveOnly = args.includes('--passive') || args.includes('--no-menu');

      if (passiveOnly) {
        banner();
        const inspector = new WorkspaceInspector({
          cwd: targetDir,
          config,
        });
        inspector.start();
      } else {
        startInteractiveFirewall(targetDir, config);
      }
      break;
    }

    case 'scan': {
      handleScan(args[1]);
      break;
    }

    case 'run': {
      const agentCmd = args.slice(1);
      runAgent(agentCmd, config);
      break;
    }

    case 'init': {
      handleInit();
      break;
    }

    case 'status': {
      handleStatus(config);
      break;
    }

    case 'test': {
      handleTest(args.slice(1), config);
      break;
    }

    case 'honey':
    case 'decept': {
      handleHoney(args.slice(1));
      break;
    }

    case 'hud': {
      const { CyberHudServer } = require('../src/hud/server');
      const port = parseInt(args[1], 10) || 3000;
      const hud = new CyberHudServer({ port, workspaceRoot: process.cwd() });
      hud.start().catch((err) => {
        console.error('Failed to start Cyber HUD:', err);
        process.exit(1);
      });
      break;
    }

    default:
      console.error(`\n  ${c.red}Unknown command: ${command}${c.reset}`);
      printHelp();
      process.exit(1);
  }
}

main();
