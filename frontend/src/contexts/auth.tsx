import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { AuthResponse, User } from '../api/auth/types';

export type { User };

interface AuthContextValue {
  user: User | null;
  token: string | null;
  setSession: (data: AuthResponse) => void;
  updateUser: (patch: Partial<User>) => void;
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
  const stored = loadStored();
  const [user, setUser] = useState<User | null>(stored?.user ?? null);
  const [token, setToken] = useState<string | null>(stored?.token ?? null);

  const setSession = useCallback((data: AuthResponse) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUser(data.user);
    setToken(data.token);
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

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, setSession, updateUser, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
