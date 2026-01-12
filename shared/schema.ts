import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const workoutSets = sqliteTable("workout_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exercise: text("exercise").notNull(),
  sets: integer("sets").notNull().default(1),
  weight: integer("weight").notNull(),
  reps: integer("reps").notNull(),
  rpe: real("rpe"),
  date: integer("date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertWorkoutSetSchema = createInsertSchema(workoutSets).omit({
  id: true,
  date: true,
});

export const updateWorkoutSetSchema = createInsertSchema(workoutSets).omit({
  id: true,
  date: true,
}).partial();

export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type UpdateWorkoutSet = z.infer<typeof updateWorkoutSetSchema>;
export type WorkoutSet = typeof workoutSets.$inferSelect;

export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exercise: text("exercise").notNull().unique(),
  current: integer("current").notNull(),
  target: integer("target").notNull(),
  unit: text("unit").notNull().default("lbs"),
});

export const insertGoalSchema = createInsertSchema(goals).omit({
  id: true,
});

export const updateGoalSchema = createInsertSchema(goals).omit({
  id: true,
}).partial();

export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type UpdateGoal = z.infer<typeof updateGoalSchema>;
export type Goal = typeof goals.$inferSelect;