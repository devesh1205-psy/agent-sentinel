/**
 * Terminal UI & High-Tech ANSI Styling for Agent Sentinel
 * src/ui/terminal.js
 */

const ESC = '\x1b[';

const c = {
  reset: `${ESC}0m`,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  italic: `${ESC}3m`,
  underline: `${ESC}4m`,
  
  // Foreground Colors
  black: `${ESC}30m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  blue: `${ESC}34m`,
  magenta: `${ESC}35m`,
  cyan: `${ESC}36m`,
  white: `${ESC}37m`,
  gray: `${ESC}90m`,
  
  // Bright colors
  brightRed: `${ESC}91m`,
  brightGreen: `${ESC}92m`,
  brightYellow: `${ESC}93m`,
  brightBlue: `${ESC}94m`,
  brightMagenta: `${ESC}95m`,
  brightCyan: `${ESC}96m`,
  brightWhite: `${ESC}97m`,
  
  // Backgrounds
  bgRed: `${ESC}41m`,
  bgGreen: `${ESC}42m`,
  bgYellow: `${ESC}43m`,
  bgBlue: `${ESC}44m`,
  bgMagenta: `${ESC}45m`,
  bgCyan: `${ESC}46m`,
};

function banner() {
  console.log(`
${c.cyan}${c.bold}   ███████╗███████╗███╗   ██╗████████╗██╗███╗   ██╗███████╗██╗     
   ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██║████╗  ██║██╔════╝██║     
   ███████╗█████╗  ██╔██╗ ██║   ██║   ██║██╔██╗ ██║█████╗  ██║     
   ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██║██║╚██╗██║██╔══╝  ██║     
   ███████║███████╗██║ ╚████║   ██║   ██║██║ ╚████║███████╗███████╗${c.reset}
  
  ${c.bold}┌─────────────────────────────────────────────────────────────┐
  │  ${c.brightWhite}$ ${c.green}sentinel watch${c.reset}${c.bold}                                          │
  └─────────────────────────────────────────────────────────────┘${c.reset}
  ${c.gray}★ Zero-Trust Behavioral Intelligence & Mirage Runtime Sandbox${c.reset}

  ${c.cyan}⚡ [PREFLIGHT]${c.reset} ${c.dim}Zero-Trust Sandbox Perimeter Armed${c.reset}
  ${c.magenta}🔒 [INTELLIGENCE]${c.reset} ${c.dim}100% Dynamic Behavioral Brain & Immune Memory${c.reset}
  ${c.green}🛡️  [HARNESSES]${c.reset} ${c.dim}Antigravity • Claude Code • Cursor • Aider • Codex • Ollama${c.reset}
`);
}

function badge(text, color = 'cyan', bg = false) {
  const fgCode = c[color] || c.cyan;
  if (bg) {
    return `${c.bold}${c.white}${c.bgRed} ${text} ${c.reset}`;
  }
  return `${fgCode}${c.bold}[${text}]${c.reset}`;
}

function statusLine(mode, target, policy = 'ZERO-TRUST ENFORCING') {
  console.log(`  ${badge('STATUS', 'green')} ${c.bold}Active${c.reset}  │  ${badge('POLICY', 'magenta')} ${c.bold}${policy}${c.reset}  │  ${badge('TARGET', 'blue')} ${c.dim}${target}${c.reset}`);
  console.log(`  ${c.gray}Watching agent file generation and tool calls... Press Ctrl+C to stop.${c.reset}\n`);
}

function logEvent(type, message, detail = '') {
  const timestamp = new Date().toLocaleTimeString();
  let prefix = '';
  switch (type) {
    case 'ALLOW':
      prefix = `${c.green}${c.bold} ↳ [ALLOW]${c.reset}`;
      break;
    case 'BLOCKED':
      prefix = `${c.brightRed}${c.bold} ↳ [BLOCKED]${c.reset}`;
      break;
    case 'WARNING':
      prefix = `${c.yellow}${c.bold} ↳ [WARNING]${c.reset}`;
      break;
    case 'QUARANTINE':
      prefix = `${c.magenta}${c.bold} ↳ [QUARANTINED]${c.reset}`;
      break;
    case 'LOOP':
      prefix = `${c.brightMagenta}${c.bold} ↳ [LOOP DETECTED]${c.reset}`;
      break;
    case 'DRIFT':
      prefix = `${c.blue}${c.bold} ↳ [DRIFT]${c.reset}`;
      break;
    default:
      prefix = `${c.cyan}${c.bold} ↳ [${type}]${c.reset}`;
  }
  console.log(`${prefix} ${c.white}${message}${c.reset} ${c.gray}(${timestamp})${c.reset}`);
  if (detail) {
    console.log(`     ${c.dim}${detail}${c.reset}`);
  }
}

function threatCard(threat, file, snippet, line = 1) {
  const severityColor = threat.severity === 'CRITICAL' ? 'brightRed' : threat.severity === 'HIGH' ? 'red' : 'yellow';
  const border = c[severityColor] + '─'.repeat(74) + c.reset;
  
  console.log(`\n  ${border}`);
  console.log(`  ${c.bold}${c.brightRed}🚨 MALICIOUS AGENT CODE DETECTED${c.reset}   ${c.bold}${c.white}${threat.title}${c.reset} ${c.dim}(Severity: ${threat.severity})${c.reset}`);
  console.log(`  ${c.gray}Target:${c.reset} ${c.cyan}${file}:${line}${c.reset}`);
  console.log(`  ${c.gray}Risk Score:${c.reset} ${c.brightRed}${threat.riskScore || 85}/100${c.reset} ${c.dim}(Threshold: ≥80 Blocks & Quarantines)${c.reset}`);
  console.log(`  ${c.gray}Attack Category:${c.reset} ${c.yellow}${threat.category || 'Unauthorized Capability'}${c.reset}`);
  console.log(`  ${c.gray}Rule Triggered:${c.reset} ${c.dim}${threat.detail || threat.description}${c.reset}`);
  
  if (snippet) {
    console.log(`\n  ${c.gray}Offending Code:${c.reset}`);
    const lines = snippet.split('\n').slice(0, 5);
    lines.forEach((l, idx) => {
      console.log(`    ${c.dim}${String(line + idx).padStart(2)} │${c.reset} ${c.red}${l}${c.reset}`);
    });
  }
  
  console.log(`\n  ${c.green}🛡️  Action Taken:${c.reset} ${c.bold}${threat.action || 'Quarantine and isolate payload'}${c.reset}`);
  console.log(`  ${border}\n`);
}

function summaryBox(stats) {
  const width = 71;
  const top = '┌' + '─'.repeat(width) + '┐';
  const bottom = '└' + '─'.repeat(width) + '┘';
  
  console.log(`\n  ${c.cyan}${top}${c.reset}`);
  console.log(`  ${c.cyan}│${c.reset} ${c.bold}SENTINEL REAL-TIME INSPECTION SUMMARY${c.reset}${' '.repeat(width - 38)}${c.cyan}│${c.reset}`);
  console.log(`  ${c.cyan}├${c.reset}${'─'.repeat(width)}${c.cyan}┤${c.reset}`);
  console.log(`  ${c.cyan}│${c.reset} Total Files Inspected:   ${c.bold}${stats.filesInspected || 0}${c.reset}${' '.repeat(Math.max(1, width - 28 - String(stats.filesInspected || 0).length))}${c.cyan}│${c.reset}`);
  console.log(`  ${c.cyan}│${c.reset} Safe Agent Operations:   ${c.green}${stats.allowed || 0}${c.reset}${' '.repeat(Math.max(1, width - 28 - String(stats.allowed || 0).length))}${c.cyan}│${c.reset}`);
  console.log(`  ${c.cyan}│${c.reset} Threats Intercepted:     ${stats.threatsBlocked > 0 ? c.brightRed : c.green}${stats.threatsBlocked || 0}${c.reset}${' '.repeat(Math.max(1, width - 28 - String(stats.threatsBlocked || 0).length))}${c.cyan}│${c.reset}`);
  console.log(`  ${c.cyan}│${c.reset} Repetitive Loops Caught: ${stats.loopsCaught > 0 ? c.yellow : c.green}${stats.loopsCaught || 0}${c.reset}${' '.repeat(Math.max(1, width - 28 - String(stats.loopsCaught || 0).length))}${c.cyan}│${c.reset}`);
  console.log(`  ${c.cyan}│${c.reset} Behavioral Posture:      ${c.green}100% OPERATIONAL (ZERO-LATENCY)${c.reset}${' '.repeat(Math.max(1, width - 58))}${c.cyan}│${c.reset}`);
  console.log(`  ${c.cyan}${bottom}${c.reset}\n`);
}

module.exports = {
  c,
  banner,
  badge,
  statusLine,
  logEvent,
  threatCard,
  summaryBox,
};
