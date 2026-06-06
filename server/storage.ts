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
  users,
  workoutSets,
  goals,
  nutritionLogs,
  nutritionGoals,
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, and, gte, lt } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;
  updateUserSubscription(id: string, data: Partial<{
    trialEndsAt: Date;
    subscriptionStatus: string;
    subscriptionInterval: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEndsAt: Date;
  }>): Promise<User | undefined>;

  // Workout methods — all scoped by userId
  getWorkoutSetsForDate(userId: string, date: string): Promise<WorkoutSet[]>;
  getAllWorkoutSets(userId: string): Promise<WorkoutSet[]>;
  createWorkoutSet(workoutSet: InsertWorkoutSet): Promise<WorkoutSet>;
  updateWorkoutSet(userId: string, id: number, updates: UpdateWorkoutSet): Promise<WorkoutSet | undefined>;
  deleteWorkoutSet(userId: string, id: number): Promise<void>;

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

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async updateUserSubscription(id: string, data: Partial<{
    trialEndsAt: Date;
    subscriptionStatus: string;
    subscriptionInterval: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    currentPeriodEndsAt: Date;
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

  async createWorkoutSet(insertWorkoutSet: InsertWorkoutSet): Promise<WorkoutSet> {
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

}

export const storage = new DatabaseStorage();