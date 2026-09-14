import type { WorkoutSet } from "../shared/schema";
import {
  CLUB_LIFTS,
  STRENGTH_CLUBS,
  TOTAL_WORKOUT_MILESTONES,
  STREAK_MILESTONES,
  strengthBadgeId,
} from "../shared/badges";

function startOfUTCDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function startOfWeekUTC(d: Date): Date {
  const day = startOfUTCDay(d);
  const mondayOffset = (day.getUTCDay() + 6) % 7; // days since Monday (0=Sun..6=Sat -> 6 for Sunday)
  return new Date(day.getTime() - mondayOffset * 86400000);
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

function estimatedOneRepMax(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

// Pure function over a user's already-filtered real workout history (no
// not-yet-due meet-prep entries — see storage.excludeUpcomingPlanEntries) —
// returns every badge id the history currently qualifies for. Badges are
// never revoked once earned; the caller (storage.checkAndAwardBadges) only
// inserts ids this doesn't already have on record.
export function computeEarnedBadgeIds(workouts: WorkoutSet[]): Set<string> {
  const earned = new Set<string>();
  if (workouts.length === 0) return earned;

  // --- Strength clubs: best-ever estimated 1RM per exercise ---
  const bestByExercise = new Map<string, number>();
  for (const w of workouts) {
    const e1rm = estimatedOneRepMax(w.weight, w.reps);
    if (e1rm > (bestByExercise.get(w.exercise) ?? 0)) bestByExercise.set(w.exercise, e1rm);
  }
  for (const club of STRENGTH_CLUBS) {
    if ((bestByExercise.get(club.exercise) ?? 0) >= club.weight) {
      earned.add(strengthBadgeId(club.exercise, club.weight));
    }
  }

  // --- Total logged sets ---
  for (const m of TOTAL_WORKOUT_MILESTONES) {
    if (workouts.length >= m.count) earned.add(m.id);
  }

  // --- Longest-ever consecutive-week training streak ---
  const weekStarts = Array.from(new Set(workouts.map((w) => startOfWeekUTC(toDate(w.date)).getTime()))).sort(
    (a, b) => a - b
  );
  let longestStreak = weekStarts.length > 0 ? 1 : 0;
  let current = longestStreak;
  for (let i = 1; i < weekStarts.length; i++) {
    current = weekStarts[i] - weekStarts[i - 1] === 7 * 86400000 ? current + 1 : 1;
    longestStreak = Math.max(longestStreak, current);
  }
  for (const m of STREAK_MILESTONES) {
    if (longestStreak >= m.weeks) earned.add(m.id);
  }

  // --- PR badges: walk history chronologically, flag each new best e1RM ---
  const chronological = [...workouts].sort((a, b) => {
    const diff = toDate(a.date).getTime() - toDate(b.date).getTime();
    return diff !== 0 ? diff : a.id - b.id;
  });
  const runningBest = new Map<string, number>();
  const prEvents: { exercise: string; date: Date }[] = [];
  for (const w of chronological) {
    const e1rm = estimatedOneRepMax(w.weight, w.reps);
    const prev = runningBest.get(w.exercise) ?? -Infinity;
    if (e1rm > prev) {
      runningBest.set(w.exercise, e1rm);
      prEvents.push({ exercise: w.exercise, date: toDate(w.date) });
    }
  }
  if (prEvents.length >= 1) earned.add("pr:first");
  if (prEvents.length >= 10) earned.add("pr:10");

  const clubLifts: readonly string[] = CLUB_LIFTS;
  const prLiftsByMonth = new Map<string, Set<string>>();
  for (const ev of prEvents) {
    if (!clubLifts.includes(ev.exercise)) continue;
    const key = `${ev.date.getUTCFullYear()}-${ev.date.getUTCMonth()}`;
    if (!prLiftsByMonth.has(key)) prLiftsByMonth.set(key, new Set());
    prLiftsByMonth.get(key)!.add(ev.exercise);
  }
  for (const lifts of Array.from(prLiftsByMonth.values())) {
    if (CLUB_LIFTS.every((lift) => lifts.has(lift))) {
      earned.add("pr:triple-crown");
      break;
    }
  }

  return earned;
}
