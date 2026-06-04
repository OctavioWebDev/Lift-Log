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

  if (getSubscriptionStatus(user) === "active") {
    return next();
  }

  return res.redirect("/billing");
}
