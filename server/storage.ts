import { 
  type User, 
  type InsertUser,
  type WorkoutSet,
  type InsertWorkoutSet,
  type UpdateWorkoutSet,
  type Goal,
  type InsertGoal,
  type UpdateGoal,
  users,
  workoutSets,
  goals
} from "../shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  deleteUser(id: string): Promise<void>;  // ← Add this
  
  getWorkoutSetsForDate(date: string): Promise<WorkoutSet[]>;
  getAllWorkoutSets(): Promise<WorkoutSet[]>;
  createWorkoutSet(workoutSet: InsertWorkoutSet): Promise<WorkoutSet>;
  updateWorkoutSet(id: number, updates: UpdateWorkoutSet): Promise<WorkoutSet | undefined>;
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

  // ← Add this method
  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getWorkoutSetsForDate(date: string): Promise<WorkoutSet[]> {
    // Parse the date string as UTC to avoid timezone issues
    // date format: "YYYY-MM-DD"
    const [year, month, day] = date.split('-').map(Number);
    
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const startTimestamp = startOfDay.getTime();
    
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    const endTimestamp = endOfDay.getTime();
    
    // Get all sets and filter in JavaScript since Drizzle returns Date objects
    const allSets = await db
      .select()
      .from(workoutSets)
      .orderBy(desc(workoutSets.date));
    
    // Filter by date range in JavaScript
    const sets = allSets.filter(set => {
      const setTimestamp = set.date instanceof Date ? set.date.getTime() : set.date;
      return setTimestamp >= startTimestamp && setTimestamp <= endTimestamp;
    });
    
    return sets;
  }

  async getAllWorkoutSets(): Promise<WorkoutSet[]> {
    return db.select().from(workoutSets).orderBy(desc(workoutSets.date));
  }

  async createWorkoutSet(insertWorkoutSet: InsertWorkoutSet): Promise<WorkoutSet> {
    const [workoutSet] = await db
      .insert(workoutSets)
      .values(insertWorkoutSet)
      .returning();
    return workoutSet;
  }

  async updateWorkoutSet(id: number, updates: UpdateWorkoutSet): Promise<WorkoutSet | undefined> {
    const [workoutSet] = await db
      .update(workoutSets)
      .set(updates)
      .where(eq(workoutSets.id, id))
      .returning();
    return workoutSet || undefined;
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