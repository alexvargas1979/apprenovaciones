CREATE TABLE `investment_projects` (
	`property_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`schema_version` integer NOT NULL,
	`origin` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_investment_projects_user_id` ON `investment_projects` (`user_id`);--> statement-breakpoint
CREATE TABLE `opening_balances` (
	`property_id` text NOT NULL,
	`line_id` text NOT NULL,
	`amount` text NOT NULL,
	`source` text NOT NULL,
	PRIMARY KEY(`property_id`, `line_id`),
	FOREIGN KEY (`property_id`) REFERENCES `property_baselines`(`property_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `property_baselines` (
	`property_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`original_payload` text NOT NULL,
	`original_updated_at` text NOT NULL,
	`captured_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
