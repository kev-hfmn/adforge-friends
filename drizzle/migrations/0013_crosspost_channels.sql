CREATE TABLE `post_publications` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`project_id` text,
	`platform` text NOT NULL,
	`status` text DEFAULT 'publishing',
	`external_id` text,
	`url` text,
	`error` text,
	`created_at` integer,
	`posted_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `generated_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `social_channels` ADD `provider` text;--> statement-breakpoint
ALTER TABLE `social_channels` ADD `account_id` text;