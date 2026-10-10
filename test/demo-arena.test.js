/**
 * Live AI Attack Arena Test Suite
 * test/demo-arena.test.js
 *
 * Implements automated verification for Live AI Attack Arena:
 * - Test 1: Scenario A runs with ALLOW decision and legitimate operation completes.
 * - Test 2: Scenario B runs with BLOCKED policy decision.
 * - Test 3: Programmatic proof that mock network sink received ZERO bytes of sensitive data.
 * - Test 4: All 5 security pillars emit genuine events during Scenario B.
 * - Test 5: Event stream emits schema-compliant events with all 8 required fields.
 * - Test 6: Risk score for Scenario B exceeds threshold (>= 80).
 * - Test 7: Risk score for Scenario A remains below threshold (< 50).
 * - Test 8: Repeating Scenario B produces consistent blocking decisions and updates immune memory.
 * - Test 9: Reset function cleanly restores initial state between runs.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const { DemoArenaHarness, MockSinkServer } = require('../src/demo/arena-harness');

describe('Live AI Attack Arena — Automated Demonstration Test Suite', () => {
  let harness;

  before(async () => {
    harness = new DemoArenaHarness({ streamDelay: 0 });
    await harness.init();
  });

  after(async () => {
    if (harness) {
      await harness.close();
    }
  });

  // Test 1
  it('Test 1: Run Scenario A and verify policy decision is ALLOW and operation completes', async () => {
    const result = await harness.runScenarioA();
    assert.strictEqual(result.verdict, 'ALLOW', `Expected ALLOW verdict for Scenario A, got ${result.verdict}`);
    assert.strictEqual(result.completed, true, 'Scenario A legitimate task must complete successfully');
    assert.strictEqual(result.secretExfiltrated, false, 'Scenario A must never exfiltrate secrets');

    const outputExists = fs.existsSync(path.join(harness.arenaDir, 'metrics_report.txt'));
    assert.ok(outputExists, 'Output report file must be written for legitimate task');
  });

  // Test 2
  it('Test 2: Run Scenario B and verify policy decision is BLOCKED', async () => {
    const result = await harness.runScenarioB();
    assert.strictEqual(result.verdict, 'BLOCKED', `Expected BLOCKED verdict for Scenario B, got ${result.verdict}`);
    assert.strictEqual(result.quarantined, true, 'Scenario B attack file must be marked quarantined');
  });

  // Test 3
  it('Test 3: Programmatically verify that the mock network sink received ZERO bytes of sensitive data during Scenario B', async () => {
    const sinkBytes = harness.mockSink.receivedBytes;
    const hasSecret = harness.mockSink.hasReceivedSecret('FAKE_SECRET_12345');
    const payloadsCount = harness.mockSink.receivedPayloads.length;

    assert.strictEqual(sinkBytes, 0, `Expected 0 bytes received at mock sink, got ${sinkBytes}`);
    assert.strictEqual(payloadsCount, 0, `Expected 0 payloads received at mock sink, got ${payloadsCount}`);
    assert.strictEqual(hasSecret, false, 'Target secret FAKE_SECRET_12345 must NEVER reach the sink');
  });

  // Test 4
  it('Test 4: Verify that each of the 5 security pillars emitted at least one genuine event during Scenario B', async () => {
    const result = await harness.runScenarioB();
    const emittedPillars = new Set(result.events.map(e => e.pillar));

    for (let p = 1; p <= 5; p++) {
      assert.ok(emittedPillars.has(p), `Scenario B must emit at least one genuine event from Pillar ${p}`);
    }
  });

  // Test 5
  it('Test 5: Verify that the event stream emits properly formatted events matching the required schema', async () => {
    const result = await harness.runScenarioB();
    assert.ok(result.events.length >= 5, 'Must emit at least 5 structured events');

    const requiredKeys = ['runId', 'timestamp', 'pillar', 'event', 'severity', 'message', 'evidence', 'decision'];
    const validSeverities = ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const validDecisions = ['ALLOW', 'BLOCKED', 'ANALYZING'];

    for (const ev of result.events) {
      for (const key of requiredKeys) {
        assert.ok(ev[key] !== undefined, `Event must contain field: ${key}`);
      }
      assert.strictEqual(typeof ev.runId, 'string', 'runId must be string');
      assert.ok(!isNaN(Date.parse(ev.timestamp)), 'timestamp must be valid ISO date string');
      assert.ok(typeof ev.pillar === 'number' && ev.pillar >= 1 && ev.pillar <= 5, 'pillar must be integer 1-5');
      assert.strictEqual(typeof ev.event, 'string', 'event must be string');
      assert.ok(validSeverities.includes(ev.severity), `severity must be one of ${validSeverities.join(',')}`);
      assert.strictEqual(typeof ev.message, 'string', 'message must be string');
      assert.strictEqual(typeof ev.evidence, 'object', 'evidence must be object');
      assert.ok(validDecisions.includes(ev.decision), `decision must be one of ${validDecisions.join(',')}`);
    }
  });

  // Test 6
  it('Test 6: Verify that the risk score for Scenario B exceeds the blocking threshold (>=80)', async () => {
    const result = await harness.runScenarioB();
    assert.ok(
      result.riskScore >= 80,
      `Scenario B risk score must exceed blocking threshold (>= 80), received: ${result.riskScore}`
    );
  });

  // Test 7
  it('Test 7: Verify that the risk score for Scenario A remains below the threshold (<50)', async () => {
    const result = await harness.runScenarioA();
    assert.ok(
      result.riskScore < 50,
      `Scenario A risk score must be benign (< 50), received: ${result.riskScore}`
    );
  });

  // Test 8
  it('Test 8: Verify that repeating Scenario B produces consistent blocking decisions and updates immune memory', async () => {
    const run1 = await harness.runScenarioB();
    const run2 = await harness.runScenarioB();

    assert.strictEqual(run1.verdict, 'BLOCKED', 'First Scenario B run must be BLOCKED');
    assert.strictEqual(run2.verdict, 'BLOCKED', 'Second Scenario B run must also be consistently BLOCKED');
    assert.ok(run1.riskScore >= 80, 'Run 1 risk score must be >= 80');
    assert.ok(run2.riskScore >= 80, 'Run 2 risk score must be >= 80');

    // Verify immune memory has indexed the threat skeleton
    const skeletons = harness.hunter.brain.state.structuralSkeletons;
    const skeletonKeys = Object.keys(skeletons || {});
    assert.ok(skeletonKeys.length > 0, 'Immune memory must contain learned structural skeletons');
  });

  // Test 9
  it('Test 9: Verify that the reset function restores clean state between runs', async () => {
    // Run scenario B to populate state
    await harness.runScenarioB();
    assert.ok(harness.activeRuns.size > 0, 'Active runs should have entries before reset');

    // Perform clean reset
    harness.reset();

    assert.strictEqual(harness.activeRuns.size, 0, 'Active runs map must be cleared after reset');
    assert.strictEqual(harness.mockSink.receivedBytes, 0, 'Mock sink receivedBytes must be reset to 0');
    assert.strictEqual(harness.mockSink.receivedPayloads.length, 0, 'Mock sink payloads array must be empty');

    // Verify arena workspace is cleanly re-initialized
    const vaultPath = path.join(harness.arenaDir, 'vault', 'fake_secret.env');
    assert.ok(fs.existsSync(vaultPath), 'Clean vault file must be re-seeded');
  });
});
