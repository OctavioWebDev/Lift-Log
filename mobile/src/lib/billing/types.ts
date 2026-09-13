export interface PurchaseResult {
  success: boolean;
  // Only set for a real failure worth showing the user — a plain cancel
  // (closing the purchase sheet / browser tab) resolves success:false with no
  // message, since that's not an error.
  message?: string;
}

export interface BillingClient {
  // Call once a user is known (see billing-provider.tsx) — sets up whatever
  // the platform's store needs before a purchase can be attempted.
  initialize(userId: string): Promise<void>;
  subscribe(): Promise<PurchaseResult>;
  restorePurchases(): Promise<PurchaseResult>;
}
