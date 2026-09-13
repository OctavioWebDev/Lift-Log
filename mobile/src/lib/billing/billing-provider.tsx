import { useEffect } from "react";
import { useSession } from "../auth-context";
import { billing } from "./index";

// Configures the platform billing client once a user is known — on iOS this
// is when RevenueCat's Purchases SDK gets configured with our user id as its
// appUserID, which is what lets the RevenueCat webhook (server side) map a
// purchase back to the right account.
export function BillingInitializer() {
  const { user } = useSession();

  useEffect(() => {
    if (!user) return;
    billing.initialize(user.id).catch((err) => console.warn("[billing] initialize failed:", err));
  }, [user?.id]);

  return null;
}
