#!/usr/bin/env node
/** Idempotently seeds the v2 permission catalog, system roles and legacy membership-role links. */
import mysql from 'mysql2/promise';
import { PERMISSION_CATALOG, DEFAULT_ROLE_PERMISSIONS } from '../api/tenancy/permission-catalog.ts';
if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(2); }
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  await db.beginTransaction();
  const permissionIds = new Map();
  for (const code of PERMISSION_CATALOG) {
    const [resource, action] = code.split('.');
    await db.execute('INSERT INTO permissions (resource, action, code) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE code=VALUES(code)', [resource, action, code]);
    const [rows] = await db.execute('SELECT id FROM permissions WHERE code=?', [code]);
    permissionIds.set(code, rows[0].id);
  }
  const roleIds = new Map();
  for (const roleName of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
    const [rows] = await db.execute('SELECT id FROM roles WHERE tenantId IS NULL AND name=? AND deletedAt IS NULL LIMIT 1', [roleName]);
    let id = rows[0]?.id;
    if (!id) {
      const [result] = await db.execute('INSERT INTO roles (tenantId,name,isSystem) VALUES (NULL,?,TRUE)', [roleName]);
      id = result.insertId;
    }
    roleIds.set(roleName, id);
    for (const code of DEFAULT_ROLE_PERMISSIONS[roleName]) await db.execute('INSERT IGNORE INTO role_permissions (roleId,permissionId) VALUES (?,?)', [id, permissionIds.get(code)]);
  }
  const [memberships] = await db.query("SELECT id, role FROM tenant_memberships WHERE status='active' AND deletedAt IS NULL");
  for (const membership of memberships) {
    const roleId = roleIds.get(membership.role);
    if (roleId) await db.execute('INSERT IGNORE INTO membership_roles (membershipId,roleId,assignedByUserId) VALUES (?,?,NULL)', [membership.id, roleId]);
  }
  await db.commit();
  console.log(`RBAC seed PASS: ${permissionIds.size} permissions, ${roleIds.size} system roles, ${memberships.length} memberships scanned.`);
} catch (error) { await db.rollback(); console.error(error); process.exitCode = 1; }
finally { await db.end(); }
