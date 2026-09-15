// Structured programs sourced from real published templates (see the PDFs the
// user supplied), for the Meet Prep "Choose a Template" flow. Unlike the
// premade/custom plan types — which only ever generate Squat/Bench/Deadlift
// entries — a template lays out a full multi-exercise day, so it needs a
// richer data shape than generatePremadePlan/generateCustomPlan.
//
// Four templates, two different progression models:
// - Advanced Powerlifting 4-Day and Competition Prep are both driven by a
//   clean week-by-week percent-of-1RM table in the source material (`lane`/
//   `flatPct` below).
// - Foundational Strength (fixed lb increments, no % math) and Advanced
//   Volume 4-Day (RPE-autoregulated, no % prescribed at all) instead work
//   off a starting weight the user provides per main lift (`fixedIncrement`/
//   `flatFromInput` below).
// Exercises with no defensible weight relationship to any input in either
// model (most accessories) get a flat, deliberately conservative starting
// estimate instead — see `flatWeight` below for why, and why that's never a
// fabricated percentage.

import { generateTrainingDates } from "./meet-prep";

export type MaxKey = "squat" | "bench" | "deadlift";
export type StartKey = MaxKey | "ohp";

// A single exercise slot within a template day. Exactly one progression
// field applies (checked in that order by generateTemplatePlan); a slot
// with none of them is a true accessory and falls back to `flatWeight`.
interface TemplateExerciseSlot {
  exercise: string;
  sets: number;
  reps: number;
  // `lane` ties this slot to that week's per-lane percent (see
  // TemplateWeek below) — used for a day's primary competition lift, whose
  // percent climbs/falls week to week per the source program's table.
  maxKey?: MaxKey;
  lane?: string;
  // A fixed percent of `maxKey` that doesn't change week to week — used
  // for named variations the source material gives an explicit (but not
  // weekly-progressing) percent for, e.g. "Close-Grip Bench 70%". Never
  // set for an exercise the source leaves unprescribed (shown as "--" in
  // its table) — that's a fabricated ratio, not a sourced one.
  flatPct?: number;
  // Fixed lb-per-week progression off a user-supplied starting weight —
  // Foundational Strength's model, which has no percent-of-max anywhere.
  // `multiplier` scales the computed weight afterward, for a slot that's
  // explicitly a lighter version of the same lift (e.g. "additional squat
  // volume, lighter load").
  fixedIncrement?: { startKey: StartKey; bodyPart: "lower" | "upper"; multiplier?: number };
  // The user's starting weight for this lift, held constant across every
  // week — Advanced Volume's model: it's RPE-autoregulated by design, so
  // there's no formula in the source material to project a future week's
  // weight from. The lifter adjusts by feel each session, same as the
  // program itself instructs.
  flatFromInput?: { startKey: StartKey };
  // For slots with none of the above: a fixed logged weight every week. 0
  // for movements normally trained at bodyweight (pull-ups, dips, ab
  // wheel); otherwise a deliberately conservative placeholder (an empty
  // bar) rather than a fabricated "estimate" — the user adjusts once
  // they're actually logging the session, same advice every one of these
  // source programs gives beginners and advanced lifters alike ("start
  // light, it's better to undershoot").
  flatWeight?: number;
}

interface TemplateDay {
  label: string;
  slots: TemplateExerciseSlot[];
}

