ALTER TABLE `generated_posts` ADD `scheduled_at` integer;--> statement-breakpoint
ALTER TABLE `generated_posts` ADD `permalink` text;--> statement-breakpoint
ALTER TABLE `generated_posts` ADD `publish_error` text;--> statement-breakpoint
ALTER TABLE `generated_posts` ADD `insights_json` text;--> statement-breakpoint
ALTER TABLE `generated_posts` ADD `insights_updated_at` integer;