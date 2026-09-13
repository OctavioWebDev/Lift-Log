import { api } from "../api";
import type { EntityApiMap } from "./sync";

// Wires the real API client into the generic sync engine's EntityApi shape for each
// syncable entity. Goals and nutrition logs don't expose an update endpoint the
// mobile app uses yet (goals updates key off exercise name, not id; nutrition has
// no update endpoint at all) — those stay unimplemented since no screen enqueues an
// update for them today. Update this if that changes.
export const entityApis: EntityApiMap = {
  workoutSets: {
    create: (payload) => api.workoutSets.create(payload),
    update: (serverId, payload) => api.workoutSets.update(serverId, payload),
    remove: (serverId) => api.workoutSets.remove(serverId),
  },
  goals: {
    create: (payload) => api.goals.create(payload),
    update: () => {
      throw new Error("Goal updates are not wired up yet");
    },
    remove: (serverId) => api.goals.remove(serverId),
  },
  nutritionLogs: {
    create: (payload) => api.nutrition.create(payload),
    update: () => {
      throw new Error("Nutrition log updates are not wired up yet");
    },
    remove: (serverId) => api.nutrition.remove(serverId),
  },
};
