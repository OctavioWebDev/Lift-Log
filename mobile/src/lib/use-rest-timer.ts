import { useEffect, useRef, useState } from "react";
import { cancelScheduledNotification, scheduleLocalNotification } from "./notifications";

// Countdown state is just for the in-app display — the thing that actually
// guarantees you find out rest is over, even if you've backgrounded the app to
// check something, is the scheduled OS notification.
export function useRestTimer() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const notificationId = useRef<string | null>(null);

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return;
    const timeout = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timeout);
  }, [secondsLeft]);

  async function start(durationSeconds: number) {
    if (notificationId.current) {
      await cancelScheduledNotification(notificationId.current);
    }
    notificationId.current = await scheduleLocalNotification(
      "Rest complete",
      "Time for your next set!",
      durationSeconds
    );
    setSecondsLeft(durationSeconds);
  }

  async function cancel() {
    if (notificationId.current) {
      await cancelScheduledNotification(notificationId.current);
      notificationId.current = null;
    }
    setSecondsLeft(null);
  }

  return { secondsLeft, start, cancel };
}
