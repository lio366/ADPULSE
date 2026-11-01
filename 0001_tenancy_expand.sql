-- ADPULSE USA v1.2: EXPAND phase. Additive only; app remains compatible with ownerId.
--> statement-breakpoint
-- Do not run ENFORCE until backfill dry-run and apply are independently verified.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tenants` (`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `slug` VARCHAR(63) NOT NULL, `name` VARCHAR(160) NOT NULL, `status` ENUM('active','suspended','closed') NOT NULL DEFAULT 'active', `createdByUserId` BIGINT UNSIGNED NOT NULL, `closedAt` TIMESTAMP NULL, `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (`id`), UNIQUE KEY `tenants_slug_unique` (`slug`), KEY `tenants_status_idx` (`status`)) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tenant_memberships` (`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `tenantId` BIGINT UNSIGNED NOT NULL, `userId` BIGINT UNSIGNED NOT NULL, `role` ENUM('owner','admin','member') NOT NULL, `status` ENUM('active','suspended','removed') NOT NULL DEFAULT 'active', `invitedByUserId` BIGINT UNSIGNED NULL, `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (`id`), UNIQUE KEY `tenant_memberships_tenant_user_unique` (`tenantId`,`userId`), KEY `tenant_memberships_user_status_idx` (`userId`,`status`), KEY `tenant_memberships_tenant_role_idx` (`tenantId`,`role`,`status`)) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `platform_admins` (`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `userId` BIGINT UNSIGNED NOT NULL, `grantedByUserId` BIGINT UNSIGNED NULL, `grantedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, `revokedAt` TIMESTAMP NULL, `revokedByUserId` BIGINT UNSIGNED NULL, PRIMARY KEY (`id`), UNIQUE KEY `platform_admins_user_unique` (`userId`), KEY `platform_admins_revoked_idx` (`revokedAt`)) ENGINE=InnoDB;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `tenant_invitations` (`id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, `tenantId` BIGINT UNSIGNED NOT NULL, `email` VARCHAR(320) NOT NULL, `role` ENUM('admin','member') NOT NULL DEFAULT 'member', `tokenHash` CHAR(64) NOT NULL, `invitedByUserId` BIGINT UNSIGNED NOT NULL, `expiresAt` TIMESTAMP NOT NULL, `acceptedAt` TIMESTAMP NULL, `acceptedByUserId` BIGINT UNSIGNED NULL, `revokedAt` TIMESTAMP NULL, `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (`id`), UNIQUE KEY `tenant_invitations_token_hash_unique` (`tokenHash`), KEY `tenant_invitations_tenant_email_idx` (`tenantId`,`email`)) ENGINE=InnoDB;
--> statement-breakpoint
ALTER TABLE `business_settings` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `customers` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `business_tasks` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `finance_entries` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `inventory_items` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `estimates` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `media_assets` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `agent_runs` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `business_audit` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `customer_portal_accounts` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `business_records` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
ALTER TABLE `business_automation_rules` ADD COLUMN `tenantId` BIGINT UNSIGNED NULL;
--> statement-breakpoint
-- Foreign keys are intentionally deferred to ENFORCE after data backfill.
--> statement-breakpoint
-- Existing ownerId columns and unique indexes remain intact during the compatibility window.
