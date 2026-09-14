// ============================================================================
// BADGE CATALOG
// ============================================================================
// Static definitions for every badge a user can earn. Earning itself is
// computed from workout history — see server/badges.ts computeEarnedBadgeIds
// — and persisted per-user in the user_badges table (shared/schema.ts).

export type BadgeCategory = "strength" | "consistency" | "pr";

export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon: string;
}

// The three lifts strength-club and "Triple Crown" badges are scored
// against — matches the meet-prep feature's canonical big-three lifts
// (see server/meet-prep.ts MEET_LIFTS) so the same exercise names earn both.
export const CLUB_LIFTS = ["Back Squat", "Bench Press", "Conventional Deadlift"] as const;

interface StrengthClub {
  exercise: (typeof CLUB_LIFTS)[number];
  weight: number;
  label: string;
}

export const STRENGTH_CLUBS: StrengthClub[] = [
  { exercise: "Bench Press", weight: 135, label: "One Plate" },
  { exercise: "Bench Press", weight: 225, label: "Two Plate" },
  { exercise: "Bench Press", weight: 315, label: "Three Plate" },
  { exercise: "Bench Press", weight: 405, label: "Four Plate" },
  { exercise: "Back Squat", weight: 225, label: "Two Plate" },
  { exercise: "Back Squat", weight: 315, label: "Three Plate" },
  { exercise: "Back Squat", weight: 405, label: "Four Plate" },
  { exercise: "Back Squat", weight: 495, label: "Five Plate" },
  { exercise: "Conventional Deadlift", weight: 225, label: "Two Plate" },
  { exercise: "Conventional Deadlift", weight: 315, label: "Three Plate" },
  { exercise: "Conventional Deadlift", weight: 405, label: "Four Plate" },
  { exercise: "Conventional Deadlift", weight: 495, label: "Five Plate" },
];

export function strengthBadgeId(exercise: string, weight: number): string {
  return `strength:${exercise}:${weight}`;
}

const STRENGTH_BADGES: BadgeDefinition[] = STRENGTH_CLUBS.map((club) => ({
  id: strengthBadgeId(club.exercise, club.weight),
  name: `${club.label} Club`,
  description: `Hit an estimated ${club.weight} lb 1-rep max on ${club.exercise}.`,
  category: "strength",
  icon: "🏋️",
}));

export const TOTAL_WORKOUT_MILESTONES = [
  { count: 10, id: "workouts:10", name: "Getting Started", description: "Log 10 workout sets.", icon: "🌱" },
  { count: 50, id: "workouts:50", name: "Committed", description: "Log 50 workout sets.", icon: "💪" },
  { count: 100, id: "workouts:100", name: "Century Club", description: "Log 100 workout sets.", icon: "💯" },
  { count: 365, id: "workouts:365", name: "Iron Habit", description: "Log 365 workout sets.", icon: "🔥" },
  { count: 500, id: "workouts:500", name: "Half Grand", description: "Log 500 workout sets.", icon: "⚡" },
] as const;

export const STREAK_MILESTONES = [
  { weeks: 4, id: "streak:4", name: "On a Roll", description: "Train at least 4 weeks in a row.", icon: "📅" },
  { weeks: 8, id: "streak:8", name: "Locked In", description: "Train at least 8 weeks in a row.", icon: "🔒" },
  { weeks: 12, id: "streak:12", name: "Quarter Warrior", description: "Train at least 12 weeks in a row.", icon: "🗓️" },
  { weeks: 26, id: "streak:26", name: "Half-Year Hero", description: "Train at least 26 weeks in a row.", icon: "🎖️" },
  { weeks: 52, id: "streak:52", name: "Iron Year", description: "Train at least 52 weeks in a row.", icon: "🏆" },
] as const;

const CONSISTENCY_BADGES: BadgeDefinition[] = [
  ...TOTAL_WORKOUT_MILESTONES.map((m) => ({
    id: m.id, name: m.name, description: m.description, category: "consistency" as const, icon: m.icon,
  })),
  ...STREAK_MILESTONES.map((m) => ({
    id: m.id, name: m.name, description: m.description, category: "consistency" as const, icon: m.icon,
  })),
];

export const PR_BADGES: BadgeDefinition[] = [
  { id: "pr:first", name: "First PR", description: "Set your first-ever estimated 1-rep max.", category: "pr", icon: "🥇" },
  { id: "pr:10", name: "PR Machine", description: "Set 10 lifetime PRs.", category: "pr", icon: "⚙️" },
  {
    id: "pr:triple-crown",
    name: "Triple Crown",
    description: "PR the Squat, Bench, and Deadlift all in the same month.",
    category: "pr",
    icon: "👑",
  },
];

export const ALL_BADGES: BadgeDefinition[] = [...STRENGTH_BADGES, ...CONSISTENCY_BADGES, ...PR_BADGES];
export const BADGES_BY_ID: Record<string, BadgeDefinition> = Object.fromEntries(
  ALL_BADGES.map((b) => [b.id, b])
);
