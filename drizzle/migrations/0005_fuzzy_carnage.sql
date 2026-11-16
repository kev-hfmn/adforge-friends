ALTER TABLE `generated_posts` ADD `image_mode` text DEFAULT 'template';--> statement-breakpoint
ALTER TABLE `generated_posts` ADD `image_prompt` text;--> statement-breakpoint
ALTER TABLE `generated_posts` ADD `fal_source_url` text;