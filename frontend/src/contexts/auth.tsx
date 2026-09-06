import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { AuthResponse, User } from '../api/auth/types';
import { logoutRequest } from '../api/auth/logout';
import { setTokenRefreshListener, setSessionExpiredListener } from '../api/client';

export type { User };

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setSession: (data: AuthResponse) => void;
  updateUser: (patch: Partial<User>) => void;
  // Updates just the access token — used after a silent refresh (see
  // `api/client.ts`'s response interceptor), which never touches `user`.
  setAccessToken: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'event-planner-auth';

function loadStored(): AuthResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthResponse) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const stored = loadStored();
  const [user, setUser] = useState<User | null>(stored?.user ?? null);
  const [token, setTokenState] = useState<string | null>(stored?.token ?? null);

  const setSession = useCallback((data: AuthResponse) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUser(data.user);
    setTokenState(data.token);
  }, []);

  // Reads the token back out of localStorage rather than closing over the
  // `token` state value, so this stays correct without needing `token` in
  // its dependency array.
  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      const stored = loadStored();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: next, token: stored?.token ?? '' }));
      return next;
    });
  }, []);

  const setAccessToken = useCallback((nextToken: string) => {
    setTokenState(nextToken);
    setUser((prevUser) => {
      if (prevUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: prevUser, token: nextToken }));
      }
      return prevUser;
    });
  }, []);

  // The axios response interceptor lives outside React (it can't call
  // `useAuth()`), so it reaches back in through this listener whenever it
  // silently refreshes the access token on a 401 — keeping every other API
  // call's `token` (read from this context) current instead of only fixing
  // up the one request that happened to trigger the refresh.
  useEffect(() => {
    setTokenRefreshListener(setAccessToken);
    return () => setTokenRefreshListener(null);
  }, [setAccessToken]);

  // Registered the same way as the token-refresh listener above, but for
  // the opposite outcome: `/auth/refresh` itself failed, so there's no
  // token to hand back — only a dead session to clear. Guarded on there
  // having been a stored session at all, so an anonymous visitor who
  // happens to trigger a 401 (e.g. hitting a stale bookmarked action)
  // never sees a "your session expired" toast for a session they never had.
  useEffect(() => {
    const handleSessionExpired = () => {
      const hadSession = loadStored() !== null;
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setTokenState(null);
      if (hadSession) {
        toast.error('Your session has expired. Please log in again.');
        navigate('/login', { replace: true });
      }
    };
    setSessionExpiredListener(handleSessionExpired);
    return () => setSessionExpiredListener(null);
  }, [navigate]);

  const logout = useCallback(() => {
    // Fire-and-forget: revoking server-side (bumping token_version) matters
    // for security, but clearing local state shouldn't wait on the network
    // call succeeding — the user expects to be logged out immediately.
    logoutRequest().catch(() => {});
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setTokenState(null);
    toast.success('Logged out');
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, setSession, updateUser, setAccessToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
