import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-12-15.acacia",
});

export const MONTHLY_PRICE_ID = process.env.STRIPE_MONTHLY_PRICE_ID!;
export const ANNUAL_PRICE_ID = process.env.STRIPE_ANNUAL_PRICE_ID!;

export function getSubscriptionStatus(user: any): "active" | "trial" | "expired" {
  if (user.isAdmin || user.subscriptionInterval === "lifetime") return "active";
  if (user.subscriptionStatus === "active" && user.currentPeriodEndsAt) {
    const now = new Date();
    return new Date(user.currentPeriodEndsAt) > now ? "active" : "expired";
  }
  if (user.subscriptionStatus === "trial" && user.trialEndsAt) {
    const now = new Date();
    return new Date(user.trialEndsAt) > now ? "trial" : "expired";
  }
  return "expired";
}