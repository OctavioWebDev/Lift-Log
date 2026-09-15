import type { Express } from "express";
import express from "express";
import cors from "cors";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWorkoutSetSchema, updateWorkoutSetSchema, insertGoalSchema, updateGoalSchema, insertNutritionLogSchema, insertNutritionGoalSchema } from "@shared/schema";
import { fromError } from "zod-validation-error";
import { requireAuth, attachUser, hashPassword, verifyPassword, isValidEmail, isValidPassword, isValidUsername, generateTempPassword } from "./auth";
import { stripe, ANNUAL_PRICE_ID, getSubscriptionStatus } from "./stripe";
import { requireSubscription } from "./middleware/subscription";
import { ALL_EXERCISES, EXERCISES } from "@shared/exercises";
import { searchFoods } from "./food";
import { registerApiV1Routes } from "./routes/api-v1";
import { MEET_LIFTS, PREMADE_DURATIONS, groupEntriesByWeek, buildMeetPrepPlan } from "./meet-prep";
import { MEET_PREP_TEMPLATES } from "./meet-prep-templates";
import { avatarUpload, resizeAndSaveAvatar, deleteAvatarFile } from "./avatar-upload";
import { ALL_BADGES } from "@shared/badges";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ============================================================================
  // AUTHENTICATION MIDDLEWARE
  // ============================================================================
  app.use(attachUser);

  // Comped coaching-client accounts are created with a temp password and
  // must set their own before using the rest of the web app. Mobile/API
  // requests are left alone — this only gates full-page navigations.
  app.use((req, res, next) => {
    if (
      req.user?.mustChangePassword &&
      req.method === "GET" &&
      !req.path.startsWith("/account/change-password") &&
      !req.path.startsWith("/api") &&
      !req.path.startsWith("/logout")
    ) {
      return res.redirect("/account/change-password");
    }
    next();
  });

  // ============================================================================
  // MOBILE JSON API (JWT-authenticated, versioned)
  // ============================================================================
  // Open CORS here only — the mobile client authenticates with a Bearer token
  // (never cookies), so there's no CSRF-relevant credential to protect by
  // restricting origins. The cookie-authenticated web app routes below are
  // unaffected since same-origin requests never trigger CORS checks.
  app.use("/api/v1", cors());
  registerApiV1Routes(app);

  // ============================================================================
  // PUBLIC LANDING PAGE
  // ============================================================================
  app.get("/", async (req, res) => {
    if (req.session?.userId) {
      return res.redirect("/app");
    }
    res.render("landing", {
      title: "Chi-Rho Lifts - Track Your Progress, Build Real Strength"
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
      if (user.mustChangePassword) {
        return res.redirect("/account/change-password");
      }
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

  app.get("/account/change-password", requireAuth, async (req, res) => {
    const user = await storage.getUser(req.session!.userId!);
    if (!user) return res.redirect("/login");
    res.render("change-password", {
      title: "Change Password - Chi-Rho Lifts",
      user: req.user,
      forced: user.mustChangePassword,
      error: null,
    });
  });

  app.post("/account/change-password", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId!);
      if (!user) return res.redirect("/login");

      const { currentPassword, newPassword, confirmPassword } = req.body;
      const renderError = (error: string) => res.render("change-password", {
        title: "Change Password - Chi-Rho Lifts",
        user: req.user,
        forced: user.mustChangePassword,
        error,
      });

      if (!currentPassword || !newPassword || !confirmPassword) {
        return renderError("All fields are required");
      }
      const isValid = await verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return renderError("Current password is incorrect");
      }
      const passwordValidation = isValidPassword(newPassword);
      if (!passwordValidation.valid) {
        return renderError(passwordValidation.message!);
      }
      if (newPassword !== confirmPassword) {
        return renderError("New passwords do not match");
      }

      const passwordHash = await hashPassword(newPassword);
      await storage.updateUser(user.id, { passwordHash, mustChangePassword: false });
      res.redirect("/app");
    } catch (error) {
      console.error("Change password error:", error);
      res.render("change-password", {
        title: "Change Password - Chi-Rho Lifts",
        user: req.user,
        forced: false,
        error: "An error occurred. Please try again.",
      });
    }
  });

  app.get("/profile", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session!.userId!);
      if (!user) return res.redirect("/login");
      res.render("profile", {
        title: "Profile - Chi-Rho Lifts",
        user: req.user,
        profileUser: user,
        accountError: null,
        accountSuccess: false,
        lifterError: null,
        lifterSuccess: false,
      });
    } catch (error) {
      console.error("Error rendering profile:", error);
      res.status(500).send("Error loading page");
    }
  });

  app.post("/profile/account", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.redirect("/login");

      const renderError = (accountError: string) => res.render("profile", {
        title: "Profile - Chi-Rho Lifts",
        user: req.user,
        profileUser: currentUser,
        accountError,
        accountSuccess: false,
        lifterError: null,
        lifterSuccess: false,
      });

      const { username, email } = req.body;
      if (!username) return renderError("Username is required");
      const usernameValidation = isValidUsername(username);
      if (!usernameValidation.valid) return renderError(usernameValidation.message!);
      if (email && !isValidEmail(email)) return renderError("Invalid email address");

      if (username !== currentUser.username) {
        const existing = await storage.getUserByUsername(username);
        if (existing) return renderError("Username already taken");
      }
      if (email) {
        const allUsers = await storage.getAllUsers();
        if (allUsers.some((u) => u.email === email && u.id !== userId)) {
          return renderError("Email already registered");
        }
      }

      const updatedUser = await storage.updateUser(userId, { username, email: email || null });
      res.render("profile", {
        title: "Profile - Chi-Rho Lifts",
        // Reflect the new username in the header immediately, without
        // waiting for attachUser to re-fetch it on the next request.
        user: { ...req.user!, username: updatedUser?.username || username },
        profileUser: updatedUser || currentUser,
        accountError: null,
        accountSuccess: true,
        lifterError: null,
        lifterSuccess: false,
      });
    } catch (error) {
      console.error("Error updating account info:", error);
      res.status(500).send("Error updating profile");
    }
  });

  app.post("/profile/lifter-info", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.redirect("/login");

      const renderError = (lifterError: string) => res.render("profile", {
        title: "Profile - Chi-Rho Lifts",
        user: req.user,
        profileUser: currentUser,
        accountError: null,
        accountSuccess: false,
        lifterError,
        lifterSuccess: false,
      });

      const { fullName, dateOfBirth, sex, bodyweight, heightInches } = req.body;

      if (dateOfBirth && (isNaN(new Date(dateOfBirth).getTime()) || new Date(dateOfBirth) > new Date())) {
        return renderError("Enter a valid date of birth");
      }
      if (sex && !["male", "female", "prefer_not_to_say"].includes(sex)) {
        return renderError("Invalid selection");
      }
      let parsedBodyweight: number | null = null;
      if (bodyweight) {
        parsedBodyweight = parseFloat(bodyweight);
        if (isNaN(parsedBodyweight) || parsedBodyweight <= 0) return renderError("Enter a valid bodyweight");
      }
      let parsedHeight: number | null = null;
      if (heightInches) {
        parsedHeight = parseFloat(heightInches);
        if (isNaN(parsedHeight) || parsedHeight <= 0) return renderError("Enter a valid height");
      }

      const updatedUser = await storage.updateUser(userId, {
        fullName: (typeof fullName === "string" && fullName.trim()) || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        sex: sex || null,
        bodyweight: parsedBodyweight,
        heightInches: parsedHeight,
      });

      res.render("profile", {
        title: "Profile - Chi-Rho Lifts",
        user: req.user,
        profileUser: updatedUser || currentUser,
        accountError: null,
        accountSuccess: false,
        lifterError: null,
        lifterSuccess: true,
      });
    } catch (error) {
      console.error("Error updating lifter info:", error);
      res.status(500).send("Error updating profile");
    }
  });

  // Wrapped manually (rather than passed as normal middleware) so a
  // rejected file type or oversized upload re-renders the profile page
  // with a friendly message instead of hitting Express's default error
  // handler.
  app.post("/profile/avatar", requireAuth, (req, res) => {
    avatarUpload.single("avatar")(req, res, async (err: any) => {
      try {
        const userId = req.session!.userId!;
        const currentUser = await storage.getUser(userId);
        if (!currentUser) return res.redirect("/login");

        const renderResult = (avatarError: string | null, avatarSuccess: boolean, profileUser = currentUser, user = req.user) =>
          res.render("profile", {
            title: "Profile - Chi-Rho Lifts",
            user,
            profileUser,
            accountError: null,
            accountSuccess: false,
            lifterError: null,
            lifterSuccess: false,
            avatarError,
            avatarSuccess,
          });

        if (err) {
          const message = err.code === "LIMIT_FILE_SIZE"
            ? "That image is too large. Please use a photo under 15MB."
            : err.message || "Failed to upload image";
          return renderResult(message, false);
        }
        if (!req.file) {
          return renderResult("Choose an image to upload", false);
        }

        let newAvatarUrl: string;
        try {
          newAvatarUrl = await resizeAndSaveAvatar(userId, req.file.buffer);
        } catch (resizeError) {
          console.error("Error resizing avatar:", resizeError);
          return renderResult("Could not read that image. Try a different photo.", false);
        }

        deleteAvatarFile(currentUser.avatarUrl);
        const updatedUser = await storage.updateUser(userId, { avatarUrl: newAvatarUrl });

        renderResult(null, true, updatedUser || currentUser, { ...req.user!, avatarUrl: newAvatarUrl });
      } catch (error) {
        console.error("Error uploading avatar:", error);
        res.status(500).send("Error updating profile");
      }
    });
  });

  app.post("/profile/avatar/remove", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.redirect("/login");

      deleteAvatarFile(currentUser.avatarUrl);
      const updatedUser = await storage.updateUser(userId, { avatarUrl: null });

      res.render("profile", {
        title: "Profile - Chi-Rho Lifts",
        user: { ...req.user!, avatarUrl: null },
        profileUser: updatedUser || currentUser,
        accountError: null,
        accountSuccess: false,
        lifterError: null,
        lifterSuccess: false,
        avatarError: null,
        avatarSuccess: false,
      });
    } catch (error) {
      console.error("Error removing avatar:", error);
      res.status(500).send("Error updating profile");
    }
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
        title: "Workout Log - Chi-Rho Lifts",
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
      const now = new Date();
      const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      // Excludes not-yet-due meet-prep plan prescriptions — "recent" and
      // weekly stats should only reflect work actually done. Sets logged
      // directly (no meetPrepId) always count immediately as normal.
      const allWorkouts = (await storage.getAllWorkoutSets(req.session!.userId!))
        .filter(w => !w.meetPrepId || new Date(w.date) < startOfToday);
      const goals = await storage.getAllGoals(req.session!.userId!);
      // Also catches up any badges earned from history predating this
      // feature — see the fuller comment on GET /badges.
      await storage.checkAndAwardBadges(req.session!.userId!);
      const earnedBadges = await storage.getUserBadges(req.session!.userId!);

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
        activeGoals: goals.length,
        badgeCount: earnedBadges.length,
        totalBadgeCount: ALL_BADGES.length,
      };
      const recentWorkouts = allWorkouts.slice(0, 10);
      const heatmapDays = 84; // 12 weeks
      const workoutDates = await storage.getWorkoutDatesInRange(req.session!.userId!, heatmapDays);
      res.render("dashboard", {
        title: "Dashboard - Chi-Rho Lifts",
        stats,
        recentWorkouts,
        goals,
        user: req.user,
        workoutDates,
        heatmapDays,
      });
    } catch (error) {
      console.error("Error rendering dashboard:", error);
      res.status(500).send("Error loading dashboard");
    }
  });

  app.get("/progress", requireSubscription, async (req, res) => {
    try {
      const exercises = await storage.getExerciseNames(req.session!.userId!);
      const defaultExercise = await storage.getStrongestExercise(req.session!.userId!);
      res.render("progress", {
        title: "Progress - Chi-Rho Lifts",
        user: req.user,
        exercises,
        defaultExercise,
      });
    } catch (error) {
      console.error("Error rendering progress:", error);
      res.status(500).send("Error loading page");
    }
  });

  app.get("/api/stats/exercise-history", requireAuth, async (req, res) => {
    try {
      const exercise = req.query.exercise as string;
      if (!exercise) {
        return res.status(400).json({ message: "exercise query param is required" });
      }
      const sets = await storage.getExerciseHistory(req.session!.userId!, exercise);
      // Epley formula for estimated 1RM: weight * (1 + reps / 30)
      const points = sets.map((s) => ({
        date: (s.date instanceof Date ? s.date : new Date(s.date)).toISOString().split("T")[0],
        weight: s.weight,
        reps: s.reps,
        estimatedOneRepMax: Math.round(s.weight * (1 + s.reps / 30)),
      }));
      res.json(points);
    } catch (error) {
      console.error("Error fetching exercise history:", error);
      res.status(500).json({ message: "Failed to fetch exercise history" });
    }
  });

  app.get("/goals", requireSubscription, async (req, res) => {
    try {
      const goals = await storage.getAllGoals(req.session!.userId!);
      res.render("goals", {
        title: "Goals - Chi-Rho Lifts",
        goals,
        user: req.user,
        exercises: ALL_EXERCISES,
        exerciseGroups: EXERCISES,
      });
    } catch (error) {
      console.error("Error rendering goals page:", error);
      res.status(500).send("Error loading page");
    }
  });

  app.get("/badges", requireSubscription, async (req, res) => {
    try {
      const { badges, earnedCount, totalCount } = await storage.getBadgesView(req.session!.userId!);
      res.render("badges", {
        title: "Badges - Chi-Rho Lifts",
        user: req.user,
        badges,
        earnedCount,
        totalCount,
      });
    } catch (error) {
      console.error("Error rendering badges page:", error);
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
        title: "Admin Panel - Chi-Rho Lifts",
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

  app.get("/admin/users/:id", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId!);
      if (!currentUser?.isAdmin) {
        return res.status(403).send("Access denied. Admin privileges required.");
      }
      const targetUser = await storage.getUser(req.params.id);
      if (!targetUser) {
        return res.status(404).send("User not found");
      }

      const allWorkouts = await storage.getAllWorkoutSets(targetUser.id);
      const goals = await storage.getAllGoals(targetUser.id);
      const bestLifts = await storage.getBestLiftsByExercise(targetUser.id);

      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const workoutsThisWeek = allWorkouts.filter((w) => {
        const d = new Date(w.date);
        return d >= startOfWeek && d <= now;
      });
      const totalVolume = allWorkouts.reduce((sum, w) => sum + w.sets * w.weight * w.reps, 0);

      const stats = {
        totalWorkouts: allWorkouts.length,
        workoutsThisWeek: workoutsThisWeek.length,
        totalVolume,
        activeGoals: goals.length,
      };

      res.render("admin-user-detail", {
        title: `${targetUser.username} - Admin - Chi-Rho Lifts`,
        user: req.user,
        targetUser,
        subscriptionStatus: getSubscriptionStatus(targetUser),
        stats,
        goals,
        bestLifts,
        recentWorkouts: allWorkouts.slice(0, 20),
      });
    } catch (error) {
      console.error("Error rendering admin user detail:", error);
      res.status(500).send("Error loading user detail");
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

  // Create a free (comped) coaching-client account with a temp password.
  // The temp password is returned once in the response — it is never stored
  // in plaintext and isn't retrievable afterward.
  app.post("/admin/clients", requireAuth, async (req, res) => {
    try {
      const currentUser = await storage.getUser(req.session!.userId!);
      if (!currentUser?.isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { username, email } = req.body;
      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }
      const usernameValidation = isValidUsername(username);
      if (!usernameValidation.valid) {
        return res.status(400).json({ message: usernameValidation.message });
      }
      if (email && !isValidEmail(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already taken" });
      }

      const tempPassword = generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);
      const user = await storage.createClientAccount({
        username,
        email: email || null,
        passwordHash,
      });

      // Credentials go in the URL fragment, not the query string — the
      // fragment is never sent to the server (no access logs, no Referer
      // header), only read client-side by login.ejs's autofill script.
      const loginLink = `${req.protocol}://${req.get("host")}/login#u=${encodeURIComponent(user.username)}&p=${encodeURIComponent(tempPassword)}`;

      res.json({ username: user.username, tempPassword, loginLink });
    } catch (error) {
      console.error("Error creating client account:", error);
      res.status(500).json({ message: "Failed to create client account" });
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
      title: "Billing - Chi-Rho Lifts",
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
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: ANNUAL_PRICE_ID, quantity: 1 }],
        success_url: `${req.protocol}://${req.get("host")}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get("host")}/billing`,
        customer_email: user.email ?? undefined,
        metadata: { userId: String(user.id) },
      });
      res.redirect(session.url!);
    } catch (error) {
      console.error("Checkout error:", error);
      res.redirect("/billing?error=true");
    }
  });

  app.get("/billing/success", requireAuth, async (req, res) => {
    res.render("billing-success", {
      title: "Subscription Active - Chi-Rho Lifts",
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
        title: "Subscription Cancelled - Chi-Rho Lifts",
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
          // One-time lifetime purchase — no subscription, no expiry
          await storage.updateUserSubscription(userId, {
            subscriptionStatus: "active",
            subscriptionInterval: "lifetime",
            stripeCustomerId: session.customer,
            stripeSubscriptionId: null,
            currentPeriodEndsAt: null,
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
      await storage.syncGoalCurrentFromHistory(req.session!.userId!, workoutSet.exercise);
      await storage.checkAndAwardBadges(req.session!.userId!);
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
      const previous = await storage.getWorkoutSet(req.session!.userId!, id);
      const workoutSet = await storage.updateWorkoutSet(req.session!.userId!, id, result.data);
      if (!workoutSet) {
        return res.status(404).json({ message: "Workout set not found" });
      }
      await storage.syncGoalCurrentFromHistory(req.session!.userId!, workoutSet.exercise);
      if (previous && previous.exercise !== workoutSet.exercise) {
        await storage.syncGoalCurrentFromHistory(req.session!.userId!, previous.exercise);
      }
      await storage.checkAndAwardBadges(req.session!.userId!);
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
      const existing = await storage.getWorkoutSet(req.session!.userId!, id);
      await storage.deleteWorkoutSet(req.session!.userId!, id);
      if (existing) {
        await storage.syncGoalCurrentFromHistory(req.session!.userId!, existing.exercise);
      }
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
      await storage.syncGoalCurrentFromHistory(req.session!.userId!, goal.exercise);
      const freshGoal = await storage.getGoalByExercise(req.session!.userId!, goal.exercise);
      const html = await new Promise<string>((resolve, reject) => {
        res.app.render("partials/goal-item", { goal: freshGoal || goal }, (err, html) => {
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

  // ============================================================================
  // MEET PREP ROUTES
  // ============================================================================

  app.get("/meet-prep", requireSubscription, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const allPlans = await storage.getMeetPreps(userId);
      const now = new Date();
      const activePlans = allPlans.filter((p) => new Date(p.endDate) >= now);
      const pastPlans = allPlans.filter((p) => new Date(p.endDate) < now);
      const activePlansWithEntries = await Promise.all(
        activePlans.map(async (plan) => {
          const entries = await storage.getWorkoutSetsForMeetPrep(userId, plan.id);
          const start = new Date(plan.startDate);
          const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const currentWeek = now < start ? 0 : Math.min(plan.weeks, Math.floor(daysSinceStart / 7) + 1);
          const weeksList = groupEntriesByWeek(entries, start, plan.weeks);
          return { plan, currentWeek, weeksList };
        })
      );
      res.render("meet-prep", {
        title: "Meet Prep - Chi-Rho Lifts",
        user: req.user,
        activePlansWithEntries,
        pastPlans,
        meetLifts: MEET_LIFTS,
        premadeDurations: PREMADE_DURATIONS,
        templates: MEET_PREP_TEMPLATES,
      });
    } catch (error) {
      console.error("Error rendering meet prep page:", error);
      res.status(500).send("Error loading page");
    }
  });

  app.post("/api/meet-prep", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const result = buildMeetPrepPlan(userId, req.body);
      if ("error" in result) {
        return res.status(400).json({ message: result.error });
      }

      const meetPrep = await storage.createMeetPrep(result.meetPrepInput);
      await storage.createWorkoutSetsBulk(
        result.entries.map((e) => ({
          userId,
          meetPrepId: meetPrep.id,
          exercise: e.exercise,
          sets: e.sets,
          reps: e.reps,
          weight: e.weight,
          rpe: e.rpe,
          date: e.date,
        }))
      );

      res.status(201).json({ meetPrep });
    } catch (error) {
      console.error("Error creating meet prep plan:", error);
      res.status(500).json({ message: "Failed to create meet prep plan" });
    }
  });

  app.delete("/api/meet-prep/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid ID" });
      }
      await storage.deleteMeetPrep(req.session!.userId!, id);
      res.status(200).send("");
    } catch (error) {
      console.error("Error deleting meet prep plan:", error);
      res.status(500).json({ message: "Failed to delete meet prep plan" });
    }
  });

  // ============================================================================
  // NUTRITION ROUTES
  // ============================================================================

  app.get("/nutrition", requireSubscription, async (req, res) => {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const logs = await storage.getNutritionLogsForDate(req.session!.userId!, date);
      const goal = await storage.getNutritionGoal(req.session!.userId!);
      const totals = logs.reduce(
        (acc, l) => ({
          calories: acc.calories + l.calories,
          protein: acc.protein + l.protein,
          carbs: acc.carbs + l.carbs,
          fat: acc.fat + l.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      res.render("nutrition", {
        title: "Nutrition - Chi-Rho Lifts",
        user: req.user,
        logs,
        goal: goal || { calories: 2000, protein: 150, carbs: 200, fat: 65 },
        totals,
        date,
      });
    } catch (error) {
      console.error("Error rendering nutrition:", error);
      res.status(500).send("Error loading page");
    }
  });

  app.get("/api/nutrition/history", requireAuth, async (req, res) => {
    try {
      const days = Math.min(Math.max(parseInt(req.query.days as string) || 30, 1), 90);
      const history = await storage.getNutritionHistory(req.session!.userId!, days);
      res.json(history);
    } catch (error) {
      console.error("Error fetching nutrition history:", error);
      res.status(500).json({ message: "Failed to fetch nutrition history" });
    }
  });

  // Food search proxy — USDA FoodData Central
  app.get("/api/food/search", requireAuth, async (req, res) => {
    try {
      const results = await searchFoods(req.query.q as string || "");
      res.json(results);
    } catch (error) {
      console.error("Food search error:", error);
      res.status(500).json([]);
    }
  });

  // Log a food entry
  app.post("/api/nutrition", requireAuth, async (req, res) => {
    try {
      const result = insertNutritionLogSchema.safeParse({
        ...req.body,
        userId: req.session!.userId!,
        date: new Date(req.body.date || new Date()),
      });
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      const log = await storage.createNutritionLog(result.data);
      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating nutrition log:", error);
      res.status(500).json({ message: "Failed to log food" });
    }
  });

  // Delete a food entry
  app.delete("/api/nutrition/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteNutritionLog(req.session!.userId!, id);
      res.status(200).send("");
    } catch (error) {
      console.error("Error deleting nutrition log:", error);
      res.status(500).json({ message: "Failed to delete entry" });
    }
  });

  // Save/update daily macro goals
  app.post("/api/nutrition/goals", requireAuth, async (req, res) => {
    try {
      const result = insertNutritionGoalSchema.safeParse({
        ...req.body,
        userId: req.session!.userId!,
      });
      if (!result.success) {
        return res.status(400).json({ message: fromError(result.error).toString() });
      }
      const goal = await storage.upsertNutritionGoal(result.data);
      res.json(goal);
    } catch (error) {
      console.error("Error saving nutrition goal:", error);
      res.status(500).json({ message: "Failed to save goals" });
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