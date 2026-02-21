import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { getSubscriptionStatus } from "../stripe";

export async function requireSubscription(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.redirect("/login");
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.redirect("/login");
  }

  const status = getSubscriptionStatus(user);

  if (status === "active" || status === "trial") {
    return next();
  }

  // Expired - redirect to billing page
  return res.redirect("/billing?expired=true");
}

export async function checkTrial(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) return next();

  const user = await storage.getUser(req.session.userId);
  if (!user) return next();

  // If new user with no trial set, start their 30-day trial
  if (!user.trialEndsAt && user.subscriptionStatus === "trial") {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 30);
    await storage.updateUserSubscription(user.id, {
      trialEndsAt,
      subscriptionStatus: "trial",
    });
  }

  next();
}