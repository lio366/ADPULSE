#!/usr/bin/env node
/** Fail-closed production release gate. Evidence is per-check, version- and commit-bound. */
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_GATES = [
  'multi_tenant_audit', 'security_audit', 'restore_test', 'load_test', 'build',
  'e2e', 'billing', 'worker', 'alerting', 'backup',
];
const SHA256 = /^[a-f0-9]{64}$/i;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function fail(message) { throw new Error(message); }

export async function evaluateReleaseGate({ evidenceDir, version, commit, now = new Date() }) {
  if (!version || !commit) fail('Release version and commit are required.');
  const root = await realpath(evidenceDir);
  const results = [];
  for (const gate of REQUIRED_GATES) {
    const manifestPath = path.join(root, `${gate}.json`);
    let manifest;
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); }
    catch { results.push({ gate, status: 'NOT_PASS', reason: 'Evidence missing or invalid JSON' }); continue; }

    const problems = [];
    if (manifest.gate !== gate) problems.push('gate identifier mismatch');
    if (manifest.status !== 'PASS') problems.push(`status is ${String(manifest.status ?? 'missing')}`);
    if (manifest.releaseVersion !== version) problems.push('release version mismatch');
    if (manifest.commit !== commit) problems.push('commit mismatch');
    if (typeof manifest.verifier !== 'string' || !manifest.verifier.trim()) problems.push('verifier missing');
    if (typeof manifest.testSuite !== 'string' || !manifest.testSuite.trim()) problems.push('test suite missing');
    if (typeof manifest.evidenceFile !== 'string' || !manifest.evidenceFile.trim()) {
      problems.push('evidence file missing');
    } else if (!SHA256.test(manifest.evidenceSha256 ?? '')) {
      problems.push('evidence SHA-256 missing or malformed');
    } else {
      try {
        const evidencePath = path.resolve(root, manifest.evidenceFile);
        const actualPath = await realpath(evidencePath);
        if (!actualPath.startsWith(`${root}${path.sep}`)) problems.push('evidence file escapes evidence directory');
        else {
          const bytes = await readFile(actualPath);
          const digest = createHash('sha256').update(bytes).digest('hex');
          if (digest !== manifest.evidenceSha256.toLowerCase()) problems.push('evidence SHA-256 mismatch');
        }
      } catch { problems.push('evidence file unavailable'); }
    }
    const executedAt = Date.parse(manifest.executedAt ?? '');
    if (!Number.isFinite(executedAt)) problems.push('execution timestamp invalid');
    else if (executedAt > now.getTime() + 5 * 60 * 1000) problems.push('execution timestamp is in the future');
    else if (now.getTime() - executedAt > MAX_AGE_MS) problems.push('evidence older than 30 days');

    results.push({ gate, status: problems.length ? 'NOT_PASS' : 'PASS', reason: problems.join('; ') || 'Evidence verified' });
  }
  const passed = results.filter((item) => item.status === 'PASS').length;
  return { releaseVersion: version, commit, status: passed === REQUIRED_GATES.length ? 'GO' : 'NO_GO', passed, required: REQUIRED_GATES.length, results };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, item, index, all) => {
    if (item.startsWith('--')) pairs.push([item.slice(2), all[index + 1]]);
    return pairs;
  }, []));
  const here = path.dirname(fileURLToPath(import.meta.url));
  const evidenceDir = args.evidence ? path.resolve(args.evidence) : path.resolve(here, '../release-evidence');
  const report = await evaluateReleaseGate({ evidenceDir, version: args.version, commit: args.commit });
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'GO') process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`RELEASE GATE ERROR: ${error.message}`); process.exitCode = 2; });
}
