import { tokenStore } from "./token-store";
import { setStorageItemAsync } from "./storage";
import type {
  AuthResponse,
  BadgesView,
  BillingStatus,
  FoodSearchResult,
  Goal,
  MeetPrep,
  MeetPrepConfig,
  MeetPrepEntry,
  NutritionGoal,
  NutritionLog,
  Profile,
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
  // A FormData body (avatar upload) needs its own multipart boundary in
  // Content-Type, which fetch/RN sets automatically — forcing
  // application/json here would break the upload.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
  profile: {
    get: () => request<{ user: Profile }>("/api/v1/profile"),
    update: (data: Record<string, unknown>) =>
      request<{ user: Profile }>("/api/v1/profile", { method: "PATCH", body: JSON.stringify(data) }),
    // `file` is the shape expo-image-picker's result maps to for a multipart
    // upload: { uri, name, type }. RN's fetch polyfill turns this into a real
    // file part when appended to FormData.
    uploadAvatar: (file: { uri: string; name: string; type: string }) => {
      const form = new FormData();
      form.append("avatar", file as unknown as Blob);
      return request<{ user: Profile }>("/api/v1/profile/avatar", { method: "POST", body: form });
    },
    removeAvatar: () => request<{ user: Profile }>("/api/v1/profile/avatar", { method: "DELETE" }),
  },
  meetPrep: {
    config: () => request<MeetPrepConfig>("/api/v1/meet-prep/config"),
    list: () => request<{ plans: MeetPrep[] }>("/api/v1/meet-preps"),
    detail: (id: number) => request<{ plan: MeetPrep; entries: MeetPrepEntry[] }>(`/api/v1/meet-preps/${id}`),
    create: (data: Record<string, unknown>) => request<{ meetPrep: MeetPrep }>("/api/v1/meet-preps", json(data)),
    remove: (id: number) => request<void>(`/api/v1/meet-preps/${id}`, { method: "DELETE" }),
  },
  badges: {
    all: () => request<BadgesView>("/api/v1/badges"),
  },
};

export { refreshSession, REFRESH_TOKEN_KEY, API_URL };
