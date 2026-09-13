// Thin wrapper around Expo's push notification service — the same push
// infrastructure the mobile app's local notifications don't need, but a
// server-triggered one (like a streak reminder) does. See
// https://docs.expo.dev/push-notifications/sending-notifications/
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // Expo's documented limit per request

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendExpoPushNotifications(messages: PushMessage[]): Promise<void> {
  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const batch = messages.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      if (!res.ok) {
        console.error(`[push] Expo push API returned ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      console.error("[push] failed to reach Expo push API:", err);
    }
  }
}
