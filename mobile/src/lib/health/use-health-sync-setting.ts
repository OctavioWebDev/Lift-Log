import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { useStorageState } from "../storage";
import { healthSync } from "./index";

const STORAGE_KEY = "healthSyncEnabled";

export function healthPlatformLabel(): string {
  if (Platform.OS === "ios") return "Apple Health";
  if (Platform.OS === "android") return "Health Connect";
  return "Health";
}

// Persists the user's opt-in choice (SecureStore on native, localStorage on
// web) and handles the permission-request dance when turning it on.
export function useHealthSyncSetting() {
  const [[isLoading, stored], setStored] = useStorageState(STORAGE_KEY);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    healthSync.isAvailable().then((available) => setUnavailable(!available));
  }, []);

  const enabled = stored === "true" && !unavailable;

  async function setEnabled(next: boolean): Promise<boolean> {
    if (next) {
      const available = await healthSync.isAvailable();
      if (!available) {
        setUnavailable(true);
        return false;
      }
      await healthSync.requestPermissions();
    }
    setStored(next ? "true" : "false");
    return true;
  }

  return { enabled, isLoading, unavailable, label: healthPlatformLabel(), setEnabled };
}
