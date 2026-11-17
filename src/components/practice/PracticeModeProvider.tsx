"use client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getDb } from "@/lib/firebase/client";

const STORAGE_KEY = "lingua-no-pass-mark";

interface PracticeState { noPassMark: boolean; setNoPassMark: (on: boolean) => void }
const Ctx = createContext<PracticeState>({ noPassMark: false, setNoPassMark: () => {} });
export const usePracticeMode = () => useContext(Ctx);

function remember(on: boolean) {
  try { localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch { /* private mode: only remembered for this visit */ }
}

/** "Free practice": when on, no score blocks you from moving on. Remembered on this device and on the account. */
export function PracticeModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const [on, setOn] = useState(false);

  useEffect(() => {
    try { setOn(localStorage.getItem(STORAGE_KEY) === "1"); } catch { /* keep the default */ }
  }, []);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(getDb(), "users", uid))
      .then((snap) => {
        const saved = snap.data()?.noPassMark;
        if (!cancelled && typeof saved === "boolean") { setOn(saved); remember(saved); }
      })
      .catch(() => {}); // offline: keep this device's choice
    return () => { cancelled = true; };
  }, [uid]);

  const setNoPassMark = useCallback((value: boolean) => {
    setOn(value);
    remember(value);
    if (uid) setDoc(doc(getDb(), "users", uid), { noPassMark: value }, { merge: true }).catch(() => {});
  }, [uid]);

  const value = useMemo(() => ({ noPassMark: on, setNoPassMark }), [on, setNoPassMark]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
