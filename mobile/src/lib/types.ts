// Mirrors the shapes returned by the /api/v1 JSON API (see server/routes/api-v1.ts
// and shared/schema.ts on the server). Kept as plain types here rather than importing
// from the server package, since Metro isn't set up to resolve outside this app yet.

export interface PublicUser {
  id: string;
  username: string;
  email: string | null;
  isAdmin: boolean;
}

export type SubscriptionStatus = "active" | "expired";

export interface AuthResponse {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface WorkoutSet {
  id: number;
  userId: string;
  clientId?: string | null;
  exercise: string;
  sets: number;
  weight: number;
  reps: number;
  rpe: number | null;
  date: string;
  updatedAt: string;
}

export interface Goal {
  id: number;
  userId: string;
  clientId?: string | null;
  exercise: string;
  current: number;
  target: number;
  unit: string;
  updatedAt: string;
}

export interface NutritionLog {
  id: number;
  userId: string;
  clientId?: string | null;
  date: string;
  foodName: string;
  brandName: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  updatedAt: string;
}

export interface NutritionGoal {
  id: number;
  userId: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  updatedAt: string;
}

export interface FoodSearchResult {
  name: string;
  brand: string;
  gramsPerServing: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface BillingStatus {
  status: SubscriptionStatus;
  subscriptionInterval: string | null;
  currentPeriodEndsAt: string | null;
}

export interface Profile extends PublicUser {
  avatarUrl: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  sex: string | null;
  bodyweight: number | null;
  heightInches: number | null;
}

export type MeetPrepType = "custom" | "premade" | "template";

export interface MeetPrep {
  id: number;
  userId: string;
  name: string;
  planType: MeetPrepType;
  startDate: string;
  endDate: string;
  weeks: number;
  // JSON-encoded array of weekday numbers (0=Sun..6=Sat) the plan trains on.
  trainingDays: string;
  squatMax: number | null;
  benchMax: number | null;
  deadliftMax: number | null;
  repScheme: string | null;
  // Which catalog template (see MeetPrepTemplateSummary) generated this plan
  // — only set when planType is "template".
  templateId: string | null;
  createdAt: string;
}

export interface MeetPrepEntry {
  id: number;
  exercise: string;
  sets: number;
  reps: number;
  weight: number;
  rpe: number | null;
  date: string;
  meetPrepId: number | null;
}

export interface MeetPrepTemplateSummary {
  id: string;
  name: string;
  description: string;
  weeks: number;
  daysPerWeek: number;
  requiresOhp?: boolean;
  inputKind: "oneRepMax" | "startingWeight";
}

export interface MeetPrepConfig {
  meetLifts: string[];
  premadeDurations: number[];
  templates: MeetPrepTemplateSummary[];
}

export type BadgeCategory = "strength" | "consistency" | "pr";

export interface Badge {
  id: string;
  name: string;
  description: string;
  category: BadgeCategory;
  icon: string;
  earnedAt: string | null;
  progress: { current: number; target: number } | null;
}

export interface BadgesView {
  badges: Badge[];
  earnedCount: number;
  totalCount: number;
}
