import {
  type User,
  type InsertUser,
  type WorkoutSet,
  type InsertWorkoutSet,
  type UpdateWorkoutSet,
  type Goal,
  type InsertGoal,
  type UpdateGoal,
  type NutritionLog,
  type InsertNutritionLog,
  type NutritionGoal,
  type InsertNutritionGoal,
  type RefreshToken,
  type PushToken,
  type FoodCacheEntry,
  users,
  workoutSets,
  goals,
  nutritionLogs,
  nutritionGoals,
  refreshTokens,
  pushTokens,
  foodCache,
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, gte, lt } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  // Admin-created free account (e.g. a comped coaching client) — gets
  // lifetime access and must change the given temp password on first login.
  createClientAccount(data: { username: string; email: string | null; passwordHash: string }): Promise<User>;
  deleteUser(id: string): Promise<void>;
  updateUserSubscription(id: string, data: Partial<{
    trialEndsAt: Date | null;
    subscriptionStatus: string;
    subscriptionInterval: string | null;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEndsAt: Date | null;
  }>): Promise<User | undefined>;
  updateUser(id: string, data: Partial<{
    passwordHash: string;
    mustChangePassword: boolean;
  }>): Promise<User | undefined>;

  // Workout methods — all scoped by userId
  getWorkoutSet(userId: string, id: number): Promise<WorkoutSet | undefined>;
  getWorkoutSetsForDate(userId: string, date: string): Promise<WorkoutSet[]>;
  getAllWorkoutSets(userId: string): Promise<WorkoutSet[]>;
  createWorkoutSet(workoutSet: InsertWorkoutSet): Promise<WorkoutSet>;
  updateWorkoutSet(userId: string, id: number, updates: UpdateWorkoutSet): Promise<WorkoutSet | undefined>;
  deleteWorkoutSet(userId: string, id: number): Promise<void>;

  // Recomputes a goal's `current` from the best estimated 1RM (Epley) ever
  // logged for that exercise, so goal progress tracks workout history
  // automatically. No-op if the user has no goal for that exercise, or has
  // no logged sets for it yet (keeps whatever `current` was set manually).
  syncGoalCurrentFromHistory(userId: string, exercise: string): Promise<void>;

  // Goal methods — all scoped by userId
  getAllGoals(userId: string): Promise<Goal[]>;
  getGoalByExercise(userId: string, exercise: string): Promise<Goal | undefined>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(userId: string, exercise: string, updates: UpdateGoal): Promise<Goal | undefined>;
  deleteGoal(userId: string, id: number): Promise<void>;

  // Admin methods — no userId filter
  getAllWorkoutSetsAdmin(): Promise<WorkoutSet[]>;
  getAllGoalsAdmin(): Promise<Goal[]>;

  // Nutrition log methods
  getNutritionLogsForDate(userId: string, date: string): Promise<NutritionLog[]>;
  createNutritionLog(log: InsertNutritionLog): Promise<NutritionLog>;
  deleteNutritionLog(userId: string, id: number): Promise<void>;

  // Nutrition goal methods
  getNutritionGoal(userId: string): Promise<NutritionGoal | undefined>;
  upsertNutritionGoal(goal: InsertNutritionGoal): Promise<NutritionGoal>;

  // Food cache methods (sanitized, locally-cached food search results)
  searchCachedFoods(query: string, limit?: number): Promise<FoodCacheEntry[]>;
  upsertCachedFood(entry: {
    fdcId: number;
    name: string;
    brand: string | null;
    servingSize: number;
    servingUnit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }): Promise<FoodCacheEntry>;

  // Progress / chart methods
  getExerciseNames(userId: string): Promise<string[]>;
  getStrongestExercise(userId: string): Promise<string | undefined>;
  getExerciseHistory(userId: string, exercise: string): Promise<WorkoutSet[]>;
  getWorkoutDatesInRange(userId: string, days: number): Promise<string[]>;
  getNutritionHistory(userId: string, days: number): Promise<Array<{
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>>;

  // Refresh token methods (mobile JWT auth)
  createRefreshToken(userId: string, expiresAt: Date): Promise<RefreshToken>;
  getRefreshToken(id: string): Promise<RefreshToken | undefined>;
  revokeRefreshToken(id: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: string): Promise<void>;

  // Push token methods (mobile push notifications)
  upsertPushToken(userId: string, token: string, platform: string | null): Promise<PushToken>;
  deletePushToken(token: string): Promise<void>;
  getAllPushTokens(): Promise<PushToken[]>;
}

