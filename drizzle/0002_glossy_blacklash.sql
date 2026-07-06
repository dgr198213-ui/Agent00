CREATE TABLE `agentKnowledge` (
	`id` varchar(64) NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`sourceType` enum('text','markdown','pdf','csv','json','website','github','notion','gdocs','confluence') NOT NULL,
	`sourceUrl` text,
	`content` text,
	`status` enum('pending','indexed','error') NOT NULL DEFAULT 'pending',
	`size` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentKnowledge_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentMemories` (
	`id` varchar(64) NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`memoryKey` varchar(255) NOT NULL,
	`value` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentMemories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentTools` (
	`id` varchar(64) NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`toolKey` varchar(64) NOT NULL,
	`config` json,
	`enabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentTools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`workspaceId` varchar(64),
	`name` varchar(255) NOT NULL,
	`description` text,
	`model` varchar(128) NOT NULL DEFAULT 'default',
	`temperature` decimal(3,2) NOT NULL DEFAULT '0.70',
	`systemPrompt` text,
	`icon` varchar(64) NOT NULL DEFAULT 'bot',
	`visibility` enum('private','public') NOT NULL DEFAULT 'private',
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` varchar(64) NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'Nueva conversación',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` varchar(64) NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`type` enum('private','public','api','widget','webhook') NOT NULL,
	`apiKey` varchar(128),
	`status` enum('active','revoked') NOT NULL DEFAULT 'active',
	`config` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deployments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` varchar(64) NOT NULL,
	`conversationId` varchar(64) NOT NULL,
	`role` enum('system','user','assistant','tool') NOT NULL,
	`content` text NOT NULL,
	`toolCalls` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `agentKnowledge_agentId_idx` ON `agentKnowledge` (`agentId`);--> statement-breakpoint
CREATE INDEX `agentKnowledge_userId_idx` ON `agentKnowledge` (`userId`);--> statement-breakpoint
CREATE INDEX `agentMemories_agentId_idx` ON `agentMemories` (`agentId`);--> statement-breakpoint
CREATE INDEX `agentMemories_agent_key_idx` ON `agentMemories` (`agentId`,`memoryKey`);--> statement-breakpoint
CREATE INDEX `agentTools_agentId_idx` ON `agentTools` (`agentId`);--> statement-breakpoint
CREATE INDEX `agentTools_agent_tool_idx` ON `agentTools` (`agentId`,`toolKey`);--> statement-breakpoint
CREATE INDEX `agents_userId_idx` ON `agents` (`userId`);--> statement-breakpoint
CREATE INDEX `agents_status_idx` ON `agents` (`status`);--> statement-breakpoint
CREATE INDEX `conversations_agentId_idx` ON `conversations` (`agentId`);--> statement-breakpoint
CREATE INDEX `conversations_userId_idx` ON `conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `deployments_agentId_idx` ON `deployments` (`agentId`);--> statement-breakpoint
CREATE INDEX `deployments_apiKey_idx` ON `deployments` (`apiKey`);--> statement-breakpoint
CREATE INDEX `messages_conversationId_idx` ON `messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `workspaces_userId_idx` ON `workspaces` (`userId`);