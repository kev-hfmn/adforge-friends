CREATE TABLE `kb_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '',
	`fields` text,
	`tags` text,
	`pillar` text,
	`status` text DEFAULT 'active',
	`source` text NOT NULL,
	`source_ref` text,
	`created_at` integer,
	`updated_at` integer,
	`last_used_at` integer,
	`use_count` integer DEFAULT 0,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `kb_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`title` text,
	`body` text DEFAULT '',
	`fields` text,
	`editor` text,
	`created_at` integer,
	FOREIGN KEY (`entry_id`) REFERENCES `kb_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post_kb_links` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`how` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`post_id`) REFERENCES `generated_posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`entry_id`) REFERENCES `kb_entries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kb_sync_warnings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`file` text NOT NULL,
	`message` text NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `kb_entries_project_type` ON `kb_entries` (`project_id`, `status`, `type`);
--> statement-breakpoint
CREATE UNIQUE INDEX `kb_entries_sync_key` ON `kb_entries` (`project_id`, `source_ref`) WHERE `source_ref` IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `post_kb_links_post_entry_how` ON `post_kb_links` (`post_id`, `entry_id`, `how`);
--> statement-breakpoint
CREATE VIRTUAL TABLE `kb_fts` USING fts5(
	title,
	body,
	tags,
	content='kb_entries',
	content_rowid='rowid',
	tokenize='unicode61'
);
--> statement-breakpoint
CREATE TRIGGER `kb_entries_ai` AFTER INSERT ON `kb_entries` BEGIN
	INSERT INTO `kb_fts` (rowid, title, body, tags)
	VALUES (new.rowid, new.title, new.body, coalesce(new.tags, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `kb_entries_ad` AFTER DELETE ON `kb_entries` BEGIN
	INSERT INTO `kb_fts` (`kb_fts`, rowid, title, body, tags)
	VALUES ('delete', old.rowid, old.title, old.body, coalesce(old.tags, ''));
END;
--> statement-breakpoint
CREATE TRIGGER `kb_entries_au` AFTER UPDATE ON `kb_entries` BEGIN
	INSERT INTO `kb_fts` (`kb_fts`, rowid, title, body, tags)
	VALUES ('delete', old.rowid, old.title, old.body, coalesce(old.tags, ''));
	INSERT INTO `kb_fts` (rowid, title, body, tags)
	VALUES (new.rowid, new.title, new.body, coalesce(new.tags, ''));
END;
