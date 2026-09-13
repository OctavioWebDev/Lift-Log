import { tokenStore } from "./token-store";
import { setStorageItemAsync } from "./storage";
import type {
  AuthResponse,
  BillingStatus,
  FoodSearchResult,
  Goal,
  NutritionGoal,
  NutritionLog,
  PublicUser,
  SubscriptionStatus,
  TokenPair,
  WorkoutSet,
} from "./types";

// Set EXPO_PUBLIC_API_URL in .env (see .env.example) to point at your server —
// e.g. http://192.168.1.23:3000 for a phone on the same network as your dev machine.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const REFRESH_TOKEN_KEY = "refreshToken";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const tokens: TokenPair = await res.json();
    tokenStore.setTokens(tokens);
    await setStorageItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function request<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  const accessToken = tokenStore.getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401 && allowRefresh && tokenStore.getRefreshToken()) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, options, false);
    tokenStore.forceSignOut();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new ApiError(res.status, body.message || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

const json = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const api = {
  auth: {
    signup: (data: { username: string; password: string; email?: string }) =>
      request<AuthResponse>("/api/v1/auth/signup", json(data), false),
    login: (data: { username: string; password: string }) =>
      request<AuthResponse>("/api/v1/auth/login", json(data), false),
    logout: (refreshToken: string) => request("/api/v1/auth/logout", json({ refreshToken }), false),
    me: () => request<{ user: PublicUser; subscriptionStatus: SubscriptionStatus }>("/api/v1/auth/me"),
  },
  billing: {
    status: () => request<BillingStatus>("/api/v1/billing/status"),
    createCheckoutSession: (redirectUrl: string) =>
      request<{ url: string }>("/api/v1/billing/checkout", json({ redirectUrl })),
  },
  pushTokens: {
    register: (token: string, platform: string) =>
      request<void>("/api/v1/push-tokens", json({ token, platform })),
    unregister: (token: string) =>
      request<void>("/api/v1/push-tokens", { method: "DELETE", body: JSON.stringify({ token }) }),
  },
  workoutSets: {
    forDate: (date: string) => request<WorkoutSet[]>(`/api/v1/workout-sets?date=${date}`),
    all: () => request<WorkoutSet[]>("/api/v1/workout-sets/all"),
    create: (data: Record<string, unknown>) => request<WorkoutSet>("/api/v1/workout-sets", json(data)),
    update: (id: number, data: Record<string, unknown>) =>
      request<WorkoutSet>(`/api/v1/workout-sets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    remove: (id: number) => request<void>(`/api/v1/workout-sets/${id}`, { method: "DELETE" }),
  },
  goals: {
    all: () => request<Goal[]>("/api/v1/goals"),
    create: (data: Record<string, unknown>) => request<Goal>("/api/v1/goals", json(data)),
    update: (exercise: string, data: Record<string, unknown>) =>
      request<Goal>(`/api/v1/goals/${encodeURIComponent(exercise)}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: number) => request<void>(`/api/v1/goals/${id}`, { method: "DELETE" }),
  },
  nutrition: {
    forDate: (date: string) => request<NutritionLog[]>(`/api/v1/nutrition?date=${date}`),
    create: (data: Record<string, unknown>) => request<NutritionLog>("/api/v1/nutrition", json(data)),
    remove: (id: number) => request<void>(`/api/v1/nutrition/${id}`, { method: "DELETE" }),
    saveGoals: (data: Record<string, unknown>) => request<NutritionGoal>("/api/v1/nutrition/goals", json(data)),
  },
  foodSearch: (q: string) => request<FoodSearchResult[]>(`/api/v1/food/search?q=${encodeURIComponent(q)}`),
};

export { refreshSession, REFRESH_TOKEN_KEY };
