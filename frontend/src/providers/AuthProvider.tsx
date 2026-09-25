import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Household } from '@/types';
import { ApiError, getToken, removeToken } from '@/api/client';
import * as authApi from '@/api/auth';

// A transient /me failure (aborted request, network hiccup, 5xx) must not sign
// the user out. Retry a couple of times before giving up; only a 401 means the
// stored token is actually invalid.
const ME_RETRY_DELAYS_MS = [300, 900];

async function fetchMeWithRetry(): Promise<{ user: User }> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await authApi.getMe();
    } catch (err) {
      const isUnauthorized = err instanceof ApiError && err.status === 401;
      if (isUnauthorized || attempt >= ME_RETRY_DELAYS_MS.length) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, ME_RETRY_DELAYS_MS[attempt]));
    }
  }
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  currentHousehold: Household | null;
  setCurrentHousehold: (household: Household | null) => void;
  login: (input: authApi.LoginInput) => Promise<void>;
  register: (input: authApi.RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<User | null>(null);
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Theme management
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('rotless_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch {
      // Ignore
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('rotless_theme', theme);
    } catch {
      // Ignore
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const refreshMe = useCallback(async () => {
    const currentToken = getToken();
    if (!currentToken) {
      setUser(null);
      setCurrentHousehold(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetchMeWithRetry();
      setUser(res.user);
      if (res.user.households && res.user.households.length > 0) {
        setCurrentHousehold((prev) => {
          if (prev && res.user.households!.some((h) => h.id === prev.id)) {
            return res.user.households!.find((h) => h.id === prev.id) || res.user.households![0];
          }
          return res.user.households![0];
        });
      }
    } catch (err) {
      // Only an explicit 401 invalidates the session. A transient failure must
      // keep the stored token so a quick page reload does not sign the user out.
      if (err instanceof ApiError && err.status === 401) {
        removeToken();
        setTokenState(null);
        setUser(null);
        setCurrentHousehold(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const login = async (input: authApi.LoginInput) => {
    setIsSubmitting(true);
    try {
      const data = await authApi.login(input);
      setTokenState(data.token);
      setUser(data.user);
      // Fetch households and full profile
      await refreshMe();
    } finally {
      setIsSubmitting(false);
    }
  };

  const register = async (input: authApi.RegisterInput) => {
    setIsSubmitting(true);
    try {
      const data = await authApi.register(input);
      setTokenState(data.token);
      setUser(data.user);
      if (data.user.households && data.user.households.length > 0) {
        setCurrentHousehold(data.user.households[0]);
      }
      await refreshMe();
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setTokenState(null);
      setUser(null);
      setCurrentHousehold(null);
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    isSubmitting,
    currentHousehold,
    setCurrentHousehold,
    login,
    register,
    logout,
    refreshMe,
    theme,
    toggleTheme,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
