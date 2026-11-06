import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { fetchMyAccount } from "@/api/account";
import { ApiError, apiFetch, startSessionKeepAlive } from "@/api/client";
import { clearQueryCache } from "@/hooks/queryCache";
import { tr } from "@/i18n/core";

import {
  clearSession,
  getSession,
  loadSession,
  mapAuthUser,
  onSessionUserChange,
  saveSession,
  updateSessionUser,
} from "./session";
import { DRIVER_ROLE, type AuthPayload, type AuthUser } from "./types";

export type { AuthUser } from "./types";
export { getAccessToken } from "./session";

type AuthValue = {
  user: AuthUser | null;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export const DRIVER_ONLY_MESSAGE = "Cette application est réservée aux chauffeurs.";

function isDriver(user: AuthUser | null | undefined): boolean {
  return !!user?.roles?.includes(DRIVER_ROLE);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  // Every session change (login, refresh, profile update, invalidation) updates the user.
  useEffect(() => onSessionUserChange(setUser), []);

  // Silent renewal of the access token while a driver is logged in (timer + app foreground).
  const loggedIn = !!user;
  useEffect(() => (loggedIn ? startSessionKeepAlive() : undefined), [loggedIn]);

  useEffect(() => {
    let active = true;
    (async () => {
      const restored = await loadSession();
      if (!active) return;
      if (restored && !isDriver(restored.user)) {
        await clearSession();
      } else if (restored) {
        setUser(restored.user);
        // Silent refresh of the profile; offline or failing calls keep the stored user.
        fetchMyAccount()
          .then((account) => {
            if (!account || !getSession()) return;
            const fresh = mapAuthUser(account);
            updateSessionUser({ ...fresh, roles: fresh.roles.length ? fresh.roles : restored.user.roles });
          })
          .catch(() => undefined);
      }
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await apiFetch<AuthPayload>("/api/v1/auth/login", {
      method: "POST",
      body: { identifier: identifier.trim(), password },
      auth: false,
    });
    if (!data?.accessToken || !data.user) {
      throw new ApiError(tr("Réponse inattendue du serveur."), 500);
    }
    const mapped = mapAuthUser(data.user);
    if (!isDriver(mapped)) {
      throw new ApiError(tr(DRIVER_ONLY_MESSAGE), 403, "DRIVER_ONLY");
    }
    await saveSession({ accessToken: data.accessToken, refreshToken: data.refreshToken ?? "", user: mapped });
  }, []);

  const logout = useCallback(async () => {
    const userId = getSession()?.user.id;
    await clearSession();
    await clearQueryCache(userId);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    updateSessionUser(patch);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, ready, login, logout, updateUser }),
    [user, ready, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
