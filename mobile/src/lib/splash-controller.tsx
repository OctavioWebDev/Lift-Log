import { useEffect } from "react";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "./auth-context";

SplashScreen.preventAutoHideAsync();

// Keeps the splash screen up until we know whether a stored session is valid,
// so the app never flashes the sign-in screen before redirecting to the tabs.
export function SplashScreenController() {
  const { isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return null;
}
