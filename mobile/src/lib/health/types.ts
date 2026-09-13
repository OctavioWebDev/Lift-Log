// One logged set, as needed to write a corresponding entry to Apple Health /
// Health Connect. Each set is synced as its own short strength-training
// session (start = when it was logged, end = a nominal minute later) rather
// than aggregated into one session per day — simpler and safer to implement
// without a device to test against, since it never needs to delete or merge
// anything it (or another app) previously wrote to Health.
export interface HealthWorkoutSet {
  date: Date;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
}

export interface HealthSync {
  // Whether this platform's health store exists on this device at all (e.g.
  // false in a simulator without Health, or a device with Health Connect
  // uninstalled and unable to be prompted for install).
  isAvailable(): Promise<boolean>;
  // Prompts for write access. Returns whether the request completed — on iOS,
  // HealthKit deliberately never reports whether access was actually granted.
  requestPermissions(): Promise<boolean>;
  syncWorkoutSet(set: HealthWorkoutSet): Promise<void>;
}
