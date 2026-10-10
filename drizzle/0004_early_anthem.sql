CREATE TABLE `property_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`group_id` text NOT NULL,
	`property_id` text NOT NULL,
	`user_id` text NOT NULL,
	`version` integer NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`link_type` text NOT NULL,
	`link_ref` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_property_documents_owner_property` ON `property_documents` (`user_id`,`property_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_property_documents_group_version` ON `property_documents` (`group_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_property_documents_object` ON `property_documents` (`object_key`);