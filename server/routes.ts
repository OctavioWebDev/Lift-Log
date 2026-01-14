import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkoutSetSchema, updateWorkoutSetSchema, insertGoalSchema, updateGoalSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { requireAuth, attachUser, hashPassword, verifyPassword, isValidEmail, isValidPassword, isValidUsername } from "./auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============================================================================
  // AUTHENTICATION MIDDLEWARE
  // ============================================================================
  
  // Attach user to all requests
  app.use(attachUser);
  
  // ============================================================================
  // PUBLIC LANDING PAGE
  // ============================================================================
  
  // Landing page (only show if not logged in)
  app.get("/", async (req, res) => {
    // If user is logged in, redirect to workout log
    if (req.session?.userId) {
      return res.redirect("/app");
    }
    
    // If not logged in, show landing page
    res.render("landing", {
      title: "Lift-Log - Track Your Progress, Build Real Strength"
    });
  });
  
  // ============================================================================
  // AUTHENTICATION ROUTES (Public - No auth required)
  // ============================================================================
  
  // Login page
  app.get("/login", (req, res) => {
    if (req.session?.userId) {
      return res.redirect("/app");
    }
    res.render("login", { error: null });
  });

  // Login handler
  app.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.render("login", { error: "Username and password are required" });
      }
      
      // Try to find user by username
      let user = await storage.getUserByUsername(username);
      
      // If not found by username, try email
      if (!user && isValidEmail(username)) {
        const allUsers = await storage.getAllUsers();
        user = allUsers.find(u => u.email === username);
      }
      
      if (!user) {
        return res.render("login", { error: "Invalid username or password" });
      }
      
      // Verify password
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.render("login", { error: "Invalid username or password" });
      }
      
      // Set session
      req.session!.userId = user.id;
      res.redirect("/app");
    } catch (error) {
      console.error("Login error:", error);
      res.render("login", { error: "An error occurred. Please try again." });
    }
  });

  // Signup page
  app.get("/signup", (req, res) => {
    if (req.session?.userId) {
      return res.redirect("/app");
    }
    res.render("signup", { error: null });
  });

  // Signup handler
  app.post("/signup", async (req, res) => {
    try {
      const { username, email, password, confirmPassword } = req.body;
      
      // Validate username
      const usernameValidation = isValidUsername(username);
      if (!usernameValidation.valid) {
        return res.render("signup", { error: usernameValidation.message });
      }
      
      // Validate password
      const passwordValidation = isValidPassword(password);
      if (!passwordValidation.valid) {
        return res.render("signup", { error: passwordValidation.message });
      }
      
      // Check passwords match
      if (password !== confirmPassword) {
        return res.render("signup", { error: "Passwords do not match" });
      }
      
      // Validate email if provided
      if (email && !isValidEmail(email)) {
        return res.render("signup", { error: "Invalid email address" });
      }
      
      // Check if username exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.render("signup", { error: "Username already taken" });
      }
      
      // Check if email exists (if provided)
      if (email) {
        const allUsers = await storage.getAllUsers();
        const emailExists = allUsers.some(u => u.email === email);
        if (emailExists) {
          return res.render("signup", { error: "Email already registered" });
        }
      }
      
      // Hash password and create user
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email: email || null,
        passwordHash,
      });
      
      // Set session
      req.session!.userId = user.id;
      res.redirect("/app");
    } catch (error) {
      console.error("Signup error:", error);
      res.render("signup", { error: "An error occurred. Please try again." });
    }
  });

  // Logout handler
  app.post("/logout", (req, res) => {
    req.session?.destroy(() => {
      res.redirect("/");
    });
  });

  // ============================================================================
  // PAGE ROUTES (Protected - Require authentication)
  // ============================================================================
  
  // Workout Log page
  app.get("/app", requireAuth, async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const workouts = await storage.getWorkoutSetsForDate(date);
      
      res.render("workout-log", {
        title: "Workout Log - Lift-Log",
        date,
        workouts,
        user: req.user
      });
    } catch (error) {
      console.error("Error rendering workout log:", error);
      res.status(500).send("Error loading page");
    }
  });

  // Dashboard page
  app.get("/dashboard", requireAuth, async (req, res) => {
    try {
      // Get stats for dashboard
      const allWorkouts = await storage.getAllWorkoutSets();
      const goals = await storage.getAllGoals();
      
      // Calculate this week's stats
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const workoutsThisWeek = allWorkouts.filter(w => {
        const workoutDate = new Date(w.date);
        return workoutDate >= startOfWeek;
      });
      
      const totalVolume = workoutsThisWeek.reduce((sum, w) => {
        return sum + (w.sets * w.weight * w.reps);
      }, 0);
      
      const stats = {
        workoutsThisWeek: workoutsThisWeek.length,
        totalVolume: totalVolume,
        activeGoals: goals.length
      };
      
      const recentWorkouts = allWorkouts.slice(0, 10);
      
      res.render("dashboard", {
        title: "Dashboard - Lift-Log",
        stats,
        recentWorkouts,
        goals,
        user: req.user
      });
    } catch (error) {
      console.error("Error rendering dashboard:", error);
      res.status(500).send("Error loading dashboard");
    }
  });

  // Goals page
  app.get("/goals", requireAuth, async (req, res) => {
    try {
      const goals = await storage.getAllGoals();
      
      res.render("goals", {
        title: "Goals - Lift-Log",
        goals,
        user: req.user
      });
    } catch (error) {
      console.error("Error rendering goals page:", error);
      res.status(500).send("Error loading page");
    }
  });

  // ============================================================================
  // ADMIN ROUTES (Require admin privileges)
  // ============================================================================

  // Admin Panel
  app.get("/admin", requireAuth, async (req, res) => {
    try {
      // Check if user is admin
      const currentUser = await storage.getUser(req.session!.userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).send("Access denied. Admin privileges required.");
      }
      
      // Get all data
      const users = await storage.getAllUsers();
      const allWorkouts = await storage.getAllWorkoutSets();
      const allGoals = await storage.getAllGoals();
      
      // Calculate stats
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      const activeToday = allWorkouts.filter(w => {
        const workoutDate = new Date(w.date);
        return workoutDate >= startOfDay;
      }).length;
      
      const stats = {
        totalUsers: users.length,
        totalWorkouts: allWorkouts.length,
        totalGoals: allGoals.length,
        activeToday: activeToday,
      };
      
      res.render("admin", {
        title: "Admin Panel - Lift-Log",
        users,
        recentWorkouts: allWorkouts.slice(0, 50),
        allGoals,
        stats,
        user: req.user
      });
    } catch (error) {
      console.error("Error rendering admin panel:", error);
      res.status(500).send("Error loading admin panel");
    }
  });

  // Delete user (admin only)
  app.delete("/admin/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const userId = req.params.id;
      
      // Don't allow deleting yourself
      if (userId === req.session!.userId) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      
      // Delete user
      await storage.deleteUser(userId);
      
      res.status(200).send("");
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ============================================================================
  // API ROUTES (Return JSON or HTML partials for HTMX)
  // ============================================================================
  
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

  app.get("/api/workout-sets-all", async (req, res) => {
    try {
      const sets = await storage.getAllWorkoutSets();
      res.json(sets);
    } catch (error) {
      console.error("Error fetching all workout sets:", error);
      res.status(500).json({ message: "Failed to fetch workout sets" });
    }
  });

  // Create workout set - Returns HTML partial for HTMX
  app.post("/api/workout-sets", async (req, res) => {
    try {
      const result = insertWorkoutSetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send(
          `<div class="text-red-600 p-4">${fromError(result.error).toString()}</div>`
        );
      }
      
      const workoutSet = await storage.createWorkoutSet(result.data);
      
      // Return HTML partial instead of JSON for HTMX
      const html = await new Promise<string>((resolve, reject) => {
        res.app.render("partials/workout-item", { workout: workoutSet }, (err, html) => {
          if (err) reject(err);
          else resolve(html);
        });
      });
      
      res.send(html);
    } catch (error) {
      console.error("Error creating workout set:", error);
      res.status(500).send(
        `<div class="text-red-600 p-4">Failed to create workout set</div>`
      );
    }
  });

  app.put("/api/workout-sets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      const result = updateWorkoutSetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: fromError(result.error).toString() 
        });
      }
      
      const workoutSet = await storage.updateWorkoutSet(id, result.data);
      if (!workoutSet) {
        return res.status(404).json({ message: "Workout set not found" });
      }
      
      res.json(workoutSet);
    } catch (error) {
      console.error("Error updating workout set:", error);
      res.status(500).json({ message: "Failed to update workout set" });
    }
  });

  // Delete workout set - Returns empty for HTMX
  app.delete("/api/workout-sets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      await storage.deleteWorkoutSet(id);
      res.status(200).send("");
    } catch (error) {
      console.error("Error deleting workout set:", error);
      res.status(500).send(
        `<div class="text-red-600 p-4">Failed to delete workout set</div>`
      );
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

  // Create goal - Returns HTML partial for HTMX
  app.post("/api/goals", async (req, res) => {
    try {
      const result = insertGoalSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send(
          `<div class="text-red-600 p-4">${fromError(result.error).toString()}</div>`
        );
      }
      
      const goal = await storage.createGoal(result.data);
      
      // Return HTML partial instead of JSON for HTMX
      const html = await new Promise<string>((resolve, reject) => {
        res.app.render("partials/goal-item", { goal }, (err, html) => {
          if (err) reject(err);
          else resolve(html);
        });
      });
      
      res.send(html);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).send(
        `<div class="text-red-600 p-4">Failed to create goal</div>`
      );
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
      
      const goal = await storage.updateGoal(decodeURIComponent(req.params.exercise), result.data);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      
      res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  // Delete goal - Returns empty for HTMX
  app.delete("/api/goals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      
      await storage.deleteGoal(id);
      res.status(200).send("");
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).send(
        `<div class="text-red-600 p-4">Failed to delete goal</div>`
      );
    }
  });

  // 404 handler - MUST BE LAST!
  app.use((req, res) => {
    res.status(404).render("404", {
      title: "Page Not Found"
    });
  });

  return httpServer;
}