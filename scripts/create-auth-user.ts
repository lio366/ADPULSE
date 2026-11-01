import "dotenv/config";
import mysql from "mysql2/promise";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../api/auth.ts";

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.AUTH_EMAIL?.trim().toLowerCase();
const displayName = process.env.AUTH_NAME?.trim();
const password = process.env.AUTH_PASSWORD ?? "";
delete process.env.AUTH_PASSWORD;
const tenantKey = process.env.AUTH_TENANT_KEY;
const role = process.env.AUTH_ROLE ?? "admin";
const tenantKeys = new Set(["tenant-autofix", "tenant-ruta-24", "tenant-moto-verde", "*"]);
const roles = new Set(["platform_admin", "owner", "admin", "operator", "viewer"]);

if (!databaseUrl || !email || !displayName || !password || !tenantKey) {
  console.error("Set DATABASE_URL, AUTH_EMAIL, AUTH_NAME, AUTH_PASSWORD, AUTH_TENANT_KEY, and optional AUTH_ROLE.");
  process.exit(2);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
  console.error("AUTH_EMAIL must be a valid email address.");
  process.exit(2);
}
if (!tenantKeys.has(tenantKey) || (role === "platform_admin" && tenantKey !== "*") || !roles.has(role)) {
  console.error("AUTH_TENANT_KEY or AUTH_ROLE is not allowed.");
  process.exit(2);
}

const passwordHash = hashPassword(password);
const connection = await mysql.createConnection(databaseUrl);
try {
  await connection.beginTransaction();
  const [existing] = await connection.execute<RowDataPacket[]>(
    "SELECT id FROM adpulse_auth_accounts WHERE email = ? LIMIT 1",
    [email],
  );
  if (existing.length > 0) throw new Error("An account with this email already exists.");

  const [accountResult] = await connection.execute<ResultSetHeader>(
    "INSERT INTO adpulse_auth_accounts (email, displayName, passwordHash) VALUES (?, ?, ?)",
    [email, displayName, passwordHash],
  );
  await connection.execute(
    "INSERT INTO adpulse_auth_memberships (accountId, tenantKey, role) VALUES (?, ?, ?)",
    [accountResult.insertId, tenantKey, role],
  );
  await connection.commit();
  console.log(`Created account ${email} with role ${role} for tenant ${tenantKey}.`);
} catch (error) {
  await connection.rollback();
  console.error(error instanceof Error ? error.message : "Account creation failed.");
  process.exitCode = 1;
} finally {
  await connection.end();
}