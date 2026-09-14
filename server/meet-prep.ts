// Generates the day-by-day schedule for a meet-prep plan. Each generated
// entry becomes a real (future-dated) workout_sets row — see routes.ts'
// POST /api/meet-prep — so it shows up as a normal editable entry in the
// Workout Log on its date. Kept in its own module since the date/rotation
// math is easiest to reason about (and test) in isolation from Express.

export const MEET_LIFTS = ["Back Squat", "Bench Press", "Conventional Deadlift"] as const;
export type MeetLift = (typeof MEET_LIFTS)[number];

export const PREMADE_DURATIONS = [4, 8, 12, 16] as const;

export interface GeneratedEntry {
  date: Date;
  exercise: MeetLift;
  sets: number;
  reps: number;
  weight: number;
  rpe: number | null;
}

// Computes the calendar dates for `weeks` weeks of training on the given
// weekdays (0=Sun..6=Sat), starting from `startDate` (inclusive). Each
// week's dates land on the same weekday offsets relative to startDate,
// regardless of what day of the week startDate itself falls on.
export function generateTrainingDates(startDate: Date, weeks: number, trainingDays: number[]): Date[] {
  const startDow = startDate.getUTCDay();
  const offsets = Array.from(new Set(trainingDays))
    .map((d) => (d - startDow + 7) % 7)
    .sort((a, b) => a - b);

  const dates: Date[] = [];
  for (let week = 0; week < weeks; week++) {
    for (const offset of offsets) {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + week * 7 + offset);
      dates.push(date);
    }
  }
  return dates;
}

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

// Linear-progression + autoregulation intensity for a given training week
// (0-indexed) out of `totalWeeks`. The final week is a light taper so the
// lifter peaks fresh on meet day; the weeks before it ramp intensity up
// and volume down in a straight line. The RPE is the autoregulation
// target: the prescribed weight is a starting point, adjusted up or down
// on the day based on how it feels relative to that RPE.
function weekProgression(weekIndex: number, totalWeeks: number): { pct: number; reps: number; sets: number; rpe: number } {
  if (weekIndex === totalWeeks - 1) {
    return { pct: 0.6, reps: 2, sets: 2, rpe: 5 };
  }
  const mainWeeks = Math.max(1, totalWeeks - 1);
  const t = mainWeeks <= 1 ? 1 : weekIndex / (mainWeeks - 1);
  const pct = 0.70 + t * (0.90 - 0.70);
  const reps = Math.max(2, Math.round(5 - t * 3));
  const sets = 4;
  const rpe = Math.round(6 + t * 3);
  return { pct, reps, sets, rpe };
}

export interface PremadePlanParams {
  startDate: Date;
  weeks: number;
  trainingDays: number[];
  squatMax: number;
  benchMax: number;
  deadliftMax: number;
}

export function generatePremadePlan(params: PremadePlanParams): GeneratedEntry[] {
  const { startDate, weeks, trainingDays, squatMax, benchMax, deadliftMax } = params;
  const maxes: Record<MeetLift, number> = {
    "Back Squat": squatMax,
    "Bench Press": benchMax,
    "Conventional Deadlift": deadliftMax,
  };
  const dates = generateTrainingDates(startDate, weeks, trainingDays);
  const daysPerWeek = trainingDays.length;

  return dates.map((date, i) => {
    const weekIndex = Math.floor(i / daysPerWeek);
    const exercise = MEET_LIFTS[i % MEET_LIFTS.length];
    const { pct, reps, sets, rpe } = weekProgression(weekIndex, weeks);
    const weight = roundToNearest5(maxes[exercise] * pct);
    return { date, exercise, sets, reps, weight, rpe };
  });
}

export interface CustomPlanParams {
  startDate: Date;
  endDate: Date;
  trainingDays: number[];
  sets: number;
  reps: number;
  squatWeight: number;
  benchWeight: number;
  deadliftWeight: number;
}

// Groups a plan's generated workout_sets rows into week buckets (1-indexed
// for display) relative to the plan's start date, for rendering a
// week-by-week schedule on the Meet Prep page.
export function groupEntriesByWeek<T extends { date: Date | string }>(
  entries: T[],
  startDate: Date,
  totalWeeks: number
): { weekNumber: number; entries: T[] }[] {
  const weeks: { weekNumber: number; entries: T[] }[] = Array.from({ length: totalWeeks }, (_, i) => ({
    weekNumber: i + 1,
    entries: [],
  }));
  for (const entry of entries) {
    const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
    const daysSinceStart = Math.floor((entryDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekIndex = Math.floor(daysSinceStart / 7);
    if (weeks[weekIndex]) weeks[weekIndex].entries.push(entry);
  }
  return weeks;
}

export function generateCustomPlan(params: CustomPlanParams): GeneratedEntry[] {
  const { startDate, endDate, trainingDays, sets, reps, squatWeight, benchWeight, deadliftWeight } = params;
  const weights: Record<MeetLift, number> = {
    "Back Squat": squatWeight,
    "Bench Press": benchWeight,
    "Conventional Deadlift": deadliftWeight,
  };
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const weeks = Math.ceil(totalDays / 7);
  const dates = generateTrainingDates(startDate, weeks, trainingDays).filter((d) => d <= endDate);

  return dates.map((date, i) => {
    const exercise = MEET_LIFTS[i % MEET_LIFTS.length];
    return { date, exercise, sets, reps, weight: weights[exercise], rpe: null };
  });
}
