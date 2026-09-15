import type { Express } from "express";
import { storage } from "../storage";
import {
  type User,
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
import { getSubscriptionStatus, stripe, ANNUAL_PRICE_ID } from "../stripe";
import { searchFoods } from "../food";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshTokenExpiryDate,
} from "../jwt";
import { avatarUpload, resizeAndSaveAvatar, deleteAvatarFile } from "../avatar-upload";
import { MEET_LIFTS, PREMADE_DURATIONS, buildMeetPrepPlan } from "../meet-prep";
import { MEET_PREP_TEMPLATES } from "../meet-prep-templates";

function publicUser(user: { id: string; username: string; email: string | null; isAdmin: boolean }) {
  return { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin };
}

function fullProfile(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
    avatarUrl: user.avatarUrl,
    fullName: user.fullName,
    dateOfBirth: user.dateOfBirth,
    sex: user.sex,
    bodyweight: user.bodyweight,
    heightInches: user.heightInches,
  };
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

  // Android billing: Stripe checkout opened in an in-app browser (same one-time
  // "lifetime access" product as the web app — no separate mobile price). iOS
  // uses native in-app purchase via RevenueCat instead (see the webhook below);
  // Apple's guidelines don't allow a card-checkout path like this one for
  // unlocking paid app functionality.
  app.post(`${base}/billing/checkout`, requireApiAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });
      const { redirectUrl } = req.body ?? {};
      if (!redirectUrl || typeof redirectUrl !== "string") {
        return res.status(400).json({ message: "redirectUrl is required" });
      }
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: ANNUAL_PRICE_ID, quantity: 1 }],
        success_url: redirectUrl,
        cancel_url: redirectUrl,
        customer_email: user.email ?? undefined,
        metadata: { userId: String(user.id) },
      });
      res.json({ url: session.url });
    } catch (error) {
      console.error("API checkout error:", error);
      res.status(500).json({ message: "Failed to start checkout" });
    }
  });

  // iOS billing: RevenueCat calls this after a purchase/renewal/expiration.
  // The mobile app configures Purchases with appUserID = our own user id (see
  // mobile/src/lib/billing/billing.ios.ts), so RevenueCat's app_user_id maps
  // directly to shared/schema.ts's users.id — no separate mapping table needed.
  //
  // Authenticated via a shared secret in the Authorization header, configured
  // to match in the RevenueCat dashboard (Project Settings > Webhooks) — this
  // is RevenueCat's documented verification method, not a signature scheme.
  app.post(`${base}/billing/revenuecat-webhook`, async (req, res) => {
    const secret = process.env.REVENUECAT_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "Webhook secret not configured" });
    }
    if (req.headers.authorization !== secret) {
      return res.status(401).json({ message: "Invalid webhook credentials" });
    }
    try {
      const event = req.body?.event;
      const userId = event?.app_user_id;
      if (!userId) return res.status(200).json({ received: true });

      // Grant/restore access on any event that means "this user owns the
      // product" — err toward granting rather than revoking for event types
      // we're not certain about, since wrongly revoking a paying customer's
      // access is a much worse failure than occasionally under-revoking.
      const GRANT_EVENTS = [
        "INITIAL_PURCHASE",
        "NON_RENEWING_PURCHASE",
        "RENEWAL",
        "UNCANCELLATION",
        "PRODUCT_CHANGE",
        "TRANSFER",
      ];
      const REVOKE_EVENTS = ["EXPIRATION"];

      if (GRANT_EVENTS.includes(event.type)) {
        await storage.updateUserSubscription(userId, {
          subscriptionStatus: "active",
          subscriptionInterval: "lifetime",
          currentPeriodEndsAt: null,
        });
      } else if (REVOKE_EVENTS.includes(event.type)) {
        // getSubscriptionStatus() treats subscriptionInterval === "lifetime" as
        // active regardless of subscriptionStatus, so revoking access means
        // clearing that too, not just flipping the status flag.
        await storage.updateUserSubscription(userId, {
          subscriptionStatus: "inactive",
          subscriptionInterval: null,
        });
      } else {
        console.log(`[revenuecat] unhandled event type: ${event.type}`);
      }
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("RevenueCat webhook error:", error);
      res.status(500).json({ message: "Webhook handler failed" });
    }
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
      await storage.syncGoalCurrentFromHistory(req.userId!, workoutSet.exercise);
      await storage.checkAndAwardBadges(req.userId!);
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
      const previous = await storage.getWorkoutSet(req.userId!, id);
      const workoutSet = await storage.updateWorkoutSet(req.userId!, id, result.data);
      if (!workoutSet) return res.status(404).json({ message: "Workout set not found" });
      await storage.syncGoalCurrentFromHistory(req.userId!, workoutSet.exercise);
      if (previous && previous.exercise !== workoutSet.exercise) {
        await storage.syncGoalCurrentFromHistory(req.userId!, previous.exercise);
      }
      await storage.checkAndAwardBadges(req.userId!);
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
      const existing = await storage.getWorkoutSet(req.userId!, id);
      await storage.deleteWorkoutSet(req.userId!, id);
      if (existing) {
        await storage.syncGoalCurrentFromHistory(req.userId!, existing.exercise);
      }
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
      await storage.syncGoalCurrentFromHistory(req.userId!, goal.exercise);
      const freshGoal = await storage.getGoalByExercise(req.userId!, goal.exercise);
      res.status(201).json(freshGoal || goal);
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

  // ==========================================================================
  // PROFILE
  // ==========================================================================
  app.get(`${base}/profile`, requireApiAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) return res.status(401).json({ message: "User not found" });
      res.json({ user: fullProfile(user) });
    } catch (error) {
      console.error("API error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Accepts any subset of account fields (username, email) and lifter
  // profile fields (fullName, dateOfBirth, sex, bodyweight, heightInches) —
  // the web app splits these across two forms for UX reasons, but a single
  // partial-update endpoint is simpler for a JSON API. Validation mirrors
  // POST /profile/account and /profile/lifter-info.
  app.patch(`${base}/profile`, requireApiAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.status(401).json({ message: "User not found" });

      const { username, email, fullName, dateOfBirth, sex, bodyweight, heightInches } = req.body ?? {};
      const updates: Partial<{
        username: string;
        email: string | null;
        fullName: string | null;
        dateOfBirth: Date | null;
        sex: string | null;
        bodyweight: number | null;
        heightInches: number | null;
      }> = {};

      if (username !== undefined) {
        if (!username) return res.status(400).json({ message: "Username is required" });
        const usernameValidation = isValidUsername(username);
        if (!usernameValidation.valid) return res.status(400).json({ message: usernameValidation.message });
        if (username !== currentUser.username) {
          const existing = await storage.getUserByUsername(username);
          if (existing) return res.status(400).json({ message: "Username already taken" });
        }
        updates.username = username;
      }
      if (email !== undefined) {
        if (email && !isValidEmail(email)) return res.status(400).json({ message: "Invalid email address" });
        if (email) {
          const allUsers = await storage.getAllUsers();
          if (allUsers.some((u) => u.email === email && u.id !== userId)) {
            return res.status(400).json({ message: "Email already registered" });
          }
        }
        updates.email = email || null;
      }
      if (fullName !== undefined) {
        updates.fullName = (typeof fullName === "string" && fullName.trim()) || null;
      }
      if (dateOfBirth !== undefined) {
        if (dateOfBirth && (isNaN(new Date(dateOfBirth).getTime()) || new Date(dateOfBirth) > new Date())) {
          return res.status(400).json({ message: "Enter a valid date of birth" });
        }
        updates.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
      }
      if (sex !== undefined) {
        if (sex && !["male", "female", "prefer_not_to_say"].includes(sex)) {
          return res.status(400).json({ message: "Invalid selection" });
        }
        updates.sex = sex || null;
      }
      if (bodyweight !== undefined) {
        if (bodyweight === null || bodyweight === "") {
          updates.bodyweight = null;
        } else {
          const parsed = parseFloat(bodyweight);
          if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ message: "Enter a valid bodyweight" });
          updates.bodyweight = parsed;
        }
      }
      if (heightInches !== undefined) {
        if (heightInches === null || heightInches === "") {
          updates.heightInches = null;
        } else {
          const parsed = parseFloat(heightInches);
          if (isNaN(parsed) || parsed <= 0) return res.status(400).json({ message: "Enter a valid height" });
          updates.heightInches = parsed;
        }
      }

      const updatedUser = await storage.updateUser(userId, updates);
      res.json({ user: fullProfile(updatedUser || currentUser) });
    } catch (error) {
      console.error("API error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Wrapped manually (rather than passed as normal middleware) so a
  // rejected file type or oversized upload comes back as a normal JSON
  // error instead of hitting Express's default error handler — same
  // reasoning as the web app's POST /profile/avatar.
  app.post(`${base}/profile/avatar`, requireApiAuth, (req, res) => {
    avatarUpload.single("avatar")(req, res, async (err: any) => {
      try {
        const userId = req.userId!;
        const currentUser = await storage.getUser(userId);
        if (!currentUser) return res.status(401).json({ message: "User not found" });

        if (err) {
          const message = err.code === "LIMIT_FILE_SIZE"
            ? "That image is too large. Please use a photo under 15MB."
            : err.message || "Failed to upload image";
          return res.status(400).json({ message });
        }
        if (!req.file) {
          return res.status(400).json({ message: "Choose an image to upload" });
        }

        let newAvatarUrl: string;
        try {
          newAvatarUrl = await resizeAndSaveAvatar(userId, req.file.buffer);
        } catch (resizeError) {
          console.error("API error resizing avatar:", resizeError);
          return res.status(400).json({ message: "Could not read that image. Try a different photo." });
        }

        deleteAvatarFile(currentUser.avatarUrl);
        const updatedUser = await storage.updateUser(userId, { avatarUrl: newAvatarUrl });
        res.json({ user: fullProfile(updatedUser || currentUser) });
      } catch (error) {
        console.error("API error uploading avatar:", error);
        res.status(500).json({ message: "Failed to update profile" });
      }
    });
  });

  app.delete(`${base}/profile/avatar`, requireApiAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const currentUser = await storage.getUser(userId);
      if (!currentUser) return res.status(401).json({ message: "User not found" });

      deleteAvatarFile(currentUser.avatarUrl);
      const updatedUser = await storage.updateUser(userId, { avatarUrl: null });
      res.json({ user: fullProfile(updatedUser || currentUser) });
    } catch (error) {
      console.error("API error removing avatar:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // ==========================================================================
  // MEET PREP
  // ==========================================================================
  // Static config the mobile client needs to build the same create-plan form
  // the web app has, without hardcoding/duplicating these lists itself.
  app.get(`${base}/meet-prep/config`, requireApiAuth, async (_req, res) => {
    res.json({
      meetLifts: MEET_LIFTS,
      premadeDurations: PREMADE_DURATIONS,
      templates: MEET_PREP_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        weeks: t.weeks,
        daysPerWeek: t.daysPerWeek,
        requiresOhp: t.requiresOhp ?? false,
        inputKind: t.inputKind,
      })),
    });
  });

  app.get(`${base}/meet-preps`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      res.json({ plans: await storage.getMeetPreps(req.userId!) });
    } catch (error) {
      console.error("API error fetching meet preps:", error);
      res.status(500).json({ message: "Failed to fetch meet preps" });
    }
  });

  app.get(`${base}/meet-preps/:id`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      const plan = await storage.getMeetPrep(req.userId!, id);
      if (!plan) return res.status(404).json({ message: "Meet prep plan not found" });
      const entries = await storage.getWorkoutSetsForMeetPrep(req.userId!, id);
      res.json({ plan, entries });
    } catch (error) {
      console.error("API error fetching meet prep plan:", error);
      res.status(500).json({ message: "Failed to fetch meet prep plan" });
    }
  });

  app.post(`${base}/meet-preps`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const userId = req.userId!;
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
      console.error("API error creating meet prep plan:", error);
      res.status(500).json({ message: "Failed to create meet prep plan" });
    }
  });

  app.delete(`${base}/meet-preps/:id`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid ID" });
      await storage.deleteMeetPrep(req.userId!, id);
      res.status(204).send();
    } catch (error) {
      console.error("API error deleting meet prep plan:", error);
      res.status(500).json({ message: "Failed to delete meet prep plan" });
    }
  });

  // ==========================================================================
  // BADGES
  // ==========================================================================
  app.get(`${base}/badges`, requireApiAuth, requireApiSubscription, async (req, res) => {
    try {
      res.json(await storage.getBadgesView(req.userId!));
    } catch (error) {
      console.error("API error fetching badges:", error);
      res.status(500).json({ message: "Failed to fetch badges" });
    }
  });
}
