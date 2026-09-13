import type { BillingClient, PurchaseResult } from "./types";

// Fallback for web and any platform without a dedicated implementation above.
// Metro resolves billing.ios.ts / billing.android.ts on those platforms via
// the file extension, so react-native-purchases (native-only) never gets
// bundled into a web build.
export const billing: BillingClient = {
  async initialize() {
    // no-op
  },
  async subscribe(): Promise<PurchaseResult> {
    return { success: false, message: "Subscribing isn't available on this platform yet." };
  },
  async restorePurchases(): Promise<PurchaseResult> {
    return { success: false, message: "Not available on this platform." };
  },
};
