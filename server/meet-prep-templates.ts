// Structured programs sourced from real published templates (see the PDFs the
// user supplied), for the Meet Prep "Choose a Template" flow. Unlike the
// premade/custom plan types — which only ever generate Squat/Bench/Deadlift
// entries — a template lays out a full multi-exercise day, so it needs a
// richer data shape than generatePremadePlan/generateCustomPlan.
//
// Phase 1 (this file) covers the two templates whose progression is already
// expressed as clean week-by-week percent-of-1RM tables in the source
// material: Advanced Powerlifting 4-Day and Competition Prep. Foundational
// Strength (fixed lb increments, no % math) and Advanced Volume 4-Day
// (RPE-autoregulated, no % prescribed at all) need a different generation
// engine and are intentionally left for a follow-up.

import { generateTrainingDates } from "./meet-prep";

export type MaxKey = "squat" | "bench" | "deadlift";

// A single exercise slot within a template day.
interface TemplateExerciseSlot {
  exercise: string;
  sets: number;
  reps: number;
  // Percent-of-max prescriptions:
  // - `lane` ties this slot to that week's per-lane percent (see
  //   TemplateWeek below) — used for the day's primary competition lift.
  // - `flatPct` is a fixed percent of `maxKey` that doesn't change week to
  //   week — used for named variations the source material gives an
  //   explicit (but not weekly-progressing) percent for, e.g. "Close-Grip
  //   Bench 70%".
  // - Neither set means this is a true accessory with no defensible
  //   percent-of-big-three relationship — see `flatWeight` below.
  maxKey?: MaxKey;
  lane?: string;
  flatPct?: number;
  // For slots with neither maxKey/lane nor maxKey/flatPct: a fixed logged
  // weight every week. 0 for movements normally trained at bodyweight
  // (pull-ups, dips, ab wheel); otherwise a deliberately conservative
  // placeholder (an empty bar) rather than a fabricated "estimate" — the
  // user adjusts once they're actually logging the session, same advice
  // every one of these source programs gives beginners and advanced lifters
  // alike ("start light, it's better to undershoot").
  flatWeight?: number;
}

interface TemplateDay {
  label: string;
  slots: TemplateExerciseSlot[];
}

// One week's percent/sets/reps prescription per named "lane" (e.g. a 4-day
// program hits each lift on both a "heavy" and a "volume" lane each week;
// a 3-day program that trains each lift once a week just has one lane).
// Rep-range or set-count ranges in the source tables (e.g. "5-8 singles")
// are collapsed to their more conservative end — fewer sets, or the
// mid-point of a percent range — since the app logs one concrete
// prescription per set, not a range for the lifter to interpret.
interface TemplateWeek {
  week: number;
  lanes: Record<string, { pct: number; sets: number; reps: number }>;
  isDeload?: boolean;
  // Meet-week taper: only the plan's first scheduled day this week is used
  // (a single light session), regardless of the plan's normal day count.
  singleSessionOnly?: boolean;
}

export interface MeetPrepTemplate {
  id: string;
  name: string;
  description: string;
  weeks: number;
  daysPerWeek: number;
  days: TemplateDay[];
  weeklyTable: TemplateWeek[];
}

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

