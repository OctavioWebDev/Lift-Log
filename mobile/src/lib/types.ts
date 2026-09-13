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
