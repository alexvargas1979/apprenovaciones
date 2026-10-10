CREATE TABLE `property_deletions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`deleted_at` text NOT NULL,
	`object_keys` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_property_deletions_user` ON `property_deletions` (`user_id`);--> statement-breakpoint
DROP TABLE `attom_receipts`;--> statement-breakpoint
DROP TABLE `settings`;