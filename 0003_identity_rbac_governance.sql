-- ADPULSE v1.4.0 Identity, RBAC, invitation, soft-delete and governance expansion.
-- MySQL 8.4. Additive migration. Take and verify a backup before execution.
-- Existing users.role, tenant_memberships.role and tenant_invitations.role remain
-- as compatibility fields during the application cutover.

CREATE TABLE IF NOT EXISTS `roles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tenantId` BIGINT UNSIGNED NULL COMMENT 'NULL means platform-defined system role',
  `name` VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) NULL,
  `isSystem` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletedAt` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `roles_tenant_name_unique` (`tenantId`,`name`),
  KEY `roles_tenant_deleted_idx` (`tenantId`,`deletedAt`),
  CONSTRAINT `roles_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `resource` VARCHAR(80) NOT NULL,
  `action` VARCHAR(80) NOT NULL,
  `description` VARCHAR(255) NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `permissions_resource_action_unique` (`resource`,`action`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `roleId` BIGINT UNSIGNED NOT NULL,
  `permissionId` BIGINT UNSIGNED NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`roleId`,`permissionId`),
  CONSTRAINT `role_permissions_role_fk` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `role_permissions_permission_fk` FOREIGN KEY (`permissionId`) REFERENCES `permissions` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `membership_roles` (
  `membershipId` BIGINT UNSIGNED NOT NULL,
  `roleId` BIGINT UNSIGNED NOT NULL,
  `assignedByUserId` BIGINT UNSIGNED NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`membershipId`,`roleId`),
  KEY `membership_roles_role_idx` (`roleId`),
  CONSTRAINT `membership_roles_membership_fk` FOREIGN KEY (`membershipId`) REFERENCES `tenant_memberships` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `membership_roles_role_fk` FOREIGN KEY (`roleId`) REFERENCES `roles` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tenant_invitation_events` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `invitationId` BIGINT UNSIGNED NOT NULL,
  `tenantId` BIGINT UNSIGNED NOT NULL,
  `actorUserId` BIGINT UNSIGNED NULL,
  `eventType` ENUM('created','resent','accepted','revoked','expired') NOT NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `tenant_invitation_events_tenant_time_idx` (`tenantId`,`createdAt`),
  KEY `tenant_invitation_events_invitation_idx` (`invitationId`),
  CONSTRAINT `tenant_invitation_events_tenant_fk` FOREIGN KEY (`tenantId`) REFERENCES `tenants` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Idempotent additive user columns.
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `users` ADD COLUMN `status` ENUM(\'active\',\'suspended\',\'pending\') NOT NULL DEFAULT \'active\'', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='status');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `users` ADD COLUMN `deletedAt` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='deletedAt');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `tenants` ADD COLUMN `plan` VARCHAR(40) NOT NULL DEFAULT \'pilot\'', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tenants' AND COLUMN_NAME='plan');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `tenants` ADD COLUMN `deletedAt` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tenants' AND COLUMN_NAME='deletedAt');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `tenant_memberships` ADD COLUMN `deletedAt` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tenant_memberships' AND COLUMN_NAME='deletedAt');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `tenant_invitations` ADD COLUMN `deletedAt` TIMESTAMP NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tenant_invitations' AND COLUMN_NAME='deletedAt');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ddl = (SELECT IF(COUNT(*)=0, 'ALTER TABLE `tenant_invitations` ADD COLUMN `roleId` BIGINT UNSIGNED NULL', 'SELECT 1') FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tenant_invitations' AND COLUMN_NAME='roleId');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Membership uniqueness is retained for historical records. Application must
-- reactivate an existing membership rather than insert a duplicate.
-- No destructive DROP/DELETE statements are included in this migration.
