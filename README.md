# ADPULSE production release evidence

The production release gate is fail-closed. It requires ten separate JSON manifests and one evidence file per manifest. Missing, stale, mismatched, modified, or non-PASS evidence blocks Go-Live.

Run from `app/`:

```bash
node scripts/release-gate.mjs --version 1.3.1 --commit <full-git-commit-sha>
node --test scripts/tests/release-gate.test.mjs
```

Each `<gate>.json` must contain: `gate`, `status: "PASS"`, `releaseVersion`, `commit`, `verifier`, `testSuite`, `executedAt` (ISO-8601), `evidenceFile` (relative path inside this directory), and `evidenceSha256` (SHA-256 of that evidence file). Evidence expires after 30 days. A report of `GO` is necessary but not sufficient: deployment still requires explicit human authorization.

Required gate names: `multi_tenant_audit`, `security_audit`, `restore_test`, `load_test`, `build`, `e2e`, `billing`, `worker`, `alerting`, `backup`.
