import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { evaluateReleaseGate, REQUIRED_GATES } from '../release-gate.mjs';

let dir;
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); dir = undefined; });

async function createEvidence(gate, overrides = {}) {
  const evidenceFile = `${gate}.log`;
  const bytes = Buffer.from(`verified evidence for ${gate}`);
  await writeFile(path.join(dir, evidenceFile), bytes);
  const manifest = {
    gate, status: 'PASS', releaseVersion: '1.3.1', commit: 'abc123',
    verifier: 'CI', testSuite: `suite:${gate}`, executedAt: new Date('2026-11-01T12:00:00Z').toISOString(),
    evidenceFile, evidenceSha256: createHash('sha256').update(bytes).digest('hex'), ...overrides,
  };
  await writeFile(path.join(dir, `${gate}.json`), JSON.stringify(manifest));
}

describe('fail-closed production release gate', () => {
  it('blocks when evidence is missing', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'adpulse-gate-'));
    const report = await evaluateReleaseGate({ evidenceDir: dir, version: '1.3.1', commit: 'abc123', now: new Date('2026-11-01T12:01:00Z') });
    assert.equal(report.status, 'NO_GO');
    assert.equal(report.passed, 0);
    assert.equal(report.required, 10);
  });
  it('blocks if even one check is not PASS', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'adpulse-gate-'));
    for (const gate of REQUIRED_GATES) await createEvidence(gate, gate === 'billing' ? { status: 'REVIEW' } : {});
    const report = await evaluateReleaseGate({ evidenceDir: dir, version: '1.3.1', commit: 'abc123', now: new Date('2026-11-01T12:01:00Z') });
    assert.equal(report.status, 'NO_GO');
    assert.equal(report.passed, 9);
  });
  it('blocks tampered evidence and mismatched release identity', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'adpulse-gate-'));
    for (const gate of REQUIRED_GATES) await createEvidence(gate);
    await writeFile(path.join(dir, 'worker.log'), 'tampered');
    const report = await evaluateReleaseGate({ evidenceDir: dir, version: '1.3.1', commit: 'different', now: new Date('2026-11-01T12:01:00Z') });
    assert.equal(report.status, 'NO_GO');
    assert.ok(report.results.every((item) => item.status === 'NOT_PASS'));
  });
  it('allows GO only when all ten fresh, hash-verified records match the release', async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'adpulse-gate-'));
    for (const gate of REQUIRED_GATES) await createEvidence(gate);
    const report = await evaluateReleaseGate({ evidenceDir: dir, version: '1.3.1', commit: 'abc123', now: new Date('2026-11-01T12:01:00Z') });
    assert.equal(report.status, 'GO');
    assert.equal(report.passed, 10);
  });
});
