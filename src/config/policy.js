/**
 * Policy & Configuration Manager for Agent Sentinel
 * src/config/policy.js
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  version: '1.0.0',
  mode: 'enforce', // 'enforce' (block & quarantine) or 'observe' (log-only)
  blockOnRiskScore: 80,
  quarantineBlocked: true,
  quarantineDir: '.sentinel-quarantine',
  soundAlerts: false,
  ignoredPaths: [
    'node_modules/**',
    '.git/**',
    'target/**',
    'dist/**',
    'build/**',
    '.venv/**',
    '__pycache__/**',
    '.sentinel-quarantine/**',
  ],
  protectedPaths: [
    '.env',
    '.env.*',
    '**/.ssh/**',
    '**/id_rsa*',
    'package.json',
    'Cargo.toml',
  ],
  customAgents: [
    {
      name: 'Antigravity',
      cmd: 'agy',
    },
  ],
};

function loadConfig(cwd = process.cwd()) {
  const configPath = path.join(cwd, '.sentinelrc.json');
  if (fs.existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return { ...DEFAULT_CONFIG, ...userConfig };
    } catch {
      console.warn('[sentinel] Warning: Could not parse .sentinelrc.json, using defaults.');
    }
  }
  return DEFAULT_CONFIG;
}

function saveCustomAgent(agentObj, cwd = process.cwd()) {
  const configPath = path.join(cwd, '.sentinelrc.json');
  const current = loadConfig(cwd);
  const customAgents = Array.isArray(current.customAgents) ? [...current.customAgents] : [];
  customAgents.push(agentObj);
  const updated = { ...current, customAgents };
  try {
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

function initConfigFile(cwd = process.cwd()) {
  const configPath = path.join(cwd, '.sentinelrc.json');
  if (fs.existsSync(configPath)) {
    return { created: false, path: configPath, message: '.sentinelrc.json already exists.' };
  }
  fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
  return { created: true, path: configPath, message: 'Created default .sentinelrc.json' };
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  saveCustomAgent,
  initConfigFile,
};
