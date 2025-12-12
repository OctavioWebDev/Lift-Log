import { 
  type User, 
  type InsertUser,
  type WorkoutSet,
  type InsertWorkoutSet,
  type Goal,
  type InsertGoal,
  type UpdateGoal,
  users,
  workoutSets,
  goals
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getWorkoutSetsForDate(date: string): Promise<WorkoutSet[]>;
  createWorkoutSet(workoutSet: InsertWorkoutSet): Promise<WorkoutSet>;
  deleteWorkoutSet(id: number): Promise<void>;
  
  getAllGoals(): Promise<Goal[]>;
  getGoalByExercise(exercise: string): Promise<Goal | undefined>;
  createGoal(goal: InsertGoal): Promise<Goal>;
  updateGoal(exercise: string, updates: UpdateGoal): Promise<Goal | undefined>;
  deleteGoal(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getWorkoutSetsForDate(date: string): Promise<WorkoutSet[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const sets = await db
      .select()
      .from(workoutSets)
      .where(
        sql`${workoutSets.date} >= ${startOfDay} AND ${workoutSets.date} <= ${endOfDay}`
      )
      .orderBy(desc(workoutSets.date));
    
    return sets;
  }

  async createWorkoutSet(insertWorkoutSet: InsertWorkoutSet): Promise<WorkoutSet> {
    const [workoutSet] = await db
      .insert(workoutSets)
      .values(insertWorkoutSet)
      .returning();
    return workoutSet;
  }

  async deleteWorkoutSet(id: number): Promise<void> {
    await db.delete(workoutSets).where(eq(workoutSets.id, id));
  }

  async getAllGoals(): Promise<Goal[]> {
    return db.select().from(goals);
  }

  async getGoalByExercise(exercise: string): Promise<Goal | undefined> {
    const [goal] = await db.select().from(goals).where(eq(goals.exercise, exercise));
    return goal || undefined;
  }

  async createGoal(insertGoal: InsertGoal): Promise<Goal> {
    const [goal] = await db
      .insert(goals)
      .values(insertGoal)
      .returning();
    return goal;
  }

  async updateGoal(exercise: string, updates: UpdateGoal): Promise<Goal | undefined> {
    const [goal] = await db
      .update(goals)
      .set(updates)
      .where(eq(goals.exercise, exercise))
      .returning();
    return goal || undefined;
  }

  async deleteGoal(id: number): Promise<void> {
    await db.delete(goals).where(eq(goals.id, id));
  }
}

export const storage = new DatabaseStorage();
