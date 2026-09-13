import Purchases, { PURCHASES_ERROR_CODE } from "react-native-purchases";
import type { BillingClient, PurchaseResult } from "./types";

// Public RevenueCat API key — safe to embed client-side (this is how
// RevenueCat's SDK is designed to be configured). Requires a RevenueCat
// project connected to App Store Connect with a "lifetime" (non-consumable)
// package configured — matches the web app's one-time "lifetime access"
// purchase rather than a recurring subscription.
const API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

let configuredForUserId: string | null = null;

function isCancelled(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as any).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

export const billing: BillingClient = {
  async initialize(userId: string) {
    if (!API_KEY || configuredForUserId === userId) return;
    Purchases.configure({ apiKey: API_KEY, appUserID: userId });
    configuredForUserId = userId;
  },

  async subscribe(): Promise<PurchaseResult> {
    if (!API_KEY) {
      return { success: false, message: "In-app purchases aren't configured yet." };
    }
    try {
      const offerings = await Purchases.getOfferings();
      const pkg = offerings.current?.lifetime ?? offerings.current?.availablePackages[0];
      if (!pkg) {
        return { success: false, message: "No purchase options are available right now." };
      }
      await Purchases.purchasePackage(pkg);
      return { success: true };
    } catch (err) {
      if (isCancelled(err)) return { success: false };
      console.warn("[billing] purchase failed:", err);
      return { success: false, message: "Something went wrong with the purchase. Please try again." };
    }
  },

  async restorePurchases(): Promise<PurchaseResult> {
    if (!API_KEY) {
      return { success: false, message: "In-app purchases aren't configured yet." };
    }
    try {
      await Purchases.restorePurchases();
      return { success: true };
    } catch (err) {
      console.warn("[billing] restore failed:", err);
      return { success: false, message: "Couldn't restore purchases. Please try again." };
    }
  },
};
