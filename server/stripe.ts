import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-11-20.acacia",
});

export const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID!;

export function getSubscriptionStatus(user: any): "active" | "expired" {
  if (user.isAdmin || user.subscriptionInterval === "lifetime") return "active";
  if (user.subscriptionStatus === "active" && user.currentPeriodEndsAt) {
    const now = new Date();
    return new Date(user.currentPeriodEndsAt) > now ? "active" : "expired";
  }
  return "expired";
}