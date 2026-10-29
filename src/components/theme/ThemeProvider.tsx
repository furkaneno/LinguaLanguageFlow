"use client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getDb } from "@/lib/firebase/client";
import { DEFAULT_THEME, PALETTES, THEME_STORAGE_KEY, isThemeId, type ThemeId } from "@/lib/theme";

interface ThemeState { theme: ThemeId; setTheme: (t: ThemeId) => void }
const Ctx = createContext<ThemeState>({ theme: DEFAULT_THEME, setTheme: () => {} });
export const useTheme = () => useContext(Ctx);

function apply(t: ThemeId) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", PALETTES[t].bg);
  try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch { /* private mode: the choice just isn't remembered on this device */ }
}

/** Applies the theme instantly, remembers it on this device, and (when signed in) on the account for other devices. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  useEffect(() => {
    const t = document.documentElement.dataset.theme; // set before paint by the inline script
    if (isThemeId(t)) setThemeState(t);
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(getDb(), "users", uid))
      .then((snap) => {
        const saved = snap.data()?.theme;
        if (!cancelled && isThemeId(saved)) { setThemeState(saved); apply(saved); }
      })
      .catch(() => {}); // offline or unavailable: keep this device's theme
    return () => { cancelled = true; };
  }, [uid]);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    apply(t);
    if (uid) setDoc(doc(getDb(), "users", uid), { theme: t }, { merge: true }).catch(() => {});
  }, [uid]);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
