CREATE TABLE `calendar_events` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`kind` text,
	`source` text,
	`url` text,
	`fetched_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `calendar_events_project_date` ON `calendar_events` (`project_id`, `date`);
