CREATE TABLE `post_metric_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`post_id` text NOT NULL,
	`channel` text NOT NULL,
	`taken_at` integer NOT NULL,
	`metrics` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`post_id`) REFERENCES `generated_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_metric_snapshots_lookup` ON `post_metric_snapshots` (`project_id`, `post_id`, `channel`, `taken_at`);
--> statement-breakpoint
CREATE TABLE `account_daily` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`channel` text NOT NULL,
	`day` text NOT NULL,
	`followers` integer,
	`reach` integer,
	`views` integer,
	`profile_views` integer,
	`accounts_engaged` integer,
	`website_taps` integer,
	`online_followers` text,
	`demographics` text,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_daily_project_channel_day` ON `account_daily` (`project_id`, `channel`, `day`);
