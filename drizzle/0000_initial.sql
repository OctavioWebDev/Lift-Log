CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exercise` text NOT NULL,
	`sets` integer DEFAULT 1 NOT NULL,
	`weight` integer NOT NULL,
	`reps` integer NOT NULL,
	`rpe` real,
	`date` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exercise` text NOT NULL,
	`current` integer NOT NULL,
	`target` integer NOT NULL,
	`unit` text DEFAULT 'lbs' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goals_exercise_unique` ON `goals` (`exercise`);