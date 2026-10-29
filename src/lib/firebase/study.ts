import {
  addDoc, collection, deleteField, doc, getDoc, getDocs, increment, limit, query, serverTimestamp, setDoc, Timestamp, updateDoc, where,
} from "firebase/firestore";
import type { StudyPlace } from "@/lib/study/order";
import type { SessionDoc } from "@/types";
import { getDb } from "./client";

const sessionsCol = (uid: string) => collection(getDb(), "users", uid, "studySessions");
const sessionRef = (uid: string, id: string) => doc(getDb(), "users", uid, "studySessions", id);

export async function findActiveSession(uid: string, classId: string): Promise<SessionDoc | null> {
  const snap = await getDocs(query(sessionsCol(uid), where("classId", "==", classId), where("status", "==", "active"), limit(5)));
  const rows = snap.docs.map((d) => {
    const x = d.data();
    return { updated: (x.updatedAt as Timestamp | null)?.toMillis?.() ?? 0, doc: {
      id: d.id, classId: x.classId as string, cardIds: (x.cardIds ?? []) as string[], currentIndex: (x.currentIndex ?? 0) as number,
      currentStage: (x.currentStage === "turkish" ? "turkish" : "english") as "english" | "turkish",
      completedCardIds: (x.completedCardIds ?? []) as string[], attemptCount: (x.attemptCount ?? 0) as number, status: "active" as const,
    } };
  }).sort((a, b) => b.updated - a.updated);
  return rows[0]?.doc ?? null;
}

export async function createSession(uid: string, classId: string, cardIds: string[]): Promise<string> {
  const ref = doc(sessionsCol(uid));
  await setDoc(ref, {
    ownerId: uid, classId, cardIds, currentIndex: 0, currentStage: "english", completedCardIds: [],
    status: "active", attemptCount: 0, startedAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export interface SessionProgress {
  currentIndex: number; currentStage: "english" | "turkish"; completedCardIds: string[];
  attemptCount: number; status: "active" | "completed";
}
export const saveSessionProgress = (uid: string, id: string, p: SessionProgress) =>
  updateDoc(sessionRef(uid, id), { ...p, updatedAt: serverTimestamp(), ...(p.status === "completed" ? { completedAt: serverTimestamp() } : {}) });

export const abandonSession = (uid: string, id: string) =>
  updateDoc(sessionRef(uid, id), { status: "abandoned", updatedAt: serverTimestamp() });

export interface AttemptRecord {
  cardId: string; stage: "english" | "turkish"; recognizedText: string; score: number;
  scoreType: string; passed: boolean; provider: string;
}
/** One document per scored attempt. Audio is never stored; transcripts are capped at 500 chars. */
export const recordAttempt = (uid: string, sessionId: string, a: AttemptRecord) =>
  addDoc(collection(sessionRef(uid, sessionId), "attempts"), {
    ...a, recognizedText: a.recognizedText.slice(0, 500), createdAt: serverTimestamp(),
  });

export interface CardStats { englishAttempts: number; turkishAttempts: number; lastEnglishScore: number | null; lastTurkishScore: number | null }

/** Called once per card, only after both stages passed. Dotted paths keep lifetime counters intact. */
export async function recordCardCompletion(uid: string, classId: string, cardId: string, s: CardStats) {
  await updateDoc(doc(getDb(), "users", uid, "classes", classId, "cards", cardId), {
    "learningProgress.englishAttempts": increment(s.englishAttempts),
    "learningProgress.turkishAttempts": increment(s.turkishAttempts),
    "learningProgress.lastEnglishScore": s.lastEnglishScore,
    "learningProgress.lastTurkishScore": s.lastTurkishScore,
    "learningProgress.completedSessions": increment(1),
    "learningProgress.lastStudiedAt": serverTimestamp(),
  });
}

export const touchClassStudied = (uid: string, classId: string) =>
  updateDoc(doc(getDb(), "users", uid, "classes", classId), { lastStudiedAt: serverTimestamp() });

// The "continue where I left off" place lives in the user's profile document (users/{uid}.studyPlaces.{classId}),
// which the existing security rules already restrict to its owner.
const userRef = (uid: string) => doc(getDb(), "users", uid);

export async function getPlace(uid: string, classId: string): Promise<StudyPlace | null> {
  const snap = await getDoc(userRef(uid));
  const places = snap.data()?.studyPlaces as Record<string, { cardId?: unknown; index?: unknown }> | undefined;
  const raw = places?.[classId];
  if (!raw || typeof raw.index !== "number") return null;
  return { cardId: typeof raw.cardId === "string" ? raw.cardId : null, index: raw.index };
}

export const savePlace = (uid: string, classId: string, p: StudyPlace) =>
  setDoc(userRef(uid), { studyPlaces: { [classId]: { cardId: p.cardId, index: p.index, updatedAt: serverTimestamp() } } }, { merge: true });

export const clearPlace = (uid: string, classId: string) =>
  setDoc(userRef(uid), { studyPlaces: { [classId]: deleteField() } }, { merge: true });
