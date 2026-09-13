import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

// Show alerts even while the app is in the foreground — a rest timer or PR
// notification firing while you're mid-workout looking at the screen should
// still show up, not silently wait for you to background the app.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

// Registers this device for remote push and returns an Expo push token, or null
// if that's not possible right now (simulator, permission denied, or — very
// likely during development — no EAS project configured yet in app.json's
// extra.eas.projectId). Local notifications (rest timer, PR alerts) work fine
// without this; only server-triggered pushes (streak reminders) need it.
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("[notifications] push tokens require a physical device");
    return null;
  }
  const granted = await requestNotificationPermissions();
  if (!granted) return null;
  await ensureAndroidChannel();

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn("[notifications] no EAS projectId configured yet — skipping push token registration");
    return null;
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn("[notifications] failed to get push token:", err);
    return null;
  }
}

// Never throws — local notifications aren't available on every platform (e.g.
// web, where this is only ever exercised in dev/testing since it's not a
// shipping target), and a rest-timer or PR alert failing to schedule shouldn't
// break the screen that triggered it. Returns null if scheduling failed.
export async function scheduleLocalNotification(
  title: string,
  body: string,
  secondsFromNow = 0
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger:
        secondsFromNow > 0
          ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: secondsFromNow }
          : null,
    });
  } catch (err) {
    console.warn("[notifications] failed to schedule local notification:", err);
    return null;
  }
}

export async function cancelScheduledNotification(id: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(id);
}
