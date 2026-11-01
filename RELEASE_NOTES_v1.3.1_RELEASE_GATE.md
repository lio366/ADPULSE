# ADPULSE v1.3.1 — Fail-closed Go-Live gate

## Implemented
- Added a release gate requiring all ten mandatory checks: multi-tenant audit, security audit, restore test, load test, build, E2E, billing, worker, alerting, and backup.
- Missing, malformed, stale (>30 days), mismatched-version, mismatched-commit, non-PASS, missing-evidence, path-escape, or SHA-256-mismatch evidence is treated as NOT_PASS.
- Each check requires its own JSON manifest and evidence artifact; all evidence is bound to the same release version and commit.
- Added four Node.js built-in tests covering missing evidence, a single failed gate, tampering/release mismatch, and the all-PASS case.
- Added operator instructions under `app/release-evidence/README.md`.

## Verification performed
- `node --test app/scripts/tests/release-gate.test.mjs`: PASS (4/4).
- Default release gate with no evidence manifests: expected NO_GO (fail-closed).

## Not certified
This gate is a release-control mechanism, not proof that the ten underlying product audits have passed. No underlying production audit is being represented as PASS. Full app build, complete Vitest suite, browser E2E, MySQL integration, restore, load, billing, worker, alerting, and backup verification remain open. No production deployment or database mutation was performed.
