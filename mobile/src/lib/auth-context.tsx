import { createContext, use, useEffect, useState, type PropsWithChildren } from "react";
import { api, refreshSession, REFRESH_TOKEN_KEY } from "./api";
import { useStorageState, setStorageItemAsync } from "./storage";
import { tokenStore } from "./token-store";
import type { PublicUser, SubscriptionStatus } from "./types";

interface AuthContextValue {
  user: PublicUser | null;
  subscriptionStatus: SubscriptionStatus | null;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshSubscriptionStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useSession() {
  const value = use(AuthContext);
  if (!value) throw new Error("useSession must be used within a SessionProvider");
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isStorageLoading, storedRefreshToken], setStoredRefreshToken] = useStorageState(REFRESH_TOKEN_KEY);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  function clearSession() {
    tokenStore.setTokens(null);
    setStoredRefreshToken(null);
    setUser(null);
    setSubscriptionStatus(null);
  }

  // Let the fetch client sign the whole app out when a refresh attempt fails mid-session.
  useEffect(() => {
    tokenStore.setForceSignOutHandler(clearSession);
    return () => tokenStore.setForceSignOutHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On app launch, trade a stored refresh token for a fresh session.
  useEffect(() => {
    if (isStorageLoading) return;
    (async () => {
      if (!storedRefreshToken) {
        setIsBootstrapping(false);
        return;
      }
      tokenStore.setTokens({ accessToken: "", refreshToken: storedRefreshToken });
      if (!(await refreshSession())) {
        clearSession();
        setIsBootstrapping(false);
        return;
      }
      try {
        const me = await api.auth.me();
        setUser(me.user);
        setSubscriptionStatus(me.subscriptionStatus);
      } catch {
        clearSession();
      }
      setIsBootstrapping(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStorageLoading]);

  async function signIn(username: string, password: string) {
    const data = await api.auth.login({ username, password });
    tokenStore.setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    await setStorageItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
    setUser(data.user);
    const me = await api.auth.me();
    setSubscriptionStatus(me.subscriptionStatus);
  }

  async function signUp(username: string, password: string, email?: string) {
    const data = await api.auth.signup({ username, password, email });
    tokenStore.setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    await setStorageItemAsync(REFRESH_TOKEN_KEY, data.refreshToken);
    setUser(data.user);
    const me = await api.auth.me();
    setSubscriptionStatus(me.subscriptionStatus);
  }

  async function signOut() {
    const refreshToken = tokenStore.getRefreshToken();
    clearSession();
    if (refreshToken) {
      try {
        await api.auth.logout(refreshToken);
      } catch {
        // best-effort — the token is already discarded locally
      }
    }
  }

  async function refreshSubscriptionStatus() {
    const me = await api.auth.me();
    setSubscriptionStatus(me.subscriptionStatus);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        subscriptionStatus,
        isLoading: isStorageLoading || isBootstrapping,
        signIn,
        signUp,
        signOut,
        refreshSubscriptionStatus,
      }}>
      {children}
    </AuthContext.Provider>
  );
}