// ============================================================================
// Advanced Powerlifting 4-Day (12 weeks) — each lift trained twice weekly
// (a "heavy" low-rep day and a "volume" higher-rep day), plus a dedicated
// accessory/variations day. See Advanced_Powerlifting_4Day_Program.pdf.
// ============================================================================
const ADVANCED_POWERLIFTING_4DAY: MeetPrepTemplate = {
  id: "advanced-powerlifting-4day",
  name: "Advanced Powerlifting (4 Days)",
  description:
    "12-week high-frequency program — Squat, Bench, and Deadlift each trained twice a week (heavy + volume), plus a dedicated accessory day. For advanced lifters with established technique on all three lifts.",
  weeks: 12,
  daysPerWeek: 4,
  days: [
    {
      label: "Squat Heavy + Bench Volume",
      slots: [
        { exercise: "Back Squat", sets: 5, reps: 5, maxKey: "squat", lane: "squatHeavy" },
        { exercise: "Pause Squat", sets: 3, reps: 5, maxKey: "squat", flatPct: 0.65 },
        { exercise: "Bench Press", sets: 4, reps: 8, maxKey: "bench", lane: "benchVolume" },
        { exercise: "Leg Press", sets: 3, reps: 12, flatWeight: 45 },
        { exercise: "Incline DB Press", sets: 3, reps: 10, flatWeight: 45 },
        { exercise: "Face Pulls", sets: 3, reps: 15, flatWeight: 45 },
      ],
    },
    {
      label: "Bench Heavy + Deadlift Volume",
      slots: [
        { exercise: "Bench Press", sets: 5, reps: 5, maxKey: "bench", lane: "benchHeavy" },
        { exercise: "Close-Grip Bench Press", sets: 4, reps: 6, maxKey: "bench", flatPct: 0.7 },
        { exercise: "Conventional Deadlift", sets: 4, reps: 8, maxKey: "deadlift", lane: "deadliftVolume" },
        { exercise: "Barbell Row", sets: 4, reps: 8, flatWeight: 45 },
        { exercise: "Dumbbell Overhead Press", sets: 3, reps: 10, flatWeight: 45 },
        { exercise: "Tricep Pushdown", sets: 3, reps: 12, flatWeight: 45 },
      ],
    },
    {
      label: "Deadlift Heavy + Squat Volume",
      slots: [
        { exercise: "Conventional Deadlift", sets: 5, reps: 5, maxKey: "deadlift", lane: "deadliftHeavy" },
        { exercise: "Deficit Deadlift", sets: 3, reps: 6, maxKey: "deadlift", flatPct: 0.65 },
        { exercise: "Back Squat", sets: 4, reps: 8, maxKey: "squat", lane: "squatVolume" },
        { exercise: "Romanian Deadlift", sets: 3, reps: 10, flatWeight: 45 },
        { exercise: "Pull-Up", sets: 4, reps: 8, flatWeight: 0 },
        { exercise: "Leg Curl", sets: 3, reps: 12, flatWeight: 45 },
      ],
    },
    {
      label: "Accessories + Variations",
      slots: [
        { exercise: "Front Squat", sets: 4, reps: 8, maxKey: "squat", flatPct: 0.75 },
        { exercise: "Incline Bench Press", sets: 4, reps: 8, maxKey: "bench", flatPct: 0.65 },
        { exercise: "Rack Pulls", sets: 4, reps: 6, maxKey: "deadlift", flatPct: 0.9 },
        { exercise: "Bulgarian Split Squat", sets: 3, reps: 10, flatWeight: 45 },
        { exercise: "Chest-Supported Row", sets: 4, reps: 10, flatWeight: 45 },
        { exercise: "Dips", sets: 3, reps: 12, flatWeight: 0 },
        { exercise: "Ab Wheel Rollout", sets: 3, reps: 12, flatWeight: 0 },
      ],
    },
  ],
  weeklyTable: [
    // Block 1: Hypertrophy/Work Capacity
    { week: 1, lanes: laneSet(0.76, 5, 5, 0.665, 4, 8) },
    { week: 2, lanes: laneSet(0.785, 5, 5, 0.69, 4, 8) },
    { week: 3, lanes: laneSet(0.81, 4, 5, 0.71, 3, 10) },
    { week: 4, lanes: laneSet(0.7, 3, 5, 0.6, 3, 8), isDeload: true },
    // Block 2: Strength Accumulation
    { week: 5, lanes: laneSet(0.8, 5, 4, 0.7, 4, 6) },
    { week: 6, lanes: laneSet(0.82, 5, 4, 0.72, 4, 6) },
    { week: 7, lanes: laneSet(0.85, 4, 3, 0.75, 3, 6) },
    { week: 8, lanes: laneSet(0.75, 3, 4, 0.65, 3, 6), isDeload: true },
    // Block 3: Intensification
    { week: 9, lanes: laneSet(0.87, 6, 2, 0.75, 3, 5) },
    { week: 10, lanes: laneSet(0.9, 5, 1, 0.77, 3, 4) },
    { week: 11, lanes: laneSet(0.935, 3, 1, 0.8, 2, 1) },
    // Block 4: Taper — meet-week light openers only
    { week: 12, lanes: laneSet(0.55, 1, 1, 0.55, 1, 1), singleSessionOnly: true },
  ],
};

