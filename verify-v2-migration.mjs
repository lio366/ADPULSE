#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
const sql = await readFile(new URL('../db/migrations/0004_v2_tenant_business_core.sql', import.meta.url), 'utf8');
const required = ['workflows','agents','crm_leads','deals','tenant_files','tenant_subscriptions','tenant_invoices'];
for (const table of required) {
  const re = new RegExp('CREATE TABLE IF NOT EXISTS `' + table + '` \\(([\\s\\S]*?)\\) ENGINE=InnoDB', 'i');
  const match = sql.match(re);
  if (!match || !/`tenantId` BIGINT UNSIGNED NOT NULL/.test(match[1])) throw new Error(`${table}: missing mandatory tenantId`);
  console.log(`PASS ${table}: tenantId NOT NULL`);
}
if (/DROP TABLE|DROP COLUMN|DELETE FROM `users`|DROP DATABASE/i.test(sql)) throw new Error('Destructive DDL detected');
console.log('PASS additive migration: no ownerId removal or destructive table/column drops');
