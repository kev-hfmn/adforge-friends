CREATE TABLE `post_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`channel` text NOT NULL,
	`caption` text,
	`first_comment` text,
	`hashtags` text,
	`alt_text` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `generated_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `post_variants_post_channel` ON `post_variants` (`post_id`, `channel`);
--> statement-breakpoint
CREATE TABLE `snippets` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`label` text NOT NULL,
	`body` text NOT NULL,
	`kind` text DEFAULT 'line',
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `post_notes` ADD `parent_id` text;
--> statement-breakpoint
ALTER TABLE `post_notes` ADD `suggestion` text;
