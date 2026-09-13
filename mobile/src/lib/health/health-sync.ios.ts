import {
  isHealthDataAvailable,
  requestAuthorization,
  saveWorkoutSample,
  WorkoutActivityType,
  WorkoutTypeIdentifier,
} from "@kingstinct/react-native-healthkit";
import type { HealthSync, HealthWorkoutSet } from "./types";

const SET_DURATION_MS = 60_000;

export const healthSync: HealthSync = {
  async isAvailable() {
    return isHealthDataAvailable();
  },

  async requestPermissions() {
    return requestAuthorization({ toShare: [WorkoutTypeIdentifier] });
  },

  async syncWorkoutSet(set: HealthWorkoutSet) {
    const endDate = new Date(set.date.getTime() + SET_DURATION_MS);
    await saveWorkoutSample(
      WorkoutActivityType.traditionalStrengthTraining,
      [],
      set.date,
      endDate,
      undefined,
      { exercise: set.exercise, sets: set.sets, reps: set.reps, weight: set.weight }
    );
  },
};
