-- Local, database-backed authentication. Apply only after a verified database backup.
-- Passwords use scrypt hashes; bearer tokens are short-lived and signed by the application.
CREATE TABLE IF NOT EXISTS `adpulse_auth_accounts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(320) NOT NULL,
  `displayName` VARCHAR(160) NOT NULL,
  `passwordHash` VARCHAR(255) NOT NULL,
  `status` ENUM('active','suspended') NOT NULL DEFAULT 'active',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `adpulse_auth_email_unique` (`email`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `adpulse_auth_memberships` (
  `accountId` BIGINT UNSIGNED NOT NULL,
  `tenantKey` VARCHAR(100) NOT NULL,
  `role` ENUM('platform_admin','owner','admin','operator','viewer') NOT NULL,
  `status` ENUM('active','suspended','removed') NOT NULL DEFAULT 'active',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`accountId`,`tenantKey`),
  KEY `adpulse_auth_membership_tenant_idx` (`tenantKey`,`status`),
  CONSTRAINT `adpulse_auth_membership_account_fk`
    FOREIGN KEY (`accountId`) REFERENCES `adpulse_auth_accounts` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;