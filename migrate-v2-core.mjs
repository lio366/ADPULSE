#!/usr/bin/env node
/** Explicit additive MySQL 8.4 v2.0 migration runner. Never points at production by default. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
const args = new Set(process.argv.slice(2));
if (!args.has('--confirm-backup')) { console.error('BLOCKED: create and verify a restorable backup, then pass --confirm-backup.'); process.exit(2); }
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required.'); process.exit(2); }
if (process.env.NODE_ENV === 'production' && !args.has('--allow-production')) { console.error('BLOCKED: production target requires separate explicit --allow-production approval.'); process.exit(2); }
const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations/0004_v2_tenant_business_core.sql');
const sql = await readFile(file, 'utf8');
const statements = sql.split(';').map(s => s.trim()).filter(s => s && !s.split('\n').every(line => !line.trim() || line.trim().startsWith('--')));
const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await conn.query(`CREATE TABLE IF NOT EXISTS adpulse_schema_migrations (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, migration_name VARCHAR(190) NOT NULL UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
  const [found] = await conn.execute('SELECT migration_name FROM adpulse_schema_migrations WHERE migration_name=?', ['0004_v2_tenant_business_core']);
  if (found.length) { console.log('0004_v2_tenant_business_core already applied.'); }
  else {
    for (let i = 0; i < statements.length; i++) { await conn.query(statements[i]); console.log(`PASS ${i + 1}/${statements.length}`); }
    await conn.execute('INSERT INTO adpulse_schema_migrations (migration_name) VALUES (?)', ['0004_v2_tenant_business_core']);
    console.log('0004_v2_tenant_business_core APPLIED');
  }
} catch (e) { console.error('MIGRATION FAILED; success marker not written. DDL may have partially applied and is designed to be rerun after correcting the error.'); console.error(e instanceof Error ? e.message : String(e)); process.exitCode = 1; }
finally { await conn.end(); }
