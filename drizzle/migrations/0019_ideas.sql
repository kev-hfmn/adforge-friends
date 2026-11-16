CREATE TABLE `ideas` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`pillar` text,
	`format` text,
	`tags` text,
	`status` text DEFAULT 'inbox' NOT NULL,
	`links` text,
	`created_by` text DEFAULT 'owner' NOT NULL,
	`due_week` text,
	`post_id` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `generated_posts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ideas_project_status` ON `ideas` (`project_id`,`status`);
