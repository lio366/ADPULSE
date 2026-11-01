CREATE TABLE IF NOT EXISTS `business_automation_rules` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`ownerId` bigint unsigned NOT NULL,
	`areaId` varchar(40) NOT NULL,
	`functionIndex` int NOT NULL,
	`mode` enum('off','assisted','autonomous') NOT NULL DEFAULT 'assisted',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `business_automation_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `business_automation_owner_function_unique` UNIQUE(`ownerId`,`areaId`,`functionIndex`)
);
