CREATE TABLE `expense_allocations` (
	`user_id` text NOT NULL,
	`line_id` text NOT NULL,
	`position` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`user_id`, `line_id`, `position`)
);
--> statement-breakpoint
CREATE TABLE `expense_classification_history` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`position` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `expense_drafts` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`property_id` text NOT NULL,
	`status` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_expense_drafts_property` ON `expense_drafts` (`user_id`,`property_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `expense_invoices` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`position` integer NOT NULL,
	`request_id` text,
	`payload` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_expense_request` ON `expense_invoices` (`user_id`,`request_id`);--> statement-breakpoint
CREATE TABLE `expense_legacy_backup` (
	`user_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`version` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expense_lines` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`property_id` text NOT NULL,
	`position` integer NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_expense_lines_invoice` ON `expense_lines` (`user_id`,`invoice_id`);--> statement-breakpoint
CREATE INDEX `idx_expense_lines_property` ON `expense_lines` (`user_id`,`property_id`);--> statement-breakpoint
CREATE TABLE `expense_reports` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`property_id` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_expense_reports_property` ON `expense_reports` (`user_id`,`property_id`,`created_at`);