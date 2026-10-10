CREATE TABLE `analysis_baselines` (
	`property_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scenario_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scenario_id`) REFERENCES `analysis_scenarios`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `analysis_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`source_id` text,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_analysis_scenarios_owner_property` ON `analysis_scenarios` (`user_id`,`property_id`);