import { createContext, use, useEffect, useState, type PropsWithChildren } from "react";
import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSession } from "../auth-context";
import { getPendingOpCount, onSyncSettled, runSync } from "./sync-runner";

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
}

const SyncContext = createContext<SyncStatus>({ isOnline: true, pendingCount: 0 });

export function useSyncStatus() {
  return use(SyncContext);
}

const SYNC_INTERVAL_MS = 60_000;

// Triggers a sync pass whenever it's plausible one would succeed or matter — on
// network reconnect, on app foreground, right after login, and on a fallback
// interval — and tracks outbox size so the UI can show "N pending" / "Offline".
export function SyncProvider({ children }: PropsWithChildren) {
  const { user } = useSession();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  async function refreshPendingCount() {
    setPendingCount(await getPendingOpCount());
  }

  useEffect(() => onSyncSettled(refreshPendingCount), []);

  useEffect(() => {
    if (!user) return;

    runSync(user.id);
    refreshPendingCount();

    const unsubscribeNet = NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online) runSync(user.id);
    });

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") runSync(user.id);
    });

    const interval = setInterval(() => runSync(user.id), SYNC_INTERVAL_MS);

    // Browsers' online/offline events (which NetInfo's web backend is built on)
    // are notoriously unreliable about firing on reconnect — listen directly too
    // as a cheap belt-and-suspenders fallback. No-op on native, where NetInfo's
    // own listener above is the reliable native implementation.
    let removeWebOnlineListener: (() => void) | undefined;
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const handler = () => {
        setIsOnline(true);
        runSync(user.id);
      };
      window.addEventListener("online", handler);
      removeWebOnlineListener = () => window.removeEventListener("online", handler);
    }

    return () => {
      unsubscribeNet();
      appStateSub.remove();
      clearInterval(interval);
      removeWebOnlineListener?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return <SyncContext.Provider value={{ isOnline, pendingCount }}>{children}</SyncContext.Provider>;
}
