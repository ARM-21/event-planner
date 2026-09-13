import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AuthResponse, User } from '../api/auth/types';
import { logoutRequest } from '../api/auth/logout';
import { setTokenRefreshListener, setSessionExpiredListener } from '../api/client';
import { ROUTES } from '../config/routes';

export type { User };

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setSession: (data: AuthResponse) => void;
  updateUser: (patch: Partial<User>) => void;
  // Updates just the access token after a silent refresh; never touches `user`.
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
  const queryClient = useQueryClient();
  const stored = loadStored();
  const [user, setUser] = useState<User | null>(stored?.user ?? null);
  const [token, setTokenState] = useState<string | null>(stored?.token ?? null);

  // Queries are cached for minutes, so drop them whenever the user changes,
  // otherwise the next user could see the previous one's private events.
  const setSession = useCallback((data: AuthResponse) => {
    queryClient.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUser(data.user);
    setTokenState(data.token);
  }, [queryClient]);

  // Reads the token from localStorage rather than closing over `token` state.
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

  // Bridges the axios interceptor (outside React) back into context after a silent refresh.
  useEffect(() => {
    setTokenRefreshListener(setAccessToken);
    return () => setTokenRefreshListener(null);
  }, [setAccessToken]);

  // Same bridge, for when `/auth/refresh` itself fails — guarded so an anonymous visitor never sees this toast.
  useEffect(() => {
    const handleSessionExpired = () => {
      const hadSession = loadStored() !== null;
      localStorage.removeItem(STORAGE_KEY);
      queryClient.clear();
      setUser(null);
      setTokenState(null);
      if (hadSession) {
        toast.error('Your session has expired. Please log in again.');
        navigate(ROUTES.LOGIN, { replace: true });
      }
    };
    setSessionExpiredListener(handleSessionExpired);
    return () => setSessionExpiredListener(null);
  }, [navigate, queryClient]);

  const logout = useCallback(() => {
    // Fire-and-forget — clearing local state shouldn't wait on the network call.
    logoutRequest().catch(() => {});
    localStorage.removeItem(STORAGE_KEY);
    queryClient.clear();
    setUser(null);
    setTokenState(null);
    toast.success('Logged out');
  }, [queryClient]);

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
