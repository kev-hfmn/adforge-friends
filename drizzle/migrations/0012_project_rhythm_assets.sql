CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`kind` text DEFAULT 'screenshot',
	`feature` text,
	`tags` text,
	`note` text,
	`captured_at` integer,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `projects` ADD `rhythm_json` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `copy_mode` text;