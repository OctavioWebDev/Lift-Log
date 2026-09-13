import { storage } from "./storage";
import { sendExpoPushNotifications } from "./push";

function todayUTCDateString(): string {
  return new Date().toISOString().split("T")[0];
}

// Nudges anyone with a registered device who hasn't logged a single set today.
// Runs once daily (see server/index.ts) — a no-op cost-wise when there are no
// push tokens registered yet, which is the common case until EAS/push is set up.
export async function runStreakReminderJob(): Promise<void> {
  const tokens = await storage.getAllPushTokens();
  if (tokens.length === 0) return;

  const allWorkouts = await storage.getAllWorkoutSetsAdmin();
  const today = todayUTCDateString();
  const usersWithWorkoutToday = new Set(
    allWorkouts.filter((w) => new Date(w.date).toISOString().startsWith(today)).map((w) => w.userId)
  );

  const messages = tokens
    .filter((t) => !usersWithWorkoutToday.has(t.userId))
    .map((t) => ({
      to: t.token,
      title: "Don't break your streak",
      body: "You haven't logged a workout today — even one set keeps it going.",
    }));

  if (messages.length === 0) return;
  console.log(`[streak-reminder] sending ${messages.length} reminder(s)`);
  await sendExpoPushNotifications(messages);
}
