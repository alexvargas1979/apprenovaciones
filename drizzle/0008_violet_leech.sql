CREATE TABLE `team_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`grant_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`property_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`grant_id`) REFERENCES `team_members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_team_contributions_owner` ON `team_contributions` (`owner_id`);--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`member_id` text,
	`token_hash` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_team_owner` ON `team_members` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_team_member` ON `team_members` (`member_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_team_token` ON `team_members` (`token_hash`);