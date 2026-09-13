import { api } from "../api";
import { todayISODate } from "../date";
import { entityApis } from "./entities";
import { sqliteStore } from "./sqlite-store";
import { pullAndMerge, pushOutbox } from "./sync";

let isSyncing = false;
let rerunRequested = false;
const listeners = new Set<() => void>();

export function onSyncSettled(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Push whatever's queued, then pull the current server state for each entity type
// and merge it in. Coalesces overlapping calls (e.g. a mutation firing this right
// as a foreground-triggered sync is already running) into a single extra pass
// rather than running them concurrently against the same local store.
export async function runSync(userId: string): Promise<void> {
  if (isSyncing) {
    rerunRequested = true;
    return;
  }
  isSyncing = true;
  try {
    await pushOutbox(sqliteStore, entityApis);

    const [workoutSets, goals, nutritionLogs] = await Promise.all([
      api.workoutSets.all(),
      api.goals.all(),
      api.nutrition.forDate(todayISODate()),
    ]);
    await pullAndMerge(sqliteStore, "workoutSets", userId, workoutSets);
    await pullAndMerge(sqliteStore, "goals", userId, goals);
    await pullAndMerge(sqliteStore, "nutritionLogs", userId, nutritionLogs);
  } catch (err) {
    console.warn("[sync] run failed (will retry on next trigger):", err);
  } finally {
    isSyncing = false;
    listeners.forEach((l) => l());
    if (rerunRequested) {
      rerunRequested = false;
      runSync(userId);
    }
  }
}

export async function getPendingOpCount(): Promise<number> {
  return (await sqliteStore.listOps()).length;
}
