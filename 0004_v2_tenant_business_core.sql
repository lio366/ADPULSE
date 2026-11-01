-- ADPULSE v2.0 tenant/business core. MySQL 8.4. Additive and compatibility-first.
-- Run only after a verified backup. No ownerId removal and no destructive DDL.

-- Extend lifecycle states without changing existing rows.
ALTER TABLE `users` MODIFY COLUMN `status` ENUM('active','invited','suspended','pending','deleted') NOT NULL DEFAULT 'active';
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `users` ADD COLUMN `emailVerifiedAt` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='emailVerifiedAt');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
ALTER TABLE `tenants` MODIFY COLUMN `status` ENUM('trial','active','suspended','closed') NOT NULL DEFAULT 'trial';
ALTER TABLE `tenant_memberships` MODIFY COLUMN `role` ENUM('owner','admin','manager','member','viewer') NOT NULL;
ALTER TABLE `tenant_memberships` MODIFY COLUMN `status` ENUM('active','invited','suspended','removed') NOT NULL DEFAULT 'active';
ALTER TABLE `tenant_invitations` MODIFY COLUMN `role` ENUM('owner','admin','manager','member','viewer') NOT NULL DEFAULT 'member';
-- tokenHash, revokedAt and acceptedByUserId already exist in the v1.2 invitation table.

ALTER TABLE `membership_roles` MODIFY COLUMN `assignedByUserId` BIGINT UNSIGNED NULL;

-- Stable permission code, retaining resource/action as normalized source fields.
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `permissions` ADD COLUMN `code` VARCHAR(150) NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='permissions' AND COLUMN_NAME='code');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
UPDATE `permissions` SET `code` = CONCAT(`resource`, '.', `action`) WHERE `code` IS NULL;
ALTER TABLE `permissions` MODIFY COLUMN `code` VARCHAR(150) NOT NULL;
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `permissions` ADD UNIQUE KEY `permissions_code_unique` (`code`)', 'SELECT 1') FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='permissions' AND INDEX_NAME='permissions_code_unique');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Business-specific resources. Existing `leads` is the public website lead inbox;
-- CRM leads are separate so anonymous sales leads are never misrepresented as tenant data.
CREATE TABLE IF NOT EXISTS `workflows` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'active',
  `definition` JSON NULL,
  `createdByUserId` BIGINT UNSIGNED NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`), KEY `workflows_tenant_status_idx` (`tenantId`,`status`,`deletedAt`),
  CONSTRAINT `workflows_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `agents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` BIGINT UNSIGNED NOT NULL,
  `agentKey` VARCHAR(100) NOT NULL,
  `name` VARCHAR(160) NOT NULL,
  `status` ENUM('active','paused','disabled') NOT NULL DEFAULT 'active',
  `configuration` JSON NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `agents_key_unique` (`tenantId`,`agentKey`),
  CONSTRAINT `agents_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `crm_leads` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `email` VARCHAR(320) NULL,
  `phone` VARCHAR(40) NULL,
  `source` VARCHAR(80) NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'new',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`), KEY `crm_leads_tenant_status_idx` (`tenantId`,`status`,`deletedAt`),
  CONSTRAINT `crm_leads_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `deals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` BIGINT UNSIGNED NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(14,2) NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'USD',
  `stage` VARCHAR(80) NOT NULL DEFAULT 'new',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`), KEY `deals_tenant_stage_idx` (`tenantId`,`stage`,`deletedAt`),
  CONSTRAINT `deals_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tenant_files` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` BIGINT UNSIGNED NOT NULL,
  `storageKey` VARCHAR(512) NOT NULL,
  `fileName` VARCHAR(255) NOT NULL,
  `contentType` VARCHAR(120) NOT NULL,
  `sizeBytes` BIGINT UNSIGNED NOT NULL,
  `createdByUserId` BIGINT UNSIGNED NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`), UNIQUE KEY `tenant_files_storage_key_unique` (`storageKey`),
  KEY `tenant_files_tenant_created_idx` (`tenantId`,`createdAt`,`deletedAt`),
  CONSTRAINT `tenant_files_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tenant_subscriptions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` BIGINT UNSIGNED NOT NULL,
  `provider` VARCHAR(40) NOT NULL,
  `providerSubscriptionId` VARCHAR(190) NULL,
  `status` VARCHAR(40) NOT NULL,
  `plan` VARCHAR(100) NOT NULL,
  `currentPeriodEnd` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `tenant_subscription_provider_unique` (`provider`,`providerSubscriptionId`),
  KEY `tenant_subscriptions_tenant_status_idx` (`tenantId`,`status`),
  CONSTRAINT `tenant_subscriptions_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tenant_invoices` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` BIGINT UNSIGNED NOT NULL,
  `subscriptionId` BIGINT UNSIGNED NULL,
  `providerInvoiceId` VARCHAR(190) NULL,
  `status` VARCHAR(40) NOT NULL,
  `currency` CHAR(3) NOT NULL DEFAULT 'USD',
  `total` DECIMAL(14,2) NOT NULL,
  `dueAt` TIMESTAMP NULL,
  `paidAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), KEY `tenant_invoices_tenant_status_idx` (`tenantId`,`status`,`createdAt`),
  CONSTRAINT `tenant_invoices_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `tenant_invoices_subscription_fk` FOREIGN KEY (`subscriptionId`) REFERENCES `tenant_subscriptions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` BIGINT UNSIGNED NULL COMMENT 'NULL reserved for platform-level events',
  `actorUserId` BIGINT UNSIGNED NULL,
  `actorType` ENUM('user','platform_admin','system','agent') NOT NULL,
  `action` VARCHAR(150) NOT NULL,
  `resourceType` VARCHAR(100) NOT NULL,
  `resourceId` VARCHAR(100) NULL,
  `outcome` ENUM('success','denied','failure') NOT NULL,
  `metadata` JSON NULL,
  `previousHash` CHAR(64) NULL,
  `eventHash` CHAR(64) NOT NULL,
  `signature` TEXT NULL,
  `keyId` VARCHAR(100) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`), UNIQUE KEY `audit_logs_event_hash_unique` (`eventHash`),
  KEY `audit_logs_tenant_time_idx` (`tenantId`,`createdAt`),
  KEY `audit_logs_actor_time_idx` (`actorUserId`,`createdAt`)
) ENGINE=InnoDB;

-- Backfill default roles and permissions is intentionally handled by the application
-- seed command after deployment; no existing user is promoted to platform admin.
