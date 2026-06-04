import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// USERS TABLE
// ============================================================================
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  username: text("username").notNull().unique(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  trialEndsAt: integer("trial_ends_at", { mode: "timestamp" }),
  subscriptionStatus: text("subscription_status").default("trial"),
  subscriptionInterval: text("subscription_interval"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEndsAt: integer("current_period_ends_at", { mode: "timestamp" }),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  passwordHash: true,
  subscriptionStatus: true,
  trialEndsAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ============================================================================
// WORKOUT SETS TABLE
// ============================================================================
// shared/schema.ts

export const workoutSets = sqliteTable("workout_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),  // ADD THIS
  exercise: text("exercise").notNull(),
  sets: integer("sets").notNull().default(1),
  weight: integer("weight").notNull(),
  reps: integer("reps").notNull(),
  rpe: real("rpe"),
  date: integer("date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});

export const insertWorkoutSetSchema = createInsertSchema(workoutSets, {
  date: z.string().transform((str) => new Date(str)),
  sets: z.coerce.number().int().positive(),
  weight: z.coerce.number().nonnegative(),
  reps: z.coerce.number().int().positive(),
  rpe: z.coerce.number().min(1).max(10).optional().nullable(),
}).omit({
  id: true,
});

export const updateWorkoutSetSchema = createInsertSchema(workoutSets, {
  date: z.string().transform((str) => new Date(str)),
  sets: z.coerce.number().int().positive(),
  weight: z.coerce.number().nonnegative(),
  reps: z.coerce.number().int().positive(),
  rpe: z.coerce.number().min(1).max(10).optional().nullable(),
}).omit({
  id: true,
}).partial();

export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type UpdateWorkoutSet = z.infer<typeof updateWorkoutSetSchema>;
export type WorkoutSet = typeof workoutSets.$inferSelect;

// ============================================================================
// GOALS TABLE
// ============================================================================
export const goals = sqliteTable("goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  exercise: text("exercise").notNull(),
  current: integer("current").notNull(),
  target: integer("target").notNull(),
  unit: text("unit").notNull().default("lbs"),
}, (table) => ({
  userExerciseUnique: uniqueIndex("goals_user_exercise_unique").on(table.userId, table.exercise),
}));

export const insertGoalSchema = createInsertSchema(goals, {
  current: z.coerce.number().nonnegative(),
  target: z.coerce.number().positive(),
}).omit({
  id: true,
});

export const updateGoalSchema = createInsertSchema(goals, {
  current: z.coerce.number().nonnegative(),
  target: z.coerce.number().positive(),
}).omit({
  id: true,
}).partial();

export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type UpdateGoal = z.infer<typeof updateGoalSchema>;
export type Goal = typeof goals.$inferSelect;
