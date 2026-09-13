import type { HealthSync } from "./types";

// Fallback for web and any platform without a dedicated implementation above.
// Metro picks health-sync.ios.ts / health-sync.android.ts automatically on
// those platforms via the file extension, so this file — and the native
// HealthKit/Health Connect imports — never gets bundled into a web build.
export const healthSync: HealthSync = {
  async isAvailable() {
    return false;
  },
  async requestPermissions() {
    return false;
  },
  async syncWorkoutSet() {
    // no-op
  },
};