// Builds the 6 lane keys (squat/bench/deadlift × heavy/volume) for a week,
// since every week in this program applies the same heavy%/volume% pair
// across all three lifts.
function laneSet(
  heavyPct: number,
  heavySets: number,
  heavyReps: number,
  volumePct: number,
  volumeSets: number,
  volumeReps: number
): TemplateWeek["lanes"] {
  return {
    squatHeavy: { pct: heavyPct, sets: heavySets, reps: heavyReps },
    benchHeavy: { pct: heavyPct, sets: heavySets, reps: heavyReps },
    deadliftHeavy: { pct: heavyPct, sets: heavySets, reps: heavyReps },
    squatVolume: { pct: volumePct, sets: volumeSets, reps: volumeReps },
    benchVolume: { pct: volumePct, sets: volumeSets, reps: volumeReps },
    deadliftVolume: { pct: volumePct, sets: volumeSets, reps: volumeReps },
  };
}

// ============================================================================
// Competition Prep (12 weeks, 3 days/week) — each lift trained once a week
// on its own focus day, peaking toward a meet. See
// Powerlifting_Competition_12Week_Program.pdf.
// ============================================================================
const COMPETITION_PREP_12WEEK: MeetPrepTemplate = {
  id: "competition-prep-12week",
  name: "Competition Prep (12 Weeks)",
  description:
    "12-week peaking program for lifters with an established 1RM on all three lifts, preparing for a meet or a strength test. Squat, Bench, and Deadlift each get their own focus day; volume tapers down as intensity climbs toward a peak.",
  weeks: 12,
  daysPerWeek: 3,
  days: [
    {
      label: "Squat Focus",
      slots: [
        { exercise: "Back Squat", sets: 5, reps: 5, maxKey: "squat", lane: "squat" },
        { exercise: "Pause Squat", sets: 3, reps: 5, maxKey: "squat", flatPct: 0.6 },
        { exercise: "Close-Grip Bench Press", sets: 4, reps: 6, maxKey: "bench", flatPct: 0.65 },
        { exercise: "Front Squat", sets: 3, reps: 8, flatWeight: 45 },
        { exercise: "Romanian Deadlift", sets: 3, reps: 8, flatWeight: 45 },
        { exercise: "Ab Wheel Rollout", sets: 3, reps: 10, flatWeight: 0 },
      ],
    },
    {
      label: "Bench Focus",
      slots: [
        { exercise: "Bench Press", sets: 5, reps: 5, maxKey: "bench", lane: "bench" },
        { exercise: "Spoto Press", sets: 4, reps: 6, maxKey: "bench", flatPct: 0.6 },
        { exercise: "Overhead Press", sets: 4, reps: 6, flatWeight: 45 },
        { exercise: "Barbell Row", sets: 4, reps: 8, flatWeight: 45 },
        { exercise: "Dips", sets: 3, reps: 10, flatWeight: 0 },
        { exercise: "Face Pulls", sets: 3, reps: 15, flatWeight: 45 },
      ],
    },
    {
      label: "Deadlift Focus",
      slots: [
        { exercise: "Conventional Deadlift", sets: 5, reps: 5, maxKey: "deadlift", lane: "deadlift" },
        { exercise: "Deficit Deadlift", sets: 3, reps: 6, maxKey: "deadlift", flatPct: 0.6 },
        { exercise: "Safety Bar Squat", sets: 4, reps: 6, flatWeight: 45 },
        { exercise: "Pull-Up", sets: 4, reps: 8, flatWeight: 0 },
        { exercise: "Leg Curl", sets: 3, reps: 10, flatWeight: 45 },
        { exercise: "Back Extension", sets: 3, reps: 12, flatWeight: 0 },
      ],
    },
  ],
  weeklyTable: [
    // Phase 1: Base Building
    { week: 1, lanes: soloLaneSet(0.71, 5, 5) },
    { week: 2, lanes: soloLaneSet(0.735, 5, 5) },
    { week: 3, lanes: soloLaneSet(0.775, 4, 5) },
    { week: 4, lanes: soloLaneSet(0.675, 3, 5), isDeload: true },
    // Phase 2: Strength Development
    { week: 5, lanes: soloLaneSet(0.775, 5, 3) },
    { week: 6, lanes: soloLaneSet(0.825, 5, 3) },
    { week: 7, lanes: soloLaneSet(0.845, 6, 2) },
    { week: 8, lanes: soloLaneSet(0.725, 3, 3), isDeload: true },
    // Phase 3: Peak
    { week: 9, lanes: soloLaneSet(0.885, 6, 1) },
    { week: 10, lanes: soloLaneSet(0.91, 4, 1) },
    // Phase 4: Taper
    { week: 11, lanes: soloLaneSet(0.85, 2, 1) },
    { week: 12, lanes: soloLaneSet(0.55, 1, 1), singleSessionOnly: true },
  ],
};

