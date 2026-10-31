import { doc, getDoc, setDoc } from "firebase/firestore";
import { DEFAULT_LANGUAGES, isLangCode, type ClassLanguages } from "@/lib/languages";
import { getDb } from "./client";

// Stored on the account (users/{uid}.classLanguages.{classId}), which the existing security rules already limit to its owner.
const userRef = (uid: string) => doc(getDb(), "users", uid);

function parse(raw: unknown): ClassLanguages {
  const r = raw as { front?: unknown; back?: unknown } | undefined;
  return { front: isLangCode(r?.front) ? r.front : DEFAULT_LANGUAGES.front, back: isLangCode(r?.back) ? r.back : DEFAULT_LANGUAGES.back };
}

/** Classes without a saved choice behave as before: English front, Turkish back. */
export async function getAllClassLanguages(uid: string): Promise<Record<string, ClassLanguages>> {
  const snap = await getDoc(userRef(uid));
  const all = (snap.data()?.classLanguages ?? {}) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(all).map(([id, v]) => [id, parse(v)]));
}

export async function getClassLanguages(uid: string, classId: string): Promise<ClassLanguages> {
  return (await getAllClassLanguages(uid))[classId] ?? DEFAULT_LANGUAGES;
}

export const saveClassLanguages = (uid: string, classId: string, l: ClassLanguages) =>
  setDoc(userRef(uid), { classLanguages: { [classId]: { front: l.front, back: l.back } } }, { merge: true });
