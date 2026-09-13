import type { TokenPair } from "./types";

// Plain module-level store so the fetch client (api.ts) can read/attach the current
// access token and trigger a refresh without depending on React context. The
// SessionProvider is the source of truth and keeps this in sync.
let accessToken: string | null = null;
let refreshToken: string | null = null;
let forceSignOutHandler: (() => void) | null = null;

export const tokenStore = {
  getAccessToken: () => accessToken,
  getRefreshToken: () => refreshToken,
  setTokens(tokens: TokenPair | null) {
    accessToken = tokens?.accessToken ?? null;
    refreshToken = tokens?.refreshToken ?? null;
  },
  setForceSignOutHandler(handler: (() => void) | null) {
    forceSignOutHandler = handler;
  },
  forceSignOut() {
    accessToken = null;
    refreshToken = null;
    forceSignOutHandler?.();
  },
};
