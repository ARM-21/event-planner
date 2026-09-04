import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { apiFetch } from './api';

export interface User {
  id: number;
  name: string;
  email: string;
}

interface AuthResponse {
  user: User;
  token: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
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

  function persist(data: AuthResponse | null) {
    if (data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setUser(data.user);
      setToken(data.token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
      setToken(null);
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });
    persist(data);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: { name, email, password } });
    persist(data);
  }, []);

  const logout = useCallback(() => persist(null), []);

  return <AuthContext.Provider value={{ user, token, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
