CREATE TABLE `backups` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255),
	`description` text,
	`size` int,
	`rulesCount` int,
	`interactionsCount` int,
	`backupData` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `evolutionEvents` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`action` enum('promote','deprecate','tune','create_rule','archive') NOT NULL,
	`ruleId` varchar(64),
	`ruleName` varchar(255),
	`reason` text,
	`metrics` json,
	`metadata` json,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `evolutionEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interactions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`description` text NOT NULL,
	`outcome` enum('success','failure','partial','unknown') DEFAULT 'unknown',
	`context` json,
	`duration` int,
	`metadata` json,
	`timestamp` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `patterns` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`type` enum('sequential','temporal','frequency','contextual') NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`confidence` decimal(3,2) NOT NULL,
	`occurrences` int DEFAULT 1,
	`lastDetected` timestamp NOT NULL DEFAULT (now()),
	`patternData` json NOT NULL,
	`suggestedRule` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `patterns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` enum('safety','productivity','learning','workflow','custom') NOT NULL,
	`condition` text NOT NULL,
	`behavior` text NOT NULL,
	`priority` int NOT NULL DEFAULT 50,
	`active` boolean NOT NULL DEFAULT true,
	`confidence` decimal(3,2) NOT NULL DEFAULT '0.5',
	`successRate` decimal(5,4),
	`executionCount` int DEFAULT 0,
	`lastExecuted` timestamp,
	`shadowMode` boolean DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `systemStates` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`mode` enum('zero_knowledge','learning','competent','expert','master') DEFAULT 'zero_knowledge',
	`maturity` decimal(5,2) NOT NULL DEFAULT '0',
	`totalInteractions` int DEFAULT 0,
	`activeRules` int DEFAULT 0,
	`detectedPatterns` int DEFAULT 0,
	`lastEvolutionCycle` timestamp,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `systemStates_id` PRIMARY KEY(`id`),
	CONSTRAINT `systemStates_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`role` varchar(64),
	`domain` varchar(255),
	`goals` text,
	`prefersAutomation` boolean DEFAULT false,
	`riskTolerance` enum('low','medium','high') DEFAULT 'medium',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userProfiles_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `backups_userId_idx` ON `backups` (`userId`);--> statement-breakpoint
CREATE INDEX `backups_createdAt_idx` ON `backups` (`createdAt`);--> statement-breakpoint
CREATE INDEX `evolutionEvents_userId_idx` ON `evolutionEvents` (`userId`);--> statement-breakpoint
CREATE INDEX `evolutionEvents_action_idx` ON `evolutionEvents` (`action`);--> statement-breakpoint
CREATE INDEX `evolutionEvents_timestamp_idx` ON `evolutionEvents` (`timestamp`);--> statement-breakpoint
CREATE INDEX `interactions_userId_idx` ON `interactions` (`userId`);--> statement-breakpoint
CREATE INDEX `interactions_type_idx` ON `interactions` (`type`);--> statement-breakpoint
CREATE INDEX `interactions_timestamp_idx` ON `interactions` (`timestamp`);--> statement-breakpoint
CREATE INDEX `patterns_userId_idx` ON `patterns` (`userId`);--> statement-breakpoint
CREATE INDEX `patterns_type_idx` ON `patterns` (`type`);--> statement-breakpoint
CREATE INDEX `patterns_confidence_idx` ON `patterns` (`confidence`);--> statement-breakpoint
CREATE INDEX `rules_userId_idx` ON `rules` (`userId`);--> statement-breakpoint
CREATE INDEX `rules_category_idx` ON `rules` (`category`);--> statement-breakpoint
CREATE INDEX `rules_active_idx` ON `rules` (`active`);--> statement-breakpoint
CREATE INDEX `systemStates_userId_idx` ON `systemStates` (`userId`);--> statement-breakpoint
CREATE INDEX `userProfiles_userId_idx` ON `userProfiles` (`userId`);