CREATE TABLE `question_answer_overrides` (
	`question_id` text PRIMARY KEY NOT NULL,
	`answers_json` text NOT NULL,
	`updated_at` integer NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `question_answer_overrides_updated_at_idx` ON `question_answer_overrides` (`updated_at`);--> statement-breakpoint
ALTER TABLE `attempt_answers` ADD `accepted_readings_json` text DEFAULT '[]' NOT NULL;