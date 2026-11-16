CREATE TABLE `post_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`project_id` text,
	`author` text DEFAULT 'owner',
	`body` text NOT NULL,
	`slide` integer,
	`reply` text,
	`resolved_at` integer,
	`created_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `generated_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
