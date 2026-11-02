import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  store: new Set<string>(),
  batchSizes: [] as number[],
  denyAttempts: false,
  failClassesWith: null as { code: string } | null,
  currentUser: { uid: "u1", email: "me@example.com" } as { uid: string; email: string } | null,
  reauth: { reject: null as { code: string } | null },
  deleteUserImpl: { reject: null as { code: string } | null, storeSizeWhenCalled: -1 },
  calls: [] as string[],
}));

vi.mock("@/lib/firebase/client", () => ({
  getDb: () => ({ path: "" }),
  getFirebaseAuth: () => ({ get currentUser() { return h.currentUser; } }),
}));

vi.mock("firebase/auth", () => ({
  EmailAuthProvider: { credential: (email: string, password: string) => ({ email, password }) },
  reauthenticateWithCredential: async () => { h.calls.push("reauth"); if (h.reauth.reject) throw h.reauth.reject; },
  updatePassword: async () => { h.calls.push("updatePassword"); },
  deleteUser: async () => {
    h.calls.push("deleteUser");
    h.deleteUserImpl.storeSizeWhenCalled = [...h.store].filter((p) => p.startsWith("users/u1")).length;
    if (h.deleteUserImpl.reject) throw h.deleteUserImpl.reject;
  },
  createUserWithEmailAndPassword: vi.fn(), sendPasswordResetEmail: vi.fn(), signInWithEmailAndPassword: vi.fn(), signOut: vi.fn(),
}));

vi.mock("firebase/firestore", () => {
  type Ref = { path: string };
  const join = (parent: Ref, segs: string[]) => [parent.path, ...segs].filter(Boolean).join("/");
  const blocked = (path: string) => h.denyAttempts && path.includes("/attempts/");
  return {
    collection: (parent: Ref, ...segs: string[]) => ({ path: join(parent, segs) }),
    doc: (parent: Ref, ...segs: string[]) => ({ path: join(parent, segs) }),
    limit: (n: number) => ({ n }),
    query: (col: Ref, lim: { n: number }) => ({ ...col, n: lim.n }),
    getDocs: async (q: Ref & { n: number }) => {
      if (h.failClassesWith && q.path.endsWith("/classes")) throw h.failClassesWith;
      const depth = q.path.split("/").length + 1;
      const paths = [...h.store].filter((p) => p.startsWith(q.path + "/") && p.split("/").length === depth).sort().slice(0, q.n);
      const docs = paths.map((p) => ({ id: p.split("/").pop(), ref: { path: p } }));
      return { empty: docs.length === 0, size: docs.length, docs };
    },
    deleteDoc: async (ref: Ref) => { if (blocked(ref.path)) throw { code: "permission-denied" }; h.store.delete(ref.path); },
    writeBatch: () => {
      const ops: string[] = [];
      return {
        delete: (ref: Ref) => { ops.push(ref.path); },
        commit: async () => {
          if (ops.some(blocked)) throw { code: "permission-denied" };
          h.batchSizes.push(ops.length);
          ops.forEach((p) => h.store.delete(p));
        },
      };
    },
  };
});

import { accountErrorMessage, deleteAccount, deleteAllUserData, PartialDeletionError } from "@/lib/firebase/account";
import { authErrorMessage, changePassword } from "@/lib/firebase/auth";
import { changePasswordSchema, fieldErrors } from "@/lib/validation/schemas";

const mine = () => [...h.store].filter((p) => p === "users/u1" || p.startsWith("users/u1/"));
const theirs = () => [...h.store].filter((p) => p.startsWith("users/u2"));

function seed() {
  h.store.clear();
  const add = (...paths: string[]) => paths.forEach((p) => h.store.add(p));
  add("users/u1");
  for (let i = 0; i < 450; i++) add(`users/u1/classes/c1/cards/k${String(i).padStart(3, "0")}`);
  add("users/u1/classes/c1", "users/u1/classes/c2", "users/u1/classes/c2/cards/x1");
  add("users/u1/studySessions/s1", "users/u1/studySessions/s1/attempts/a1", "users/u1/studySessions/s1/attempts/a2", "users/u1/studySessions/s1/attempts/a3");
  add("users/u1/studySessions/s2");
  add("users/u2", "users/u2/classes/z1", "users/u2/classes/z1/cards/z", "users/u2/studySessions/q", "users/u2/studySessions/q/attempts/a");
}

beforeEach(() => {
  seed();
  h.batchSizes.length = 0; h.calls.length = 0;
  h.denyAttempts = false; h.failClassesWith = null; h.currentUser = { uid: "u1", email: "me@example.com" };
  h.reauth.reject = null; h.deleteUserImpl.reject = null; h.deleteUserImpl.storeSizeWhenCalled = -1;
});

