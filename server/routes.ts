import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkoutSetSchema, insertGoalSchema, updateGoalSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.get("/api/workout-sets", async (req, res) => {
    try {
      const date = req.query.date as string || new Date().toISOString().split('T')[0];
      const sets = await storage.getWorkoutSetsForDate(date);
      res.json(sets);
    } catch (error) {
      console.error("Error fetching workout sets:", error);
      res.status(500).json({ message: "Failed to fetch workout sets" });
    }
  });

  app.post("/api/workout-sets", async (req, res) => {
    try {
      const result = insertWorkoutSetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromError(result.error).toString() 
        });
      }
      
      const workoutSet = await storage.createWorkoutSet(result.data);
      res.status(201).json(workoutSet);
    } catch (error) {
      console.error("Error creating workout set:", error);
      res.status(500).json({ message: "Failed to create workout set" });
    }
  });

  app.delete("/api/workout-sets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      await storage.deleteWorkoutSet(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting workout set:", error);
      res.status(500).json({ message: "Failed to delete workout set" });
    }
  });

  app.get("/api/goals", async (req, res) => {
    try {
      const goals = await storage.getAllGoals();
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const result = insertGoalSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromError(result.error).toString() 
        });
      }
      
      const goal = await storage.createGoal(result.data);
      res.status(201).json(goal);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.patch("/api/goals/:exercise", async (req, res) => {
    try {
      const result = updateGoalSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromError(result.error).toString() 
        });
      }
      
      const goal = await storage.updateGoal(req.params.exercise, result.data);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  return httpServer;
}
