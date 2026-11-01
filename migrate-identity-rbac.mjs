#!/usr/bin/env node
/** Explicit, resumable MySQL 8.4 migration runner for additive identity/RBAC expansion. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const args = new Set(process.argv.slice(2));
if (!args.has('--confirm-backup')) {
  console.error('Refusing migration: pass --confirm-backup only after a verified database backup.');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(2);
}
const here = path.dirname(fileURLToPath(import.meta.url));
const migrationName = '0003_identity_rbac_governance';
const sql = await readFile(path.resolve(here, `../db/migrations/${migrationName}.sql`), 'utf8');
const statements = sql.split(';').map((part) => part.trim()).filter((part) => part && !/^--[^\n]*$/.test(part));
const connection = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await connection.query(`CREATE TABLE IF NOT EXISTS adpulse_schema_migrations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    migration_name VARCHAR(190) NOT NULL UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  const [rows] = await connection.execute('SELECT migration_name FROM adpulse_schema_migrations WHERE migration_name = ?', [migrationName]);
  if (rows.length) {
    console.log(`${migrationName}: already applied; no changes made.`);
  } else {
  console.log(`Applying ${migrationName} (${statements.length} statements). DDL is additive; partial failures can be rerun.`);
  for (let i = 0; i < statements.length; i += 1) {
    await connection.query(statements[i]);
    console.log(`PASS ${i + 1}/${statements.length}`);
  }
  await connection.execute('INSERT INTO adpulse_schema_migrations (migration_name) VALUES (?)', [migrationName]);
  console.log(`${migrationName}: APPLIED`);
  }
} catch (error) {
  console.error(`${migrationName}: FAILED. No success marker written. Correct the reported issue and rerun; migration statements are designed to be additive/idempotent.`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await connection.end();
}