describe("deleting all of a user's data", () => {
  it("removes every document of that user and nothing of anyone else", async () => {
    const before = theirs().length;
    await deleteAllUserData("u1");
    expect(mine()).toEqual([]);
    expect(theirs().length).toBe(before);
  });
  it("uses Firestore-safe batches (450 cards -> 400 + 50)", async () => {
    await deleteAllUserData("u1");
    expect(Math.max(...h.batchSizes)).toBeLessThanOrEqual(400);
    expect(h.batchSizes.filter((n) => n === 400)).toHaveLength(1);
    expect(h.batchSizes).toContain(50);
  });
  it("reports progress in order", async () => {
    const msgs: string[] = [];
    await deleteAllUserData("u1", (m) => msgs.push(m));
    expect(msgs).toEqual(["Deleting your classes and cards…", "Deleting your study history…", "Deleting your profile…"]);
  });
  it("still deletes everything else when the old rules forbid deleting attempts", async () => {
    h.denyAttempts = true;
    await deleteAllUserData("u1");
    expect(mine().length).toBe(3); // only the three attempt records may remain
    expect(mine().filter((p) => !p.includes("/attempts/"))).toEqual([]);
  });
  it("stops on any other failure instead of pretending it worked", async () => {
    h.failClassesWith = { code: "unavailable" };
    await expect(deleteAllUserData("u1")).rejects.toMatchObject({ code: "unavailable" });
    expect(mine().length).toBeGreaterThan(0);
  });
  it("is safe to run again on an already empty account", async () => {
    await deleteAllUserData("u1");
    await expect(deleteAllUserData("u1")).resolves.toBeUndefined();
  });
});

describe("deleting the account", () => {
  it("checks the password first, deletes the data, and removes the sign-in last", async () => {
    await deleteAccount("secret-pass");
    expect(h.calls).toEqual(["reauth", "deleteUser"]);
    expect(h.deleteUserImpl.storeSizeWhenCalled).toBe(0); // data was already gone when the account was removed
    expect(mine()).toEqual([]);
  });
  it("marks the account as deleted just before removing it, and not at all if the password is wrong", async () => {
    await deleteAccount("secret-pass", undefined, () => h.calls.push("flag"));
    expect(h.calls).toEqual(["reauth", "flag", "deleteUser"]);
    seed(); h.calls.length = 0; h.reauth.reject = { code: "auth/invalid-credential" };
    await deleteAccount("nope", undefined, () => h.calls.push("flag")).catch(() => {});
    expect(h.calls).toEqual(["reauth"]);
  });
  it("a wrong password deletes nothing", async () => {
    h.reauth.reject = { code: "auth/invalid-credential" };
    const before = mine().length;
    await expect(deleteAccount("nope")).rejects.toMatchObject({ code: "auth/invalid-credential" });
    expect(mine().length).toBe(before);
    expect(h.calls).toEqual(["reauth"]);
    expect(accountErrorMessage({ code: "auth/invalid-credential" })).toBe("Your current password is incorrect.");
  });
  it("if removing the sign-in fails, the data is gone and the user is told to retry", async () => {
    h.deleteUserImpl.reject = { code: "auth/network-request-failed" };
    const err = await deleteAccount("secret-pass").catch((e) => e);
    expect(err).toBeInstanceOf(PartialDeletionError);
    expect(accountErrorMessage(err)).toMatch(/try again/i);
    expect(mine()).toEqual([]);
    // the retry works and finishes the job
    h.deleteUserImpl.reject = null; h.calls.length = 0;
    await expect(deleteAccount("secret-pass")).resolves.toBeUndefined();
    expect(h.calls).toEqual(["reauth", "deleteUser"]);
  });
  it("refuses when nobody is signed in", async () => {
    h.currentUser = null;
    await expect(deleteAccount("x")).rejects.toMatchObject({ code: "auth/requires-recent-login" });
    expect(h.calls).toEqual([]);
  });
  it("maps database errors to readable text", () => {
    expect(accountErrorMessage({ code: "permission-denied" })).toMatch(/permission/i);
    expect(accountErrorMessage({ code: "unavailable" })).toMatch(/connection/i);
  });
});

describe("changing the password", () => {
  it("re-checks the current password, then updates", async () => {
    await changePassword("old-pass-1", "new-pass-123");
    expect(h.calls).toEqual(["reauth", "updatePassword"]);
  });
  it("does not update when the current password is wrong", async () => {
    h.reauth.reject = { code: "auth/wrong-password" };
    await expect(changePassword("bad", "new-pass-123")).rejects.toBeTruthy();
    expect(h.calls).toEqual(["reauth"]);
  });
  it("explains errors in this context", () => {
    expect(authErrorMessage({ code: "auth/invalid-credential" }, "password")).toBe("Your current password is incorrect.");
    expect(authErrorMessage({ code: "auth/invalid-credential" })).toBe("Email or password is incorrect.");
    expect(authErrorMessage({ code: "auth/weak-password" }, "password")).toMatch(/too weak/);
    expect(authErrorMessage({ code: "auth/password-does-not-meet-requirements" }, "password")).toMatch(/too weak/);
    expect(authErrorMessage({ code: "auth/requires-recent-login" }, "password")).toMatch(/sign in again/);
    expect(authErrorMessage({ code: "auth/too-many-requests" }, "password")).toMatch(/Too many/);
    expect(authErrorMessage({ code: "auth/network-request-failed" }, "password")).toMatch(/network/);
    expect(authErrorMessage(new Error("boom"), "password")).toBe("Something went wrong. Please try again.");
  });
  it("validates the form", () => {
    const ok = { current: "old-pass-1", next: "new-pass-123", confirm: "new-pass-123" };
    expect(fieldErrors(changePasswordSchema, ok)).toBeNull();
    expect(fieldErrors(changePasswordSchema, { ...ok, current: "" })).toHaveProperty("current");
    expect(fieldErrors(changePasswordSchema, { ...ok, next: "short", confirm: "short" })).toHaveProperty("next");
    expect(fieldErrors(changePasswordSchema, { ...ok, confirm: "different-1" })).toHaveProperty("confirm");
    expect(fieldErrors(changePasswordSchema, { current: "same-pass-1", next: "same-pass-1", confirm: "same-pass-1" })).toHaveProperty("next");
  });
});
