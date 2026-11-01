-- ADPULSE security foundation. Additive only; deploy after verified backup.
-- Refresh tokens are stored as hashes, never as bearer plaintext.
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  tokenHash CHAR(64) NOT NULL UNIQUE,
  familyId CHAR(36) NOT NULL,
  expiresAt TIMESTAMP NOT NULL,
  consumedAt TIMESTAMP NULL,
  revokedAt TIMESTAMP NULL,
  replacedByTokenHash CHAR(64) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX auth_refresh_user_idx (userId, revokedAt),
  INDEX auth_refresh_family_idx (familyId)
);

CREATE TABLE IF NOT EXISTS auth_mfa_factors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userId BIGINT UNSIGNED NOT NULL,
  factorType ENUM('totp') NOT NULL,
  secretCiphertext VARBINARY(1024) NOT NULL,
  enabledAt TIMESTAMP NULL,
  lastUsedAt TIMESTAMP NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY auth_mfa_user_type_unique (userId, factorType)
);

CREATE TABLE IF NOT EXISTS security_audit_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tenantId BIGINT UNSIGNED NULL,
  actorUserId BIGINT UNSIGNED NULL,
  eventType VARCHAR(100) NOT NULL,
  resourceType VARCHAR(100) NULL,
  resourceId VARCHAR(160) NULL,
  requestId VARCHAR(64) NULL,
  payload JSON NOT NULL,
  previousHash CHAR(64) NULL,
  eventHash CHAR(64) NOT NULL,
  signature VARBINARY(512) NOT NULL,
  signingKeyId VARCHAR(100) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX security_audit_tenant_time_idx (tenantId, createdAt),
  INDEX security_audit_actor_time_idx (actorUserId, createdAt),
  UNIQUE KEY security_audit_hash_unique (eventHash)
);
