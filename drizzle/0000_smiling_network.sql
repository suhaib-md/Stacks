CREATE TABLE `auth_attempts` (
	`ip` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` text PRIMARY KEY NOT NULL,
	`isbn13` text,
	`isbn10` text,
	`title` text NOT NULL,
	`subtitle` text,
	`authors` text DEFAULT '[]' NOT NULL,
	`publisher` text,
	`published_year` integer,
	`page_count` integer,
	`genre` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`format` text DEFAULT 'paperback' NOT NULL,
	`language` text,
	`description` text,
	`cover_url` text,
	`cover_color` text,
	`read_status` text DEFAULT 'unread' NOT NULL,
	`current_page` integer DEFAULT 0 NOT NULL,
	`rating` integer,
	`notes` text,
	`started_at` text,
	`finished_at` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "books_rating_chk" CHECK("books"."rating" IS NULL OR ("books"."rating" BETWEEN 1 AND 5)),
	CONSTRAINT "books_current_page_chk" CHECK("books"."current_page" >= 0),
	CONSTRAINT "books_format_chk" CHECK("books"."format" IN ('paperback','hardcover','ebook','other')),
	CONSTRAINT "books_status_chk" CHECK("books"."read_status" IN ('unread','reading','finished','dnf')),
	CONSTRAINT "books_source_chk" CHECK("books"."source" IN ('scan','search','manual'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `books_isbn13_unq` ON `books` (`isbn13`);--> statement-breakpoint
CREATE INDEX `books_title_idx` ON `books` (`title`);--> statement-breakpoint
CREATE INDEX `books_status_idx` ON `books` (`read_status`);--> statement-breakpoint
CREATE INDEX `books_created_idx` ON `books` (`created_at`);--> statement-breakpoint
CREATE INDEX `books_finished_idx` ON `books` (`finished_at`);--> statement-breakpoint
CREATE TABLE `lookup_cache` (
	`isbn13` text PRIMARY KEY NOT NULL,
	`payload` text,
	`found` integer DEFAULT 0 NOT NULL,
	`provider` text,
	`fetched_at` text NOT NULL,
	`expires_at` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
