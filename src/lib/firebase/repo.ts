import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, increment, limit, orderBy, query,
  serverTimestamp, setDoc, updateDoc, writeBatch, type DocumentData, type DocumentSnapshot, type Timestamp,
} from "firebase/firestore";
import { LIMITS } from "@/config/app";
import { chunk, type ImportRow } from "@/lib/import/parse";
import { normalizeEnglish, normalizeTurkish } from "@/lib/text/normalize";
import type { CardDoc, ClassDoc } from "@/types";
import { getDb } from "./client";
import type { CardInput, ClassInput } from "@/lib/validation/schemas";

const classesCol = (uid: string) => collection(getDb(), "users", uid, "classes");
const classRef = (uid: string, id: string) => doc(getDb(), "users", uid, "classes", id);
const cardsCol = (uid: string, classId: string) => collection(getDb(), "users", uid, "classes", classId, "cards");
const cardRef = (uid: string, classId: string, id: string) => doc(getDb(), "users", uid, "classes", classId, "cards", id);
const date = (t: unknown) => (t && typeof (t as Timestamp).toDate === "function" ? (t as Timestamp).toDate() : null);

function toClass(d: DocumentSnapshot<DocumentData>): ClassDoc {
  const x = d.data() ?? {};
  return { id: d.id, name: x.name ?? "", description: x.description ?? "", cardCount: x.cardCount ?? 0,
    createdAt: date(x.createdAt), lastStudiedAt: date(x.lastStudiedAt) };
}
function toCard(d: DocumentSnapshot<DocumentData>, classId: string): CardDoc {
  const x = d.data() ?? {};
  const p = (x.learningProgress ?? {}) as Record<string, unknown>;
  return {
    id: d.id, classId, englishText: x.englishText ?? "", turkishMeaning: x.turkishMeaning ?? "", createdAt: date(x.createdAt),
    level: typeof p.level === "number" ? p.level : 0, nextReviewAt: date(p.nextReviewAt),
    completedSessions: typeof p.completedSessions === "number" ? p.completedSessions : 0,
  };
}

export async function listClasses(uid: string): Promise<ClassDoc[]> {
  const snap = await getDocs(query(classesCol(uid), orderBy("createdAt", "desc")));
  return snap.docs.map(toClass);
}
export async function getClass(uid: string, id: string): Promise<ClassDoc | null> {
  const snap = await getDoc(classRef(uid, id));
  return snap.exists() ? toClass(snap) : null;
}
export async function createClass(uid: string, input: ClassInput): Promise<string> {
  const ref = doc(classesCol(uid));
  await setDoc(ref, { name: input.name, description: input.description, ownerId: uid, cardCount: 0,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}
export const updateClass = (uid: string, id: string, input: ClassInput) =>
  updateDoc(classRef(uid, id), { name: input.name, description: input.description, updatedAt: serverTimestamp() });

/** Deletes cards in Firestore-safe batches, then the class. Calls onProgress with the number of cards removed. */
export async function deleteClass(uid: string, id: string, onProgress?: (deleted: number) => void) {
  let deleted = 0;
  for (;;) {
    const snap = await getDocs(query(cardsCol(uid, id), limit(LIMITS.batchSize)));
    if (snap.empty) break;
    const batch = writeBatch(getDb());
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    onProgress?.(deleted);
  }
  await deleteDoc(classRef(uid, id));
}

export async function listCards(uid: string, classId: string): Promise<CardDoc[]> {
  const snap = await getDocs(query(cardsCol(uid, classId), orderBy("createdAt", "asc")));
  return snap.docs.map((d) => toCard(d, classId));
}

export async function createCard(uid: string, classId: string, input: CardInput) {
  const batch = writeBatch(getDb());
  batch.set(doc(cardsCol(uid, classId)), {
    englishText: input.englishText, turkishMeaning: input.turkishMeaning, ownerId: uid, classId,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  batch.update(classRef(uid, classId), { cardCount: increment(1), updatedAt: serverTimestamp() });
  await batch.commit();
}

/** Study history is kept unless the text materially changed (normalized forms differ), then it is reset. */
export async function updateCard(uid: string, classId: string, prev: CardDoc, input: CardInput) {
  const changed =
    normalizeEnglish(prev.englishText) !== normalizeEnglish(input.englishText) ||
    normalizeTurkish(prev.turkishMeaning) !== normalizeTurkish(input.turkishMeaning);
  await updateDoc(cardRef(uid, classId, prev.id), {
    englishText: input.englishText, turkishMeaning: input.turkishMeaning, updatedAt: serverTimestamp(),
    ...(changed ? { learningProgress: deleteField() } : {}),
  });
}

export async function deleteCard(uid: string, classId: string, cardId: string) {
  const batch = writeBatch(getDb());
  batch.delete(cardRef(uid, classId, cardId));
  batch.update(classRef(uid, classId), { cardCount: increment(-1), updatedAt: serverTimestamp() });
  await batch.commit();
}

/** Writes valid rows in batches; cardCount is incremented per committed batch so it stays consistent on partial failure. */
export async function importCards(
  uid: string, classId: string, rows: Pick<ImportRow, "english" | "turkish">[],
  onProgress?: (done: number, total: number) => void,
) {
  let done = 0;
  for (const part of chunk(rows)) {
    const batch = writeBatch(getDb());
    for (const r of part) {
      batch.set(doc(cardsCol(uid, classId)), {
        englishText: r.english, turkishMeaning: r.turkish, ownerId: uid, classId,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    batch.update(classRef(uid, classId), { cardCount: increment(part.length), updatedAt: serverTimestamp() });
    await batch.commit();
    done += part.length;
    onProgress?.(done, rows.length);
  }
}

export function firestoreErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "permission-denied") return "You don't have permission to do that. Try signing in again.";
  if (code === "unavailable" || code === "failed-precondition") return "Can't reach the database. Check your connection and try again.";
  if (code === "not-found") return "That item no longer exists.";
  return "Something went wrong. Please try again.";
}
