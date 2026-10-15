import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-lingua", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const alice = () => env.authenticatedContext("alice").firestore();
const bob = () => env.authenticatedContext("bob").firestore();
const anon = () => env.unauthenticatedContext().firestore();
const ts = serverTimestamp();

const newClass = (ownerId = "alice") => ({ name: "Daily", description: "", ownerId, cardCount: 0, createdAt: ts, updatedAt: ts });
const newCard = (o: Record<string, unknown> = {}) =>
  ({ englishText: "hello", turkishMeaning: "merhaba", ownerId: "alice", classId: "c1", createdAt: ts, updatedAt: ts, ...o });
const newSession = (o: Record<string, unknown> = {}) =>
  ({ ownerId: "alice", classId: "c1", cardIds: ["a"], currentIndex: 0, currentStage: "english", completedCardIds: [],
    status: "active", attemptCount: 0, startedAt: ts, updatedAt: ts, ...o });

describe("ownership", () => {
  it("owner can create and read a class; others and anonymous users cannot", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/classes/c1"), newClass()));
    await assertSucceeds(getDoc(doc(alice(), "users/alice/classes/c1")));
    await assertFails(getDoc(doc(bob(), "users/alice/classes/c1")));
    await assertFails(getDoc(doc(anon(), "users/alice/classes/c1")));
    await assertFails(setDoc(doc(bob(), "users/alice/classes/c2"), newClass()));
  });
  it("cannot claim another user's ownership", async () => {
    await assertFails(setDoc(doc(alice(), "users/alice/classes/c1"), newClass("bob")));
  });
});

describe("cards", () => {
  beforeEach(async () => { await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "users/alice/classes/c1"), newClass()); }); });
  it("requires an existing parent class, matching owner and classId, and non-empty text", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/classes/c1/cards/k1"), newCard()));
    await assertFails(setDoc(doc(alice(), "users/alice/classes/nope/cards/k2"), newCard({ classId: "nope" })));
    await assertFails(setDoc(doc(alice(), "users/alice/classes/c1/cards/k3"), newCard({ ownerId: "bob" })));
    await assertFails(setDoc(doc(alice(), "users/alice/classes/c1/cards/k4"), newCard({ classId: "other" })));
    await assertFails(setDoc(doc(alice(), "users/alice/classes/c1/cards/k5"), newCard({ englishText: "" })));
    await assertFails(setDoc(doc(alice(), "users/alice/classes/c1/cards/k6"), newCard({ cardType: "word" })));
  });
  it("cannot reassign ownership", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/classes/c1/cards/k1"), newCard()));
    await assertFails(updateDoc(doc(alice(), "users/alice/classes/c1/cards/k1"), { ownerId: "bob" }));
    await assertSucceeds(updateDoc(doc(alice(), "users/alice/classes/c1/cards/k1"), { "learningProgress.level": 1 }));
  });
});

describe("study sessions", () => {
  it("validates status, stage and immutable fields", async () => {
    await assertSucceeds(setDoc(doc(alice(), "users/alice/studySessions/s1"), newSession()));
    await assertFails(setDoc(doc(alice(), "users/alice/studySessions/s2"), newSession({ status: "weird" })));
    await assertFails(setDoc(doc(alice(), "users/alice/studySessions/s3"), newSession({ currentStage: "quiz" })));
    await assertFails(setDoc(doc(alice(), "users/alice/studySessions/s4"), newSession({ ownerId: "bob" })));
    await assertFails(updateDoc(doc(alice(), "users/alice/studySessions/s1"), { cardIds: ["a", "b"] }));
    await assertSucceeds(updateDoc(doc(alice(), "users/alice/studySessions/s1"), { currentIndex: 1, status: "completed" }));
    await assertFails(getDoc(doc(bob(), "users/alice/studySessions/s1")));
  });
  it("attempts are create-only and must carry a numeric score", async () => {
    const a = { cardId: "a", stage: "english", recognizedText: "hi", score: 90, scoreType: "x", passed: true, provider: "p", createdAt: ts };
    await assertSucceeds(setDoc(doc(alice(), "users/alice/studySessions/s1/attempts/t1"), a));
    await assertFails(setDoc(doc(alice(), "users/alice/studySessions/s1/attempts/t2"), { ...a, score: null }));
    await assertFails(setDoc(doc(alice(), "users/alice/studySessions/s1/attempts/t3"), { ...a, score: 140 }));
    await assertFails(updateDoc(doc(alice(), "users/alice/studySessions/s1/attempts/t1"), { score: 100 }));
  });
});
