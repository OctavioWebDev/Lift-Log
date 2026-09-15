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
  // Set on accounts an admin creates with a temp password (e.g. comped
  // coaching clients); forces a password change on next login.
  mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  trialEndsAt: integer("trial_ends_at", { mode: "timestamp" }),
  subscriptionStatus: text("subscription_status").default("trial"),
  subscriptionInterval: text("subscription_interval"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  currentPeriodEndsAt: integer("current_period_ends_at", { mode: "timestamp" }),
  // Lifter profile — all optional, editable from the Profile page.
  fullName: text("full_name"),
  dateOfBirth: integer("date_of_birth", { mode: "timestamp" }),
  sex: text("sex"), // 'male' | 'female' | 'prefer_not_to_say'
  bodyweight: real("bodyweight"), // lbs
  heightInches: real("height_inches"),
  // Public URL path (e.g. "/avatars/<file>") of an uploaded profile
  // picture — see server/routes.ts' POST /profile/avatar.
  avatarUrl: text("avatar_url"),
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
// MEET PREP TABLE
// ============================================================================
// A meet-prep plan generates a batch of future workout_sets rows (one per
// planned training day), tagged via workoutSets.meetPrepId below, so they
// show up as normal editable entries in the Workout Log on their date —
// see server/meet-prep.ts for the generation logic.
export const meetPreps = sqliteTable("meet_preps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  planType: text("plan_type").notNull(), // 'custom' | 'premade' | 'template'
  // Which catalog entry (see server/meet-prep-templates.ts) generated this
  // plan — only set when planType is 'template'.
  templateId: text("template_id"),
  startDate: integer("start_date", { mode: "timestamp" }).notNull(),
  endDate: integer("end_date", { mode: "timestamp" }).notNull(),
  weeks: integer("weeks").notNull(),
  // JSON-encoded array of weekday numbers (0=Sun..6=Sat) the plan trains on.
  trainingDays: text("training_days").notNull(),
  squatMax: integer("squat_max"),
  benchMax: integer("bench_max"),
  deadliftMax: integer("deadlift_max"),
  repScheme: text("rep_scheme"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export type MeetPrep = typeof meetPreps.$inferSelect;
export type InsertMeetPrep = typeof meetPreps.$inferInsert;

// ============================================================================
// USER BADGES TABLE
// ============================================================================
// Gamification: earned achievement badges. The catalog of possible badges
// (name/description/icon) lives in shared/badges.ts — this table only
// records which badge ids a user has earned and when. Awarded automatically
// after workout sets are logged/updated; see server/badges.ts
// computeEarnedBadgeIds and storage.checkAndAwardBadges.
export const userBadges = sqliteTable("user_badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull().references(() => users.id),
  badgeId: text("badge_id").notNull(),
  earnedAt: integer("earned_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
}, (table) => ({
  userBadgeUnique: uniqueIndex("user_badges_user_badge_unique").on(table.userId, table.badgeId),
}));

export type UserBadge = typeof userBadges.$inferSelect;

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
  // Set when this row was generated by a meet-prep plan rather than logged
  // directly by the user — see meetPreps above.
  meetPrepId: integer("meet_prep_id").references(() => meetPreps.id),
  // No SQL-level default on purpose: drizzle-orm's insert path prefers a
  // column's SQL default over $defaultFn whenever both are set, which would
  // make every new row's updatedAt stick at that constant instead of "now".
  // The production column (added onto existing rows) was backfilled via a
  // one-off script, not drizzle-kit push — see scripts/migrate-updated-at.ts.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
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
  // Optional field, but plain HTML forms submit "" (not omitted) when left
  // blank, which z.coerce.number() would otherwise turn into 0 and fail
  // .min(1) — treat blank/null/undefined uniformly as "no RPE given".
  rpe: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.number().min(1).max(10).nullable()
  ).optional(),
}).omit({
  id: true,
});

export const updateWorkoutSetSchema = createInsertSchema(workoutSets, {
  date: z.string().transform((str) => new Date(str)),
  sets: z.coerce.number().int().positive(),
  weight: z.coerce.number().nonnegative(),
  reps: z.coerce.number().int().positive(),
  // Optional field, but plain HTML forms submit "" (not omitted) when left
  // blank, which z.coerce.number() would otherwise turn into 0 and fail
  // .min(1) — treat blank/null/undefined uniformly as "no RPE given".
  rpe: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? null : val),
    z.coerce.number().min(1).max(10).nullable()
  ).optional(),
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
  // Date the user wants to hit the target by; optional.
  targetDate: integer("target_date", { mode: "timestamp" }),
  // No SQL-level default on purpose: drizzle-orm's insert path prefers a
  // column's SQL default over $defaultFn whenever both are set, which would
  // make every new row's updatedAt stick at that constant instead of "now".
  // The production column (added onto existing rows) was backfilled via a
  // one-off script, not drizzle-kit push — see scripts/migrate-updated-at.ts.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}, (table) => ({
  userExerciseUnique: uniqueIndex("goals_user_exercise_unique").on(table.userId, table.exercise),
  clientIdUnique: uniqueIndex("goals_client_id_unique").on(table.clientId),
}));

export const insertGoalSchema = createInsertSchema(goals, {
  current: z.coerce.number().nonnegative(),
  target: z.coerce.number().positive(),
  targetDate: z.string().nullable().optional().transform((val) => (val ? new Date(val) : null)),
}).omit({
  id: true,
});

export const updateGoalSchema = createInsertSchema(goals, {
  current: z.coerce.number().nonnegative(),
  target: z.coerce.number().positive(),
  targetDate: z.string().nullable().optional().transform((val) => (val ? new Date(val) : null)),
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
  // No SQL-level default on purpose: drizzle-orm's insert path prefers a
  // column's SQL default over $defaultFn whenever both are set, which would
  // make every new row's updatedAt stick at that constant instead of "now".
  // The production column (added onto existing rows) was backfilled via a
  // one-off script, not drizzle-kit push — see scripts/migrate-updated-at.ts.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
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
  // No SQL-level default on purpose: drizzle-orm's insert path prefers a
  // column's SQL default over $defaultFn whenever both are set, which would
  // make every new row's updatedAt stick at that constant instead of "now".
  // The production column (added onto existing rows) was backfilled via a
  // one-off script, not drizzle-kit push — see scripts/migrate-updated-at.ts.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
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

// ============================================================================
// FOOD CACHE TABLE
// ============================================================================
// Sanitized results from external food data sources (currently USDA
// FoodData Central), built up incrementally as users search so repeat
// searches are fast, work even if the USDA API is down/rate-limited, and
// only ever hold entries that passed our own sanity checks (see
// server/food.ts) instead of raw USDA data verbatim.
export const foodCache = sqliteTable("food_cache", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fdcId: integer("fdc_id").notNull().unique(),
  name: text("name").notNull(),
  brand: text("brand"),
  servingSize: real("serving_size").notNull(),
  servingUnit: text("serving_unit").notNull().default("g"),
  calories: real("calories").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  searchHits: integer("search_hits").notNull().default(1),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export type FoodCacheEntry = typeof foodCache.$inferSelect;
export type InsertFoodCacheEntry = typeof foodCache.$inferInsert;
