"use client";
import { onAuthStateChanged, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface AuthState { user: User | null; loading: boolean; configError: string | null }
const Ctx = createContext<AuthState>({ user: null, loading: true, configError: null });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, configError: null });
  useEffect(() => {
    try {
      return onAuthStateChanged(getFirebaseAuth(), (user) => setState({ user, loading: false, configError: null }));
    } catch (e) {
      setState({ user: null, loading: false, configError: e instanceof Error ? e.message : "Firebase is not configured." });
    }
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

/** Use inside protected pages; the (app) layout guarantees a user is present. */
export function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error("useUid used outside an authenticated route.");
  return user.uid;
}
