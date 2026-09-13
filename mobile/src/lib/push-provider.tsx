import { useEffect } from "react";
import { Platform } from "react-native";
import { useSession } from "./auth-context";
import { api } from "./api";
import { ensureAndroidChannel, registerForPushNotificationsAsync } from "./notifications";

// Registers this device's Expo push token with the server once a user is
// signed in. A no-op until the app has an EAS project configured (see
// notifications.ts) — until then registerForPushNotificationsAsync just
// returns null and this quietly does nothing, so it's safe to mount always.
export function PushNotificationsRegistrar() {
  const { user } = useSession();

  useEffect(() => {
    if (!user) return;
    (async () => {
      await ensureAndroidChannel();
      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      try {
        await api.pushTokens.register(token, Platform.OS);
      } catch (err) {
        console.warn("[notifications] failed to register push token with server:", err);
      }
    })();
  }, [user?.id]);

  return null;
}
