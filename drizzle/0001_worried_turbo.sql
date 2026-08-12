DROP TABLE IF EXISTS `attempt_answers`;
--> statement-breakpoint
DROP TABLE `attempts`;
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`level` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`leave_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_student_id_idx` ON `attempts` (`student_id`);
--> statement-breakpoint
CREATE INDEX `attempts_level_idx` ON `attempts` (`level`);
--> statement-breakpoint
CREATE INDEX `attempts_created_at_idx` ON `attempts` (`created_at`);
--> statement-breakpoint
CREATE TABLE `attempt_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`question_order` integer NOT NULL,
	`level` text NOT NULL,
	`word` text NOT NULL,
	`sentence` text NOT NULL,
	`reading` text NOT NULL,
	`kind` text NOT NULL,
	`response` text NOT NULL,
	`correct` integer NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `attempts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempt_answers_attempt_id_idx` ON `attempt_answers` (`attempt_id`);
--> statement-breakpoint
CREATE INDEX `attempt_answers_question_id_idx` ON `attempt_answers` (`question_id`);
--> statement-breakpoint
CREATE INDEX `attempt_answers_level_idx` ON `attempt_answers` (`level`);
