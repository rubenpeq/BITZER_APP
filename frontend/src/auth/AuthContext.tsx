import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type FakeUser = {
  id: number;
  name: string;
  bitzer_id?: number | null;
  is_admin?: boolean;
};

// Key used in localStorage
const STORAGE_KEY = "bitzer_fake_user";

type AuthContextValue = {
  user: FakeUser | null;
  login: (user: FakeUser) => void;
  logout: () => void;
  setUser: (u: FakeUser | null) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<FakeUser | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as FakeUser) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }, [user]);

  const login = (u: FakeUser) => setUserState(u);
  const logout = () => setUserState(null);

  const value = useMemo(() => ({ user, login, logout, setUser: setUserState }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
