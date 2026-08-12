CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`leave_count` integer DEFAULT 0 NOT NULL,
	`answers_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attempts_student_id_idx` ON `attempts` (`student_id`);--> statement-breakpoint
CREATE INDEX `attempts_created_at_idx` ON `attempts` (`created_at`);--> statement-breakpoint
CREATE TABLE `student_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `student_sessions_student_id_idx` ON `student_sessions` (`student_id`);--> statement-breakpoint
CREATE INDEX `student_sessions_expires_at_idx` ON `student_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `students` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `students_name_unique` ON `students` (`name`);--> statement-breakpoint
CREATE INDEX `students_created_at_idx` ON `students` (`created_at`);