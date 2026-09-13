import type { Express } from "express";
import { storage } from "../storage";
import {
  insertWorkoutSetSchema,
  updateWorkoutSetSchema,
  insertGoalSchema,
  updateGoalSchema,
  insertNutritionLogSchema,
  insertNutritionGoalSchema,
} from "@shared/schema";
import { fromError } from "zod-validation-error";
import { hashPassword, verifyPassword, isValidEmail, isValidPassword, isValidUsername } from "../auth";
import { requireApiAuth, requireApiSubscription } from "../middleware/apiAuth";
import { getSubscriptionStatus } from "../stripe";
import { searchFoods } from "../food";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshTokenExpiryDate,
} from "../jwt";

function publicUser(user: { id: string; username: string; email: string | null; isAdmin: boolean }) {
  return { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin };
}

async function issueTokenPair(userId: string) {
  const refreshRow = await storage.createRefreshToken(userId, refreshTokenExpiryDate());
  return {
    accessToken: signAccessToken(userId),
    refreshToken: signRefreshToken(userId, refreshRow.id),
  };
}

export function registerApiV1Routes(app: Express) {
  const base = "/api/v1";

  // ==========================================================================
  // AUTH
  // ==========================================================================
  app.post(`${base}/auth/signup`, async (req, res) => {
    try {
      const { username, email, password } = req.body ?? {};
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      const allUsers = await storage.getAllUsers();
      if (allUsers.length >= 100) {
        return res.status(403).json({
          message: "Beta access is currently full. Email chirhostrength@gmail.com to join the waitlist.",
        });
      }
      const usernameValidation = isValidUsername(username);
      if (!usernameValidation.valid) {
        return res.status(400).json({ message: usernameValidation.message });
      }
      const passwordValidation = isValidPassword(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }
      if (email && !isValidEmail(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already taken" });
      }
      if (email && allUsers.some((u) => u.email === email)) {
        return res.status(409).json({ message: "Email already registered" });
      }
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email: email || null,
        passwordHash,
        subscriptionStatus: "inactive",
      });
      const tokens = await issueTokenPair(user.id);
      res.status(201).json({ user: publicUser({ ...user, isAdmin: user.isAdmin || false }), ...tokens });
    } catch (error) {
      console.error("API signup error:", error);
      res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  app.post(`${base}/auth/login`, async (req, res) => {
    try {
      const { username, password } = req.body ?? {};
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      let user = await storage.getUserByUsername(username);
      if (!user && isValidEmail(username)) {
        const allUsers = await storage.getAllUsers();
        user = allUsers.find((u) => u.email === username);
      }
      if (!user || !(await verifyPassword(password, user.passwordHash))) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      const tokens = await issueTokenPair(user.id);
      res.json({ user: publicUser({ ...user, isAdmin: user.isAdmin || false }), ...tokens });
    } catch (error) {
      console.error("API login error:", error);
      res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  app.post(`${base}/auth/refresh`, async (req, res) => {
    try {
      const { refreshToken } = req.body ?? {};
      if (!refreshToken) {
        return res.status(400).json({ message: "refreshToken is required" });
      }
      let payload;
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        return res.status(401).json({ message: "Invalid or expired refresh token" });
      }
      const stored = await storage.getRefreshToken(payload.jti);
      if (!stored || stored.revokedAt || stored.userId !== payload.sub || stored.expiresAt < new Date()) {
        return res.status(401).json({ message: "Refresh token no longer valid" });
      }
      // Rotate: revoke the used token and issue a fresh pair.
      await storage.revokeRefreshToken(stored.id);
      const tokens = await issueTokenPair(payload.sub);
      res.json(tokens);
    } catch (error) {
      console.error("API refresh error:", error);
      res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  app.post(`${base}/auth/logout`, async (req, res) => {
    try {
      const { refreshToken } = req.body ?? {};
      if (refreshToken) {
        try {
          const payload = verifyRefreshToken(refreshToken);
          await storage.revokeRefreshToken(payload.jti);
        } catch {
          // Already invalid/expired — logout is idempotent either way.
        }
      }
      res.status(200).json({ message: "Logged out" });
    } catch (error) {
      console.error("API logout error:", error);
      res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  app.get(`${base}/auth/me`, requireApiAuth, async (req, res) => {
    const user = await storage.getUser(req.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({
      user: publicUser({ ...user, isAdmin: user.isAdmin || false }),
      subscriptionStatus: getSubscriptionStatus(user),
    });
  });

  // ==========================================================================
  // BILLING
  // ==========================================================================
  app.get(`${base}/billing/status`, requireApiAuth, async (req, res) => {
    const user = await storage.getUser(req.userId!);
    if (!user) return res.status(401).json({ message: "User not found" });
    res.json({
      status: getSubscriptionStatus(user),
      subscriptionInterval: user.subscriptionInterval,
      currentPeriodEndsAt: user.currentPeriodEndsAt,
    });
  });

  // ==========================================================================
  // PUSH TOKENS
  // ==========================================================================
  app.post(`${base}/push-tokens`, requireApiAuth, async (req, res) => {
    try {
      const { token, platform } = req.body ?? {};
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "token is required" });
      }
      await storage.upsertPushToken(req.userId!, token, platform ?? null);
      res.status(204).send();
    } catch (error) {
      console.error("API error registering push token:", error);
      res.status(500).json({ message: "Failed to register push token" });
    }
  });

  app.delete(`${base}/push-tokens`, requireApiAuth, async (req, res) => {
    try {
      const { token } = req.body ?? {};
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "token is required" });
      }
      await storage.deletePushToken(token);
      res.status(204).send();
    } catch (error) {
      console.error("API error deleting push token:", error);
      res.status(500).json({ message: "Failed to delete push token" });
    }
  });

  // ==========================================================================
  // WORKOUT SETS
  // ==========================================================================
  app.get(`${base}/workout-sets`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const sets = await storage.getWorkoutSetsForDate(req.userId!, date);
      res.json(sets);
    } catch (error) {
      console.error("API error fetching workout sets:", error);
      res.status(500).json({ message: "Failed to fetch workout sets" });
    }
  });

  app.get(`${base}/workout-sets/all`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const sets = await storage.getAllWorkoutSets(req.userId!);
      res.json(sets);
    } catch (error) {
      console.error("API error fetching all workout sets:", error);
      res.status(500).json({ message: "Failed to fetch workout sets" });
    }
  });

  app.post(`${base}/workout-sets`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const result = insertWorkoutSetSchema.safeParse({ ...req.body, userId: req.userId! });
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      const workoutSet = await storage.createWorkoutSet(result.data);
      res.status(201).json(workoutSet);
    } catch (error) {
      console.error("API error creating workout set:", error);
      res.status(500).json({ message: "Failed to create workout set" });
    }
  });

  app.put(`${base}/workout-sets/:id`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const result = updateWorkoutSetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      const workoutSet = await storage.updateWorkoutSet(req.userId!, id, result.data);
      if (!workoutSet) return res.status(404).json({ message: "Workout set not found" });
      res.json(workoutSet);
    } catch (error) {
      console.error("API error updating workout set:", error);
      res.status(500).json({ message: "Failed to update workout set" });
    }
  });

  app.delete(`${base}/workout-sets/:id`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteWorkoutSet(req.userId!, id);
      res.status(204).send();
    } catch (error) {
      console.error("API error deleting workout set:", error);
      res.status(500).json({ message: "Failed to delete workout set" });
    }
  });

  // ==========================================================================
  // GOALS
  // ==========================================================================
  app.get(`${base}/goals`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      res.json(await storage.getAllGoals(req.userId!));
    } catch (error) {
      console.error("API error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post(`${base}/goals`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const result = insertGoalSchema.safeParse({ ...req.body, userId: req.userId! });
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      const goal = await storage.createGoal(result.data);
      res.status(201).json(goal);
    } catch (error) {
      console.error("API error creating goal:", error);
      res.status(500).json({ message: "Failed to create goal" });
    }
  });

  app.patch(`${base}/goals/:exercise`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const result = updateGoalSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      const goal = await storage.updateGoal(req.userId!, decodeURIComponent(req.params.exercise), result.data);
      if (!goal) return res.status(404).json({ message: "Goal not found" });
      res.json(goal);
    } catch (error) {
      console.error("API error updating goal:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete(`${base}/goals/:id`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteGoal(req.userId!, id);
      res.status(204).send();
    } catch (error) {
      console.error("API error deleting goal:", error);
      res.status(500).json({ message: "Failed to delete goal" });
    }
  });

  // ==========================================================================
  // NUTRITION
  // ==========================================================================
  app.get(`${base}/nutrition`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      res.json(await storage.getNutritionLogsForDate(req.userId!, date));
    } catch (error) {
      console.error("API error fetching nutrition logs:", error);
      res.status(500).json({ message: "Failed to fetch nutrition logs" });
    }
  });

  app.post(`${base}/nutrition`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const result = insertNutritionLogSchema.safeParse({
        ...req.body,
        userId: req.userId!,
        date: new Date(req.body?.date || new Date()),
      });
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      const log = await storage.createNutritionLog(result.data);
      res.status(201).json(log);
    } catch (error) {
      console.error("API error creating nutrition log:", error);
      res.status(500).json({ message: "Failed to log food" });
    }
  });

  app.delete(`${base}/nutrition/:id`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteNutritionLog(req.userId!, id);
      res.status(204).send();
    } catch (error) {
      console.error("API error deleting nutrition log:", error);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  app.post(`${base}/nutrition/goals`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const result = insertNutritionGoalSchema.safeParse({ ...req.body, userId: req.userId! });
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      res.json(await storage.upsertNutritionGoal(result.data));
    } catch (error) {
      console.error("API error saving nutrition goal:", error);
      res.status(500).json({ message: "Failed to save goals" });
    }
  });

  app.get(`${base}/food/search`, requireApiAuth, async (req, res) => {
    try {
      res.json(await searchFoods((req.query.q as string) || ""));
    } catch (error) {
      console.error("API food search error:", error);
      res.status(500).json([]);
    }
  });
}
