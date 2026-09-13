import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api } from "../api";
import type { BillingClient, PurchaseResult } from "./types";

// Android keeps Stripe as the payment rail (same one-time "lifetime access"
// checkout as the web app) rather than Google Play billing — Google Play's
// guidelines are more permissive here than Apple's about external payment
// links for this kind of purchase, so there's no compliance reason to give up
// the revenue to Play's cut. See billing.ios.ts for the iOS/App Store path.
export const billing: BillingClient = {
  async initialize() {
    // Nothing to configure up front for a browser-based checkout.
  },

  async subscribe(): Promise<PurchaseResult> {
    try {
      const redirectUrl = Linking.createURL("billing-return");
      const { url } = await api.billing.createCheckoutSession(redirectUrl);
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
      if (result.type === "success") {
        return { success: true };
      }
      // Any other result (cancel/dismiss) just means they closed the tab —
      // not an error worth showing.
      return { success: false };
    } catch (err) {
      console.warn("[billing] checkout failed:", err);
      return { success: false, message: "Something went wrong starting checkout. Please try again." };
    }
  },

  async restorePurchases(): Promise<PurchaseResult> {
    return { success: false, message: "Nothing to restore — your purchase is tied to your account, not this device." };
  },
};