export class DatabaseStorage implements IStorage {

  // ─── User Methods ────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async createClientAccount(data: { username: string; email: string | null; passwordHash: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...data,
        subscriptionStatus: "active",
        subscriptionInterval: "lifetime",
        mustChangePassword: true,
      })
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUserSubscription(id: string, data: Partial<{
    trialEndsAt: Date | null;
    subscriptionStatus: string;
    subscriptionInterval: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodEndsAt: Date | null;
  }>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async updateUser(id: string, data: Partial<{
    passwordHash: string;
    mustChangePassword: boolean;
  }>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  // ─── Workout Methods ─────────────────────────────────────────────────────────

  async getWorkoutSetsForDate(userId: string, date: string): Promise<WorkoutSet[]> {
    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

    const allSets = await db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.userId, userId))
      .orderBy(desc(workoutSets.date));

    return allSets.filter(set => {
      const ts = set.date instanceof Date ? set.date.getTime() : set.date;
      return ts >= startOfDay.getTime() && ts <= endOfDay.getTime();
    });
  }

  async getAllWorkoutSets(userId: string): Promise<WorkoutSet[]> {
    return db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.userId, userId))
      .orderBy(desc(workoutSets.date));
  }

  async getWorkoutSet(userId: string, id: number): Promise<WorkoutSet | undefined> {
    const [workoutSet] = await db
      .select()
      .from(workoutSets)
      .where(and(eq(workoutSets.id, id), eq(workoutSets.userId, userId)));
    return workoutSet || undefined;
  }

  async createWorkoutSet(insertWorkoutSet: InsertWorkoutSet): Promise<WorkoutSet> {
    if (insertWorkoutSet.clientId) {
      const [existing] = await db
        .select()
        .from(workoutSets)
        .where(eq(workoutSets.clientId, insertWorkoutSet.clientId));
      if (existing) return existing;
    }
    const [workoutSet] = await db
      .insert(workoutSets)
      .values(insertWorkoutSet)
      .returning();
    return workoutSet;
  }

  async updateWorkoutSet(userId: string, id: number, updates: UpdateWorkoutSet): Promise<WorkoutSet | undefined> {
    const [workoutSet] = await db
      .update(workoutSets)
      .set(updates)
      .where(and(eq(workoutSets.id, id), eq(workoutSets.userId, userId)))
      .returning();
    return workoutSet || undefined;
  }

  async deleteWorkoutSet(userId: string, id: number): Promise<void> {
    await db
      .delete(workoutSets)
      .where(and(eq(workoutSets.id, id), eq(workoutSets.userId, userId)));
  }

  async syncGoalCurrentFromHistory(userId: string, exercise: string): Promise<void> {
    const goal = await this.getGoalByExercise(userId, exercise);
    if (!goal) return;

    const rows = await db
      .select({ weight: workoutSets.weight, reps: workoutSets.reps })
      .from(workoutSets)
      .where(and(eq(workoutSets.userId, userId), eq(workoutSets.exercise, exercise)));
    if (rows.length === 0) return;

    let bestOneRepMax = -Infinity;
    for (const row of rows) {
      const estimatedOneRepMax = row.weight * (1 + row.reps / 30);
      if (estimatedOneRepMax > bestOneRepMax) bestOneRepMax = estimatedOneRepMax;
    }

    const current = Math.round(bestOneRepMax);
    if (current !== goal.current) {
      await db.update(goals).set({ current }).where(eq(goals.id, goal.id));
    }
  }

  // ─── Goal Methods ────────────────────────────────────────────────────────────

  async getAllGoals(userId: string): Promise<Goal[]> {
    return db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId));
  }

  async getGoalByExercise(userId: string, exercise: string): Promise<Goal | undefined> {
    const [goal] = await db
      .select()
      .from(goals)
      .where(and(eq(goals.userId, userId), eq(goals.exercise, exercise)));
    return goal || undefined;
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    if (insertGoal.clientId) {
      const [existing] = await db.select().from(goals).where(eq(goals.clientId, insertGoal.clientId));
      if (existing) return existing;
    }
    const [goal] = await db
      .insert(goals)
      .values(insertGoal)
      .returning();
    return goal;
  }

  async updateGoal(userId: string, exercise: string, updates: UpdateGoal): Promise<Goal | undefined> {
    const [goal] = await db
      .update(goals)
      .set(updates)
      .where(and(eq(goals.userId, userId), eq(goals.exercise, exercise)))
      .returning();
    return goal || undefined;
  }

  async deleteGoal(userId: string, id: number): Promise<void> {
    await db
      .delete(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));
  }

  // ─── Admin Methods ────────────────────────────────────────────────────────────

  async getAllWorkoutSetsAdmin(): Promise<WorkoutSet[]> {
    return db.select().from(workoutSets).orderBy(desc(workoutSets.date));
  }

  async getAllGoalsAdmin(): Promise<Goal[]> {
    return db.select().from(goals);
  }

  // ─── Nutrition Log Methods ────────────────────────────────────────────────────

  async getNutritionLogsForDate(userId: string, date: string): Promise<NutritionLog[]> {
    const start = new Date(date + "T00:00:00");
    const end = new Date(date + "T23:59:59");
    return db
      .select()
      .from(nutritionLogs)
      .where(and(
        eq(nutritionLogs.userId, userId),
        gte(nutritionLogs.date, start),
        lt(nutritionLogs.date, new Date(end.getTime() + 1000))
      ))
      .orderBy(nutritionLogs.date);
  }

  async createNutritionLog(log: InsertNutritionLog): Promise<NutritionLog> {
    if (log.clientId) {
      const [existing] = await db
        .select()
        .from(nutritionLogs)
        .where(eq(nutritionLogs.clientId, log.clientId));
      if (existing) return existing;
    }
    const [entry] = await db.insert(nutritionLogs).values(log).returning();
    return entry;
  }

  async deleteNutritionLog(userId: string, id: number): Promise<void> {
    await db.delete(nutritionLogs).where(
      and(eq(nutritionLogs.id, id), eq(nutritionLogs.userId, userId))
    );
  }

  // ─── Nutrition Goal Methods ────────────────────────────────────────────────────

  async getNutritionGoal(userId: string): Promise<NutritionGoal | undefined> {
    const [goal] = await db.select().from(nutritionGoals).where(eq(nutritionGoals.userId, userId));
    return goal;
  }

  async upsertNutritionGoal(goal: InsertNutritionGoal): Promise<NutritionGoal> {
    const existing = await this.getNutritionGoal(goal.userId);
    if (existing) {
      const [updated] = await db
        .update(nutritionGoals)
        .set({ calories: goal.calories, protein: goal.protein, carbs: goal.carbs, fat: goal.fat })
        .where(eq(nutritionGoals.userId, goal.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(nutritionGoals).values(goal).returning();
    return created;
  }

  // ─── Food Cache Methods ───────────────────────────────────────────────────────

  async searchCachedFoods(query: string, limit = 20): Promise<FoodCacheEntry[]> {
    const pattern = `%${query}%`;
    return db
      .select()
      .from(foodCache)
      .where(or(like(foodCache.name, pattern), like(foodCache.brand, pattern)))
      .orderBy(desc(foodCache.searchHits))
      .limit(limit);
  }

  async upsertCachedFood(entry: {
    fdcId: number;
    name: string;
    brand: string | null;
    servingSize: number;
    servingUnit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }): Promise<FoodCacheEntry> {
    const [existing] = await db.select().from(foodCache).where(eq(foodCache.fdcId, entry.fdcId));
    if (existing) {
      const [updated] = await db
        .update(foodCache)
        .set({ ...entry, searchHits: existing.searchHits + 1 })
        .where(eq(foodCache.fdcId, entry.fdcId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(foodCache).values(entry).returning();
    return created;
  }

  // ─── Progress / Chart Methods ─────────────────────────────────────────────────

  async getExerciseNames(userId: string): Promise<string[]> {
    const rows = await db
      .select({ exercise: workoutSets.exercise })
      .from(workoutSets)
      .where(eq(workoutSets.userId, userId));
    return Array.from(new Set(rows.map((r) => r.exercise))).sort();
  }

  async getStrongestExercise(userId: string): Promise<string | undefined> {
    const rows = await db
      .select({ exercise: workoutSets.exercise, weight: workoutSets.weight, reps: workoutSets.reps })
      .from(workoutSets)
      .where(eq(workoutSets.userId, userId));

    let best: string | undefined;
    let bestOneRepMax = -Infinity;
    for (const row of rows) {
      // Epley formula, matching /api/stats/exercise-history's PR calculation.
      const estimatedOneRepMax = row.weight * (1 + row.reps / 30);
      if (estimatedOneRepMax > bestOneRepMax) {
        bestOneRepMax = estimatedOneRepMax;
        best = row.exercise;
      }
    }
    return best;
  }

  async getExerciseHistory(userId: string, exercise: string): Promise<WorkoutSet[]> {
    return db
      .select()
      .from(workoutSets)
      .where(and(eq(workoutSets.userId, userId), eq(workoutSets.exercise, exercise)))
      .orderBy(workoutSets.date);
  }

  async getWorkoutDatesInRange(userId: string, days: number): Promise<string[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await db
      .select({ date: workoutSets.date })
      .from(workoutSets)
      .where(and(eq(workoutSets.userId, userId), gte(workoutSets.date, since)));
    const dates = new Set(
      rows.map((r) => (r.date instanceof Date ? r.date : new Date(r.date)).toISOString().split("T")[0])
    );
    return Array.from(dates);
  }

  async getNutritionHistory(userId: string, days: number): Promise<Array<{
    date: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>> {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const rows = await db
      .select()
      .from(nutritionLogs)
      .where(and(eq(nutritionLogs.userId, userId), gte(nutritionLogs.date, since)));

    const byDate = new Map<string, { calories: number; protein: number; carbs: number; fat: number }>();
    for (const log of rows) {
      const key = (log.date instanceof Date ? log.date : new Date(log.date)).toISOString().split("T")[0];
      const acc = byDate.get(key) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
      acc.calories += log.calories;
      acc.protein += log.protein;
      acc.carbs += log.carbs;
      acc.fat += log.fat;
      byDate.set(key, acc);
    }

    const result: Array<{ date: string; calories: number; protein: number; carbs: number; fat: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      const acc = byDate.get(key) || { calories: 0, protein: 0, carbs: 0, fat: 0 };
      result.push({ date: key, ...acc });
    }
    return result;
  }

  // ─── Refresh Token Methods ────────────────────────────────────────────────────

  async createRefreshToken(userId: string, expiresAt: Date): Promise<RefreshToken> {
    const [token] = await db
      .insert(refreshTokens)
      .values({ userId, expiresAt })
      .returning();
    return token;
  }

  async getRefreshToken(id: string): Promise<RefreshToken | undefined> {
    const [token] = await db.select().from(refreshTokens).where(eq(refreshTokens.id, id));
    return token || undefined;
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, id));
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, userId));
  }

  // ─── Push Token Methods ────────────────────────────────────────────────────────

  async upsertPushToken(userId: string, token: string, platform: string | null): Promise<PushToken> {
    const [row] = await db
      .insert(pushTokens)
      .values({ userId, token, platform })
      .onConflictDoUpdate({
        target: pushTokens.token,
        set: { userId, platform },
      })
      .returning();
    return row;
  }

  async deletePushToken(token: string): Promise<void> {
    await db.delete(pushTokens).where(eq(pushTokens.token, token));
  }

  async getAllPushTokens(): Promise<PushToken[]> {
    return db.select().from(pushTokens);
  }

}

export const storage = new DatabaseStorage();