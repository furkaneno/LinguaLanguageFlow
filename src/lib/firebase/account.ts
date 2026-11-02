import { deleteUser } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, limit, query, writeBatch, type CollectionReference } from "firebase/firestore";
import { LIMITS } from "@/config/app";
import { authErrorMessage, reauthenticate } from "./auth";
import { getDb } from "./client";
import { firestoreErrorMessage } from "./repo";

/** Deletes every document in a collection, in Firestore-safe batches. */
async function deleteAllIn(col: CollectionReference): Promise<void> {
  for (;;) {
    const snap = await getDocs(query(col, limit(LIMITS.batchSize)));
    if (snap.empty) return;
    const batch = writeBatch(getDb());
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

/**
 * Removes everything stored for a user: cards, classes, study sessions with their attempts, and the profile.
 * Order matters: children are removed before parents, and it must run while the user can still sign in to Firestore.
 * Attempt records can only be deleted once the updated security rules are published; until then they are skipped
 * (they stay private and unreachable) so the account can still be deleted.
 */
export async function deleteAllUserData(uid: string, report: (message: string) => void = () => {}): Promise<void> {
  const db = getDb();

  report("Deleting your classes and cards…");
  const classes = collection(db, "users", uid, "classes");
  for (;;) {
    const snap = await getDocs(query(classes, limit(25)));
    if (snap.empty) break;
    for (const c of snap.docs) {
      await deleteAllIn(collection(c.ref, "cards"));
      await deleteDoc(c.ref);
    }
  }

  report("Deleting your study history…");
  const sessions = collection(db, "users", uid, "studySessions");
  let attemptsLocked = false;
  for (;;) {
    const snap = await getDocs(query(sessions, limit(25)));
    if (snap.empty) break;
    for (const s of snap.docs) {
      if (!attemptsLocked) {
        try { await deleteAllIn(collection(s.ref, "attempts")); }
        catch (e) {
          if ((e as { code?: string }).code === "permission-denied") attemptsLocked = true; else throw e;
        }
      }
      await deleteDoc(s.ref);
    }
  }

  report("Deleting your profile…");
  await deleteDoc(doc(db, "users", uid));
}

/** The data is gone but the sign-in account could not be removed; trying again finishes the job. */
export class PartialDeletionError extends Error {
  constructor(readonly original: unknown) {
    super("Account data was deleted but the sign-in account could not be removed.");
    this.name = "PartialDeletionError";
  }
}

/** `beforeRemoval` runs right before the sign-in account is removed (which immediately signs the user out). */
export async function deleteAccount(
  currentPassword: string, report: (message: string) => void = () => {}, beforeRemoval: () => void = () => {},
): Promise<void> {
  report("Checking your password…");
  const user = await reauthenticate(currentPassword);
  await deleteAllUserData(user.uid, report);
  report("Removing your account…");
  beforeRemoval();
  try { await deleteUser(user); } catch (e) { throw new PartialDeletionError(e); }
}

export function accountErrorMessage(err: unknown): string {
  if (err instanceof PartialDeletionError) {
    return "Your data was deleted, but the sign-in account couldn't be removed yet. Enter your password and try again.";
  }
  const code = (err as { code?: string })?.code ?? "";
  if (code.startsWith("auth/")) return authErrorMessage(err, "password");
  return firestoreErrorMessage(err);
}
