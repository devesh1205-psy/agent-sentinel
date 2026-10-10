/**
 * Agent Sentinel — Node Module Entrypoint
 * src/index.js
 *
 * Exported programmatic API for use as an npm library in any Node.js application.
 */

'use strict';

const { ThreatHunter } = require('./threats/hunter');
const { InodeProfiler } = require('./threats/inode-profiler');
const { AstAnalyzer } = require('./threats/ast-analyzer');
const { MirageChamber } = require('./threats/mirage-chamber');
const { BehavioralBrain } = require('./threats/behavioral-brain');
const { DeceptionChamber } = require('./threats/deception');
const { WorkspaceInspector } = require('./watcher/inspector');
const { CyberHudServer } = require('./hud/server');
const { DemoArenaHarness, MockSinkServer } = require('./demo/arena-harness');
const { runAgent } = require('./harness/runner');
const { loadConfig, initConfigFile } = require('./config/policy');

module.exports = {
  // Core Security Engines
  ThreatHunter,
  InodeProfiler,
  AstAnalyzer,
  MirageChamber,
  BehavioralBrain,
  DeceptionChamber,

  // Runtime Watcher & Agent Harness
  WorkspaceInspector,
  runAgent,
  loadConfig,
  initConfigFile,

  // HUD & Demonstration Harness
  CyberHudServer,
  DemoArenaHarness,
  MockSinkServer,

  // Convenience Scanner function
  scan: (code, filePath = '', prompt = '') => {
    const hunter = new ThreatHunter();
    return hunter.scan(code, filePath, prompt);
  }
};
