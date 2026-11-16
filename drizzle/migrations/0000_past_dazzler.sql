CREATE TABLE `autopilot_config` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`enabled` integer DEFAULT 0,
	`cron_time` text DEFAULT '0 8 * * *',
	`prompt_template` text,
	`posts_per_day` integer DEFAULT 2,
	`auto_post_after_approval` integer DEFAULT 0,
	`last_run_at` integer,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `autopilot_config_project_id_unique` ON `autopilot_config` (`project_id`);--> statement-breakpoint
CREATE TABLE `generated_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`status` text DEFAULT 'draft',
	`template_type` text DEFAULT 'ad',
	`headline` text,
	`headline_highlight` text,
	`subtext` text,
	`bold_phrases` text,
	`caption` text,
	`hashtags` text,
	`background_preset` text DEFAULT 'dark-gradient',
	`metadata` text,
	`image_path` text,
	`video_path` text,
	`source` text DEFAULT 'manual',
	`ig_media_id` text,
	`posted_at` integer,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `generation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`post_id` text,
	`type` text,
	`prompt` text,
	`response` text,
	`tokens_used` integer,
	`duration_ms` integer,
	`error` text,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `generated_posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `knowledge_base` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`section` text,
	`title` text NOT NULL,
	`content` text DEFAULT '',
	`sort_order` integer DEFAULT 0,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`brand_color` text DEFAULT '#6366f1',
	`logo_path` text,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `social_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text,
	`platform` text DEFAULT 'instagram',
	`access_token` text,
	`ig_user_id` text,
	`ig_username` text,
	`token_expires_at` integer,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
