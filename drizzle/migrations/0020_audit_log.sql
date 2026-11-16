CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`before_summary` text,
	`after_summary` text,
	`quote` text,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_log_project_created` ON `audit_log` (`project_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `audit_log_target` ON `audit_log` (`target`);
