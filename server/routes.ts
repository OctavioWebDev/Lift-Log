import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkoutSetSchema, updateWorkoutSetSchema, insertGoalSchema, updateGoalSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { requireAuth, attachUser, hashPassword, verifyPassword, isValidEmail, isValidPassword, isValidUsername } from "./auth";
import { stripe, ANNUAL_PRICE_ID, getSubscriptionStatus } from "./stripe";
import { requireSubscription } from "./middleware/subscription";
import { ALL_EXERCISES, EXERCISES } from "@shared/exercises";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============================================================================
  // AUTHENTICATION MIDDLEWARE
  // ============================================================================
  app.use(attachUser);

  // ============================================================================
  // PUBLIC LANDING PAGE
  // ============================================================================
  app.get("/", async (req, res) => {
    if (req.session?.userId) {
      return res.redirect("/app");
    }
    res.render("landing", {
      title: "Lift-Log - Track Your Progress, Build Real Strength"
    });
  });

  // ============================================================================
  // AUTHENTICATION ROUTES
  // ============================================================================
  app.get("/login", (req, res) => {
    if (req.session?.userId) {
      return res.redirect("/app");
    }
    res.render("login", { error: null });
  });

  app.post("/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.render("login", { error: "Username and password are required" });
      }
      let user = await storage.getUserByUsername(username);
      if (!user && isValidEmail(username)) {
        const allUsers = await storage.getAllUsers();
        user = allUsers.find(u => u.email === username);
      }
      if (!user) {
        return res.render("login", { error: "Invalid username or password" });
      }
      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return res.render("login", { error: "Invalid username or password" });
      }
      req.session!.userId! = user.id;
      res.redirect("/app");
    } catch (error) {
      console.error("Login error:", error);
      res.render("login", { error: "An error occurred. Please try again." });
    }
  });

  app.get("/signup", (req, res) => {
    if (req.session?.userId) {
      return res.redirect("/app");
    }
    res.render("signup", { error: null });
  });

  app.post("/signup", async (req, res) => {
    try {
      const { username, email, password, confirmPassword } = req.body;
      if (!username || !password || !confirmPassword) {
        return res.render("signup", { error: "Username and password are required" });
      }
      const allUsers = await storage.getAllUsers();
      if (allUsers.length >= 100) {
        return res.render("signup", {
          error: "Beta access is currently full. Email chirhostrength@gmail.com to join the waitlist."
        });
      }
      const usernameValidation = isValidUsername(username);
      if (!usernameValidation.valid) {
        return res.render("signup", { error: usernameValidation.message });
      }
      const passwordValidation = isValidPassword(password);
      if (!passwordValidation.valid) {
        return res.render("signup", { error: passwordValidation.message });
      }
      if (password !== confirmPassword) {
        return res.render("signup", { error: "Passwords do not match" });
      }
      if (email && !isValidEmail(email)) {
        return res.render("signup", { error: "Invalid email address" });
      }
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.render("signup", { error: "Username already taken" });
      }
      if (email) {
        const emailExists = allUsers.some(u => u.email === email);
        if (emailExists) {
          return res.render("signup", { error: "Email already registered" });
        }
      }
      const passwordHash = await hashPassword(password);
      const user = await storage.createUser({
        username,
        email: email || null,
        passwordHash,
        subscriptionStatus: "inactive",
      });
      req.session!.userId! = user.id;
      res.redirect("/billing");
    } catch (error) {
      console.error("Signup error:", error);
      res.render("signup", { error: "An error occurred. Please try again." });
    }
  });

  app.post("/logout", (req, res) => {
    req.session?.destroy(() => {
      res.redirect("/");
    });
  });

  // ============================================================================
  // PAGE ROUTES (Protected)
  // ============================================================================
  app.get("/app", requireSubscription, async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
      const workouts = await storage.getWorkoutSetsForDate(req.session!.userId!, date);
      const goals = await storage.getAllGoals(req.session!.userId!);

      res.render("workout-log", {
        title: "Workout Log - Lift-Log",
        workouts,
        goals,
        date,
        user: req.user,
        exercises: ALL_EXERCISES,
        exerciseGroups: EXERCISES,
      });
    } catch (error) {
      console.error("Error rendering workout log:", error);
      res.status(500).send("Error loading page");
    }
  });

  app.get("/dashboard", requireSubscription, async (req, res) => {
    try {
      const allWorkouts = await storage.getAllWorkoutSets(req.session!.userId!);
      const goals = await storage.getAllGoals(req.session!.userId!);

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

  app.get("/goals", requireSubscription, async (req, res) => {
    try {
      const goals = await storage.getAllGoals(req.session!.userId!);
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
  // ADMIN ROUTES
  // ============================================================================
  app.get("/admin", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId!);
      if (!currentUser?.isAdmin) {
        return res.status(403).send("Access denied. Admin privileges required.");
      }
      const users = await storage.getAllUsers();
      const allWorkouts = await storage.getAllWorkoutSetsAdmin();
      const allGoals = await storage.getAllGoalsAdmin();
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

  app.delete("/admin/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId!);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      const userId = req.params.id;
      if (userId === req.session!.userId!) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }
      await storage.deleteUser(userId);
      res.status(200).send("");
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // ============================================================================
  // BILLING ROUTES
  // ============================================================================
  app.get("/billing", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session!.userId!);
    if (!user) return res.redirect("/login");
    const status = getSubscriptionStatus(user);
    res.render("billing", {
      title: "Billing - Lift-Log",
      user,
      status,
      periodEndsAt: user.currentPeriodEndsAt,
      error: req.query.error === "true",
    });
  });

  app.post("/billing/checkout", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId!);
      if (!user) return res.redirect("/login");
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: ANNUAL_PRICE_ID, quantity: 1 }],
        success_url: `${req.protocol}://${req.get("host")}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get("host")}/billing`,
        customer_email: user.email ?? undefined,
        metadata: { userId: user.id },
        subscription_data: { metadata: { userId: user.id } },
      });
      res.redirect(session.url!);
    } catch (error) {
      console.error("Checkout error:", error);
      res.redirect("/billing?error=true");
    }
  });

  app.get("/billing/success", requireAuth, async (req, res) => {
    res.render("billing-success", {
      title: "Subscription Active - Lift-Log",
      user: req.user,
    });
  });

  app.post("/billing/cancel", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId!);
      if (!user || !user.stripeSubscriptionId) return res.redirect("/billing");
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      res.render("billing-cancel", {
        title: "Subscription Cancelled - Lift-Log",
        user: req.user,
      });
    } catch (error) {
      console.error("Cancel error:", error);
      res.redirect("/billing?error=true");
    }
  });

  app.post("/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(400).send("Webhook secret not configured");
    }
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(400).send("Webhook signature verification failed");
    }
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as any;
          const userId = session.metadata?.userId;
          if (!userId) break;
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await storage.updateUserSubscription(userId, {
            subscriptionStatus: "active",
            subscriptionInterval: "annual",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            currentPeriodEndsAt: new Date((subscription as any).current_period_end * 1000),
          });
          break;
        }
        case "invoice.payment_succeeded": {
          const invoice = event.data.object as any;
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          const userId = (subscription as any).metadata?.userId;
          if (!userId) break;
          await storage.updateUserSubscription(userId!, {
            subscriptionStatus: "active",
            currentPeriodEndsAt: new Date((subscription as any).current_period_end * 1000),
          });
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object as any;
          const userId = subscription.metadata?.userId;
          if (!userId) break;
          await storage.updateUserSubscription(userId!, {
            subscriptionStatus: "expired",
          });
          break;
        }
      }
      res.json({ received: true });
    } catch (error) {
      console.error("Webhook handler error:", error);
      res.status(500).json({ error: "Webhook handler failed" });
    }
  });

  // ============================================================================
  // API ROUTES
  // ============================================================================
  app.get("/api/workout-sets", requireAuth, async (req, res) => {
    try {
      const date = req.query.date as string || new Date().toISOString().split('T')[0];
      const sets = await storage.getWorkoutSetsForDate(req.session!.userId!, date);
      res.json(sets);
    } catch (error) {
      console.error("Error fetching workout sets:", error);
      res.status(500).json({ message: "Failed to fetch workout sets" });
    }
  });

  app.get("/api/workout-sets-all", requireAuth, async (req, res) => {
    try {
      const sets = await storage.getAllWorkoutSets(req.session!.userId!);
      res.json(sets);
    } catch (error) {
      console.error("Error fetching all workout sets:", error);
      res.status(500).json({ message: "Failed to fetch workout sets" });
    }
  });

  app.post("/api/workout-sets", requireAuth, async (req, res) => {
    try {
      const result = insertWorkoutSetSchema.safeParse({
        ...req.body,
        userId: req.session!.userId!,
      });
      if (!result.success) {
        return res.status(400).send(
          `<div class="text-red-600 p-4">${fromError(result.error).toString()}</div>`
        );
      }
      const workoutSet = await storage.createWorkoutSet(result.data);
      const html = await new Promise<string>((resolve, reject) => {
        res.app.render("partials/workout-item", { workout: workoutSet }, (err, html) => {
          if (err) reject(err);
          else resolve(html);
        });
      });
      res.send(html);
    } catch (error) {
      console.error("Error creating workout set:", error);
      res.status(500).send(`<div class="text-red-600 p-4">Failed to create workout set</div>`);
    }
  });

  app.put("/api/workout-sets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      const result = updateWorkoutSetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      const workoutSet = await storage.updateWorkoutSet(req.session!.userId!, id, result.data);
      if (!workoutSet) {
        return res.status(404).json({ message: "Workout set not found" });
      }
      res.json(workoutSet);
    } catch (error) {
      console.error("Error updating workout set:", error);
      res.status(500).json({ message: "Failed to update workout set" });
    }
  });

  app.delete("/api/workout-sets/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      await storage.deleteWorkoutSet(req.session!.userId!, id);
      res.status(200).send("");
    } catch (error) {
      console.error("Error deleting workout set:", error);
      res.status(500).send(`<div class="text-red-600 p-4">Failed to delete workout set</div>`);
    }
  });

  app.get("/api/goals", requireAuth, async (req, res) => {
    try {
      const goals = await storage.getAllGoals(req.session!.userId!);
      res.json(goals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      res.status(500).json({ message: "Failed to fetch goals" });
    }
  });

  app.post("/api/goals", requireAuth, async (req, res) => {
    try {
      const result = insertGoalSchema.safeParse({
        ...req.body,
        userId: req.session!.userId!,
      });
      if (!result.success) {
        return res.status(400).send(
          `<div class="text-red-600 p-4">${fromError(result.error).toString()}</div>`
        );
      }
      const goal = await storage.createGoal(result.data);
      const html = await new Promise<string>((resolve, reject) => {
        res.app.render("partials/goal-item", { goal }, (err, html) => {
          if (err) reject(err);
          else resolve(html);
        });
      });
      res.send(html);
    } catch (error) {
      console.error("Error creating goal:", error);
      res.status(500).send(`<div class="text-red-600 p-4">Failed to create goal</div>`);
    }
  });

  app.patch("/api/goals/:exercise", requireAuth, async (req, res) => {
    try {
      const result = updateGoalSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      const goal = await storage.updateGoal(req.session!.userId!, decodeURIComponent(req.params.exercise), result.data);
      if (!goal) {
        return res.status(404).json({ message: "Goal not found" });
      }
      res.json(goal);
    } catch (error) {
      console.error("Error updating goal:", error);
      res.status(500).json({ message: "Failed to update goal" });
    }
  });

  app.delete("/api/goals/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      await storage.deleteGoal(req.session!.userId!, id);
      res.status(200).send("");
    } catch (error) {
      console.error("Error deleting goal:", error);
      res.status(500).send(`<div class="text-red-600 p-4">Failed to delete goal</div>`);
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