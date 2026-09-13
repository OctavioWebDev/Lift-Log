import { ExerciseType, initialize, insertRecords, requestPermission } from "react-native-health-connect";
import type { HealthSync, HealthWorkoutSet } from "./types";

const SET_DURATION_MS = 60_000;

export const healthSync: HealthSync = {
  async isAvailable() {
    try {
      return await initialize();
    } catch {
      return false;
    }
  },

  async requestPermissions() {
    const granted = await requestPermission([{ accessType: "write", recordType: "ExerciseSession" }]);
    return granted.some((p) => p.recordType === "ExerciseSession");
  },

  async syncWorkoutSet(set: HealthWorkoutSet) {
    const endTime = new Date(set.date.getTime() + SET_DURATION_MS);
    await insertRecords([
      {
        recordType: "ExerciseSession",
        startTime: set.date.toISOString(),
        endTime: endTime.toISOString(),
        exerciseType: ExerciseType.STRENGTH_TRAINING,
        title: `${set.exercise} — ${set.sets}×${set.reps} @ ${set.weight} lbs`,
      },
    ]);
  },
};