function soloLaneSet(pct: number, sets: number, reps: number): TemplateWeek["lanes"] {
  return {
    squat: { pct, sets, reps },
    bench: { pct, sets, reps },
    deadlift: { pct, sets, reps },
  };
}

export const MEET_PREP_TEMPLATES: MeetPrepTemplate[] = [ADVANCED_POWERLIFTING_4DAY, COMPETITION_PREP_12WEEK];

export function getMeetPrepTemplate(id: string): MeetPrepTemplate | undefined {
  return MEET_PREP_TEMPLATES.find((t) => t.id === id);
}

export interface TemplatePlanParams {
  templateId: string;
  startDate: Date;
  trainingDays: number[];
  squatMax: number;
  benchMax: number;
  deadliftMax: number;
}

export interface GeneratedTemplateEntry {
  date: Date;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  rpe: number | null;
}

export function generateTemplatePlan(
  params: TemplatePlanParams
): { error: string } | { entries: GeneratedTemplateEntry[] } {
  const template = getMeetPrepTemplate(params.templateId);
  if (!template) return { error: "Unknown template" };
  if (params.trainingDays.length !== template.daysPerWeek) {
    return { error: `${template.name} trains ${template.daysPerWeek} days a week — select exactly ${template.daysPerWeek} training days` };
  }

  const maxes: Record<MaxKey, number> = {
    squat: params.squatMax,
    bench: params.benchMax,
    deadlift: params.deadliftMax,
  };

  const dates = generateTrainingDates(params.startDate, template.weeks, params.trainingDays);
  const entries: GeneratedTemplateEntry[] = [];

  for (let i = 0; i < dates.length; i++) {
    const weekIndex = Math.floor(i / template.daysPerWeek); // 0-based
    const dayIndex = i % template.daysPerWeek;
    const week = template.weeklyTable[weekIndex];
    if (!week) continue;
    if (week.singleSessionOnly && dayIndex !== 0) continue;

    const day = template.days[dayIndex];
    for (const slot of day.slots) {
      let weight: number;
      if (slot.lane) {
        const lane = week.lanes[slot.lane];
        weight = roundToNearest5(maxes[slot.maxKey!] * lane.pct);
      } else if (slot.flatPct != null && slot.maxKey) {
        weight = roundToNearest5(maxes[slot.maxKey] * slot.flatPct);
      } else {
        weight = slot.flatWeight ?? 45;
      }

      const setsReps = slot.lane ? week.lanes[slot.lane] : null;
      entries.push({
        date: dates[i],
        exercise: slot.exercise,
        sets: setsReps?.sets ?? slot.sets,
        reps: setsReps?.reps ?? slot.reps,
        weight,
        rpe: null,
      });
    }
  }

  return { entries };
}
