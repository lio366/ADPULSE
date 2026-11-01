import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { createPool, type RowDataPacket } from "mysql2/promise";
import { jwtVerify, SignJWT } from "jose";

const SCRYPT_COST = 32_768;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const TOKEN_ISSUER = "adpulse";
const TOKEN_AUDIENCE = "adpulse-api";

let authPool: ReturnType<typeof createPool> | undefined;

export type AccountRow = RowDataPacket & {
  id: number;
  email: string;
  displayName: string;
  passwordHash: string;
  tenantKey: string;
  role: string;
};

export type AuthPrincipal = {
  id: string;
  email: string;
  displayName: string;
  tenantId: string;
  role: string;
};

function getAuthPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  authPool ??= createPool(connectionString, { connectionLimit: 5, enableKeepAlive: true });
  return authPool;
}

export function isAuthConfigured() {
  return Boolean(getAuthPool() && getSigningKey());
}

export async function readAuthStoreHealth() {
  const pool = getAuthPool();
  if (!pool || !getSigningKey()) return { configured: false, reachable: false, status: "unconfigured" };

  try {
    await pool.query("SELECT 1");
    return { configured: true, reachable: true, status: "healthy" };
  } catch {
    return { configured: true, reachable: false, status: "unavailable" };
  }
}

function getSigningKey() {
  const secret = process.env.ADPULSE_AUTH_JWT_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < 32 || /replace|your[-_ ]secret|change[-_ ]me/i.test(secret)) return null;
  return new TextEncoder().encode(secret);
}

export function hashPassword(password: string) {
  if (password.length < 12 || password.length > 1024) {
    throw new Error("Password must contain between 12 and 1024 characters.");
  }
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELIZATION,
    maxmem: SCRYPT_MAX_MEMORY,
  });
  return `scrypt-v1$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, saltHex, derivedHex] = storedHash.split("$");
  if (algorithm !== "scrypt-v1" || !/^[a-f0-9]{32}$/i.test(saltHex ?? "") || !/^[a-f0-9]{128}$/i.test(derivedHex ?? "")) {
    return false;
  }

  const expected = Buffer.from(derivedHex, "hex");
  const actual = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, Buffer.from(saltHex, "hex"), SCRYPT_KEY_LENGTH, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
      maxmem: SCRYPT_MAX_MEMORY,
    }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
  return timingSafeEqual(actual, expected);
}

export async function authenticateCredentials(email: string, password: string, tenantKey: string) {
  const pool = getAuthPool();
  if (!pool || !getSigningKey()) throw new Error("Authentication storage is not configured.");

  const normalizedEmail = email.trim().toLowerCase();
  const [rows] = await pool.execute<AccountRow[]>(
    `SELECT a.id, a.email, a.displayName, a.passwordHash, m.tenantKey, m.role
     FROM adpulse_auth_accounts a
     JOIN adpulse_auth_memberships m ON m.accountId = a.id
     WHERE a.email = ? AND a.status = 'active' AND m.status = 'active'
       AND ((m.tenantKey = ?) OR (m.tenantKey = '*' AND m.role = 'platform_admin'))
     LIMIT 1`,
    [normalizedEmail, tenantKey],
  );

  const account = rows[0];
  if (!account) {
    await verifyPassword(password.slice(0, 1024), "scrypt-v1$00000000000000000000000000000000$" + "0".repeat(128));
    return null;
  }
  if (!await verifyPassword(password, account.passwordHash)) return null;
  return account;
}

export async function createAccessToken(account: AccountRow) {
  const key = getSigningKey();
  if (!key) throw new Error("ADPULSE_AUTH_JWT_SECRET must contain at least 32 bytes.");

  const tenantId = account.role === "platform_admin" ? "platform" : account.tenantKey;
  return new SignJWT({
    email: account.email,
    name: account.displayName,
    tenant_id: tenantId,
    role: account.role,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(account.id))
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key);
}

export async function verifyAccessToken(token: string) {
  const constraints = getAccessTokenConstraints();
  if (!constraints) return null;

  try {
    const { payload } = await jwtVerify(token, constraints.key, {
      algorithms: ["HS256"],
      issuer: constraints.issuer,
      audience: constraints.audience,
    });
    return toAuthPrincipal(payload);
  } catch {
    return null;
  }
}

export function getAccessTokenConstraints() {
  const key = getSigningKey();
  if (!key) return null;
  return { key, issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE };
}

export function toAuthPrincipal(payload: Record<string, unknown>): AuthPrincipal | null {
  if (
    typeof payload.sub !== "string"
    || typeof payload.email !== "string"
    || typeof payload.name !== "string"
    || typeof payload.tenant_id !== "string"
    || typeof payload.role !== "string"
  ) {
    return null;
  }
  return {
    id: payload.sub,
    email: payload.email,
    displayName: payload.name,
    tenantId: payload.tenant_id,
    role: payload.role,
  };
}