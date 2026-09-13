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
// REFRESH TOKENS TABLE (mobile JWT auth)
// ============================================================================
export const refreshTokens = sqliteTable("refresh_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
});

export type RefreshToken = typeof refreshTokens.$inferSelect;

// ============================================================================
// PUSH TOKENS TABLE (mobile push notifications)
// ============================================================================
export const pushTokens = sqliteTable("push_tokens", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => users.id),
  // Expo push token, e.g. "ExponentPushToken[xxxxxxxx]" — unique per device+app
  // install, so re-registering the same device under a different account moves
  // ownership rather than creating a duplicate row (see storage.upsertPushToken).
  token: text("token").notNull().unique(),
  platform: text("platform"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type PushToken = typeof pushTokens.$inferSelect;

// ============================================================================
// WORKOUT SETS TABLE
// ============================================================================
// shared/schema.ts

export const workoutSets = sqliteTable("workout_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),  // ADD THIS
  // Set by offline clients at creation time so a retried sync push can't create a
  // duplicate — see storage.ts createWorkoutSet, which upserts on this column.
  clientId: text("client_id"),
  exercise: text("exercise").notNull(),
  sets: integer("sets").notNull().default(1),
  weight: integer("weight").notNull(),
  reps: integer("reps").notNull(),
  rpe: real("rpe"),
  date: integer("date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  // SQLite's ALTER TABLE ADD COLUMN only accepts a literal constant default
  // (not a function call like unixepoch()), so existing rows get backfilled
  // with 0 here; a one-time UPDATE sets them to a real timestamp right after
  // the migration runs. New rows always get a real Date from $defaultFn.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`0`)
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => ({
  clientIdUnique: uniqueIndex("workout_sets_client_id_unique").on(table.clientId),
}));

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
  clientId: text("client_id"),
  exercise: text("exercise").notNull(),
  current: integer("current").notNull(),
  target: integer("target").notNull(),
  unit: text("unit").notNull().default("lbs"),
  // SQLite's ALTER TABLE ADD COLUMN only accepts a literal constant default
  // (not a function call like unixepoch()), so existing rows get backfilled
  // with 0 here; a one-time UPDATE sets them to a real timestamp right after
  // the migration runs. New rows always get a real Date from $defaultFn.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`0`)
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => ({
  userExerciseUnique: uniqueIndex("goals_user_exercise_unique").on(table.userId, table.exercise),
  clientIdUnique: uniqueIndex("goals_client_id_unique").on(table.clientId),
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

// ============================================================================
// NUTRITION LOGS TABLE
// ============================================================================
export const nutritionLogs = sqliteTable("nutrition_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  clientId: text("client_id"),
  date: integer("date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  foodName: text("food_name").notNull(),
  brandName: text("brand_name"),
  servingSize: real("serving_size").notNull().default(1),
  servingUnit: text("serving_unit").notNull().default("serving"),
  calories: real("calories").notNull().default(0),
  protein: real("protein").notNull().default(0),
  carbs: real("carbs").notNull().default(0),
  fat: real("fat").notNull().default(0),
  // SQLite's ALTER TABLE ADD COLUMN only accepts a literal constant default
  // (not a function call like unixepoch()), so existing rows get backfilled
  // with 0 here; a one-time UPDATE sets them to a real timestamp right after
  // the migration runs. New rows always get a real Date from $defaultFn.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`0`)
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => ({
  clientIdUnique: uniqueIndex("nutrition_logs_client_id_unique").on(table.clientId),
}));

export const insertNutritionLogSchema = createInsertSchema(nutritionLogs, {
  servingSize: z.coerce.number().positive(),
  calories: z.coerce.number().nonnegative(),
  protein: z.coerce.number().nonnegative(),
  carbs: z.coerce.number().nonnegative(),
  fat: z.coerce.number().nonnegative(),
}).omit({ id: true });

export type InsertNutritionLog = z.infer<typeof insertNutritionLogSchema>;
export type NutritionLog = typeof nutritionLogs.$inferSelect;

// ============================================================================
// NUTRITION GOALS TABLE
// ============================================================================
export const nutritionGoals = sqliteTable("nutrition_goals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().unique().references(() => users.id),
  calories: real("calories").notNull().default(2000),
  protein: real("protein").notNull().default(150),
  carbs: real("carbs").notNull().default(200),
  fat: real("fat").notNull().default(65),
  // SQLite's ALTER TABLE ADD COLUMN only accepts a literal constant default
  // (not a function call like unixepoch()), so existing rows get backfilled
  // with 0 here; a one-time UPDATE sets them to a real timestamp right after
  // the migration runs. New rows always get a real Date from $defaultFn.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`0`)
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const insertNutritionGoalSchema = createInsertSchema(nutritionGoals, {
  calories: z.coerce.number().positive(),
  protein: z.coerce.number().nonnegative(),
  carbs: z.coerce.number().nonnegative(),
  fat: z.coerce.number().nonnegative(),
}).omit({ id: true });

export type InsertNutritionGoal = z.infer<typeof insertNutritionGoalSchema>;
export type NutritionGoal = typeof nutritionGoals.$inferSelect;
