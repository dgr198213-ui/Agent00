CREATE TABLE `knowledgeChunks` (
	`id` varchar(64) NOT NULL,
	`knowledgeId` varchar(64) NOT NULL,
	`agentId` varchar(64) NOT NULL,
	`chunkIndex` int NOT NULL,
	`content` text NOT NULL,
	`embedding` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledgeChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `knowledgeChunks_agentId_idx` ON `knowledgeChunks` (`agentId`);--> statement-breakpoint
CREATE INDEX `knowledgeChunks_knowledgeId_idx` ON `knowledgeChunks` (`knowledgeId`);