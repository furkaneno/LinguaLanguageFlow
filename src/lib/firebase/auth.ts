import {
  createUserWithEmailAndPassword, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, updatePassword, type User,
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

export type AuthContext = "signin" | "password";

export function authErrorMessage(err: unknown, context: AuthContext = "signin"): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return context === "password" ? "Your current password is incorrect." : "Email or password is incorrect.";
    case "auth/email-already-in-use": return "An account with this email already exists. Try signing in.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements": return "That password is too weak. Choose a longer, more varied one.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/too-many-requests": return "Too many attempts. Wait a moment and try again.";
    case "auth/network-request-failed": return "Can't reach the network. Check your connection and try again.";
    case "auth/requires-recent-login":
    case "auth/user-token-expired": return "For security, please sign out, sign in again and retry.";
    default: return err instanceof Error && err.message.startsWith("Firebase is not configured")
      ? err.message : "Something went wrong. Please try again.";
  }
}

/** Confirms the current password. Sensitive actions (changing the password, deleting the account) need a fresh sign-in. */
export async function reauthenticate(currentPassword: string): Promise<User> {
  const user = getFirebaseAuth().currentUser;
  if (!user || !user.email) throw Object.assign(new Error("Not signed in."), { code: "auth/requires-recent-login" });
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  return user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const user = await reauthenticate(currentPassword);
  await updatePassword(user, newPassword);
}
