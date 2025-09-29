CREATE TABLE IF NOT EXISTS `files` (
	`id` integer PRIMARY KEY NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`mime_type` text,
	`size` integer,
	`uid` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`uid`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
UPDATE `info` SET `value` = '5' WHERE `key` = 'migration_version';
