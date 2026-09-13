import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { getSubscriptionStatus } from "../stripe";
import { verifyAccessToken } from "../jwt";

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

// Verifies the access token and attaches req.user + req.userId. Never redirects — always JSON.
export async function requireApiAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: "Missing or invalid Authorization header" });
  }
  let userId: string;
  try {
    userId = verifyAccessToken(token).sub;
  } catch {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  req.user = {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin || false,
    mustChangePassword: user.mustChangePassword || false,
  };
  req.userId = user.id;
  next();
}

export async function requireApiSubscription(req: Request, res: Response, next: NextFunction) {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUser(userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  if (getSubscriptionStatus(user) === "active") {
    return next();
  }
  return res.status(402).json({ message: "Subscription required", status: "inactive" });
}
