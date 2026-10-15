import {
  createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDb, getFirebaseAuth } from "./client";

export async function registerUser(email: string, password: string) {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
  try {
    await setDoc(doc(getDb(), "users", cred.user.uid), { email, createdAt: serverTimestamp() });
  } catch (e) {
    console.warn("Profile document could not be created; the account itself exists.", e);
  }
  return cred.user;
}
export const loginUser = (email: string, password: string) =>
  signInWithEmailAndPassword(getFirebaseAuth(), email, password);
export const logoutUser = () => signOut(getFirebaseAuth());
export const requestPasswordReset = (email: string) => sendPasswordResetEmail(getFirebaseAuth(), email);

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Email or password is incorrect.";
    case "auth/email-already-in-use": return "An account with this email already exists. Try signing in.";
    case "auth/weak-password": return "That password is too weak. Use at least 8 characters.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/too-many-requests": return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed": return "Can't reach the network. Check your connection and try again.";
    default: return err instanceof Error && err.message.startsWith("Firebase is not configured")
      ? err.message : "Something went wrong. Please try again.";
  }
}
