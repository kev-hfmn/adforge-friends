CREATE TABLE IF NOT EXISTS `project_brand_kits` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`north_star` text,
	`one_liner` text,
	`anti_references` text,
	`colors_json` text,
	`typography_json` text,
	`ui_notes` text,
	`visual_dos` text,
	`visual_donts` text,
	`reject_gate` text,
	`image_style_lock` text,
	`image_style_lock_no_text` text,
	`content_pillars_json` text,
	`formats_json` text,
	`editorial_rules` text,
	`cta_facts` text,
	`allowed_palette_ids` text,
	`banned_layout_styles` text,
	`full_markdown` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `project_brand_kits_project_id_unique` ON `project_brand_kits` (`project_id`);