// One week's percent/sets/reps prescription per named "lane" (e.g. a 4-day
// program hits each lift on both a "heavy" and a "volume" lane each week;
// a 3-day program that trains each lift once a week just has one lane).
// Only used by the two percent-of-max templates — Foundational Strength and
// Advanced Volume compute their weights directly from week index instead
// (see `fixedIncrement`/`flatFromInput` above), so they have no weeklyTable.
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
  weeklyTable?: TemplateWeek[];
  // Whether this template needs an Overhead Press starting number in
  // addition to Squat/Bench/Deadlift — true for both fixed-increment
  // templates (Foundational Strength, Advanced Volume), false for the two
  // percent-of-max ones, which only ever use OHP as a flat accessory.
  requiresOhp?: boolean;
  // Whether the maxes/starts the user enters are a true 1RM (percent-based
  // templates) or just a week-1 working weight (fixed-increment templates)
  // — purely for the create-plan form's field labels.
  inputKind: "oneRepMax" | "startingWeight";
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
  inputKind: "oneRepMax",
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
      // Source table gives no intensity % for any exercise on this day
      // ("--" in every row) — all four are true accessories, not scaled
      // off a 1RM.
      label: "Accessories + Variations",
      slots: [
        { exercise: "Front Squat", sets: 4, reps: 8, flatWeight: 45 },
        { exercise: "Incline Bench Press", sets: 4, reps: 8, flatWeight: 45 },
        { exercise: "Rack Pulls", sets: 4, reps: 6, flatWeight: 45 },
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
  inputKind: "oneRepMax",
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

// ============================================================================
// Foundational Strength (12 weeks, 2 days/week) — beginner A/B full-body
// split, alternating every session (not resetting each week), with fixed lb
// increments instead of percent-of-max. See
// Foundational_Strength_2Day_Program.pdf.
// ============================================================================
const FOUNDATIONAL_STRENGTH_2DAY: MeetPrepTemplate = {
  id: "foundational-strength-2day",
  name: "Foundational Strength (2 Days)",
  description:
    "12-week beginner program, 2 days a week alternating A/B full-body workouts. No percent-of-max math — you give a starting weight and the plan adds a fixed amount each week, with a deload in week 8 and a light recovery week 12.",
  weeks: 12,
  daysPerWeek: 2,
  requiresOhp: true,
  inputKind: "startingWeight",
  days: [
    {
      label: "Workout A: Squat Focus",
      slots: [
        { exercise: "Back Squat", sets: 3, reps: 8, fixedIncrement: { startKey: "squat", bodyPart: "lower" } },
        { exercise: "Bench Press", sets: 3, reps: 8, fixedIncrement: { startKey: "bench", bodyPart: "upper" } },
        { exercise: "Dumbbell Row", sets: 3, reps: 10, flatWeight: 30 },
      ],
    },
    {
      label: "Workout B: Deadlift Focus",
      slots: [
        { exercise: "Conventional Deadlift", sets: 3, reps: 6, fixedIncrement: { startKey: "deadlift", bodyPart: "lower" } },
        { exercise: "Overhead Press", sets: 3, reps: 8, fixedIncrement: { startKey: "ohp", bodyPart: "upper" } },
        { exercise: "Lat Pulldown", sets: 3, reps: 10, flatWeight: 45 },
        {
          exercise: "Back Squat",
          sets: 3,
          reps: 8,
          fixedIncrement: { startKey: "squat", bodyPart: "lower", multiplier: 0.8 },
        },
      ],
    },
  ],
};

// Foundational Strength's week-by-week weight, per the program's own
// progression strategy: +5-10 lb/week on lower-body lifts, +2.5-5 lb/week on
// upper-body lifts (using the midpoint of each range) through week 7, a
// week-8 deload at 60% of week 7, resumed progression for weeks 9-11 picking
// back up from week 7's weight (not the deload dip), and a week-12 light
// recovery week.
function foundationalStrengthWeight(startWeight: number, week: number, bodyPart: "lower" | "upper"): number {
  const weeklyIncrement = bodyPart === "lower" ? 7.5 : 3.75;
  const week7 = startWeight + 6 * weeklyIncrement;
  if (week <= 7) return roundToNearest5(startWeight + (week - 1) * weeklyIncrement);
  if (week === 8) return roundToNearest5(week7 * 0.6);
  if (week <= 11) return roundToNearest5(week7 + (week - 7) * weeklyIncrement);
  const week11 = week7 + 4 * weeklyIncrement;
  return roundToNearest5(week11 * 0.55); // week 12: light recovery
}

// ============================================================================
// Advanced Volume 4-Day (8 weeks, 4 days/week) — intermediate upper/lower
// split with RPE-autoregulated loading. The source material prescribes no
// percent-of-max or lb-increment anywhere (only rep ranges, RPE targets,
// and intensity techniques like drop sets/rest-pause/tempo/clusters), so
// every exercise's weight is just the user's starting number, held flat
// across all 8 weeks — the lifter is expected to add weight by feel as the
// program itself instructs, same as with any RPE-based plan. See
// Advanced_Volume_4Day_Program.pdf.
// ============================================================================
const ADVANCED_VOLUME_4DAY: MeetPrepTemplate = {
  id: "advanced-volume-4day",
  name: "Advanced Volume (4 Days)",
  description:
    "8-week intermediate upper/lower split with drop sets, rest-pause, tempo, and cluster sets. Fully RPE-autoregulated — there's no percent-of-max or weekly increment in the source program, so weight starts at what you give it and you adjust by feel each session, same as the program itself instructs. Note: the source's week-8 deload (\"60% intensity\") isn't applied automatically since it isn't tied to a formula — back off the weight yourself that week.",
  weeks: 8,
  daysPerWeek: 4,
  requiresOhp: true,
  inputKind: "startingWeight",
  days: [
    {
      label: "Day 1: Upper Body - Strength Focus",
      slots: [
        { exercise: "Bench Press", sets: 4, reps: 6, flatFromInput: { startKey: "bench" } },
        { exercise: "Pull-Up", sets: 4, reps: 6, flatWeight: 0 },
        { exercise: "Incline DB Press", sets: 3, reps: 10, flatWeight: 30 },
        { exercise: "Cable Row", sets: 3, reps: 10, flatWeight: 45 },
        { exercise: "Lateral Raise", sets: 3, reps: 12, flatWeight: 15 },
        { exercise: "Barbell Curl", sets: 3, reps: 10, flatWeight: 30 },
        { exercise: "Tricep Pushdown", sets: 3, reps: 10, flatWeight: 30 },
      ],
    },
    {
      label: "Day 2: Lower Body - Squat Emphasis",
      slots: [
        { exercise: "Back Squat", sets: 5, reps: 6, flatFromInput: { startKey: "squat" } },
        { exercise: "Romanian Deadlift", sets: 4, reps: 8, flatWeight: 45 },
        { exercise: "Walking Lunge", sets: 3, reps: 12, flatWeight: 25 },
        { exercise: "Leg Curl", sets: 3, reps: 10, flatWeight: 45 },
        { exercise: "Calf Raise", sets: 4, reps: 15, flatWeight: 45 },
      ],
    },
    {
      label: "Day 3: Upper Body - Hypertrophy Focus",
      slots: [
        { exercise: "Overhead Press", sets: 4, reps: 8, flatFromInput: { startKey: "ohp" } },
        { exercise: "Dumbbell Bench Press", sets: 3, reps: 10, flatWeight: 30 },
        { exercise: "Barbell Row", sets: 4, reps: 8, flatWeight: 45 },
        { exercise: "Lat Pulldown", sets: 3, reps: 10, flatWeight: 45 },
        { exercise: "Chest-Supported Row", sets: 3, reps: 10, flatWeight: 45 },
        { exercise: "Face Pulls", sets: 3, reps: 15, flatWeight: 45 },
        { exercise: "Lateral Raise", sets: 3, reps: 12, flatWeight: 15 },
        { exercise: "Cable Curl", sets: 3, reps: 12, flatWeight: 30 },
      ],
    },
    {
      label: "Day 4: Lower Body - Deadlift Emphasis",
      slots: [
        { exercise: "Conventional Deadlift", sets: 5, reps: 5, flatFromInput: { startKey: "deadlift" } },
        { exercise: "Front Squat", sets: 4, reps: 8, flatWeight: 45 },
        { exercise: "Leg Extension", sets: 3, reps: 12, flatWeight: 45 },
        { exercise: "Leg Curl", sets: 3, reps: 12, flatWeight: 45 },
        { exercise: "Seated Calf Raise", sets: 4, reps: 15, flatWeight: 45 },
      ],
    },
  ],
};

export const MEET_PREP_TEMPLATES: MeetPrepTemplate[] = [
  ADVANCED_POWERLIFTING_4DAY,
  COMPETITION_PREP_12WEEK,
  FOUNDATIONAL_STRENGTH_2DAY,
  ADVANCED_VOLUME_4DAY,
];

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
  ohpMax?: number;
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
  if (template.requiresOhp && (params.ohpMax == null || isNaN(params.ohpMax) || params.ohpMax <= 0)) {
    return { error: "Enter a starting weight for Overhead Press" };
  }

  const starts: Record<StartKey, number> = {
    squat: params.squatMax,
    bench: params.benchMax,
    deadlift: params.deadliftMax,
    ohp: params.ohpMax ?? 0,
  };

  const dates = generateTrainingDates(params.startDate, template.weeks, params.trainingDays);
  const entries: GeneratedTemplateEntry[] = [];

  for (let i = 0; i < dates.length; i++) {
    const weekIndex = Math.floor(i / template.daysPerWeek); // 0-based
    const week1Indexed = weekIndex + 1;
    const dayIndex = i % template.daysPerWeek;
    const week = template.weeklyTable?.[weekIndex];
    if (template.weeklyTable && !week) continue;
    if (week?.singleSessionOnly && dayIndex !== 0) continue;

    const day = template.days[dayIndex];
    for (const slot of day.slots) {
      let weight: number;
      if (slot.lane && week) {
        const lane = week.lanes[slot.lane];
        weight = roundToNearest5(starts[slot.maxKey!] * lane.pct);
      } else if (slot.flatPct != null && slot.maxKey) {
        weight = roundToNearest5(starts[slot.maxKey] * slot.flatPct);
      } else if (slot.fixedIncrement) {
        const base = foundationalStrengthWeight(
          starts[slot.fixedIncrement.startKey],
          week1Indexed,
          slot.fixedIncrement.bodyPart
        );
        weight = roundToNearest5(base * (slot.fixedIncrement.multiplier ?? 1));
      } else if (slot.flatFromInput) {
        weight = roundToNearest5(starts[slot.flatFromInput.startKey]);
      } else {
        weight = slot.flatWeight ?? 45;
      }

      const setsReps = slot.lane && week ? week.lanes[slot.lane] : null;
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
