import { describe, expect, it } from "vitest";
import { orderForSession, shuffle } from "@/lib/study/order";

const now = new Date("2026-01-10T00:00:00Z");
const day = (n: number) => new Date(now.getTime() + n * 86_400_000);
const cards = [
  { id: "c3", number: 3, nextReviewAt: day(5) },
  { id: "c1", number: 1, nextReviewAt: null },
  { id: "c4", number: 4, nextReviewAt: day(-1) },
  { id: "c2", number: 2, nextReviewAt: day(1) },
];
const ids = (xs: { id: string }[]) => xs.map((c) => c.id);

describe("session order", () => {
  it("sequential follows card numbers", () => {
    expect(ids(orderForSession(cards, "sequential", now))).toEqual(["c1", "c2", "c3", "c4"]);
  });
  it("shuffle keeps every card exactly once and does not mutate the input", () => {
    const before = ids(cards);
    const out = orderForSession(cards, "shuffle", now, () => 0.3);
    expect(ids(out).sort()).toEqual(["c1", "c2", "c3", "c4"]);
    expect(ids(cards)).toEqual(before);
  });
  it("shuffle is deterministic for a fixed random source and varies with it", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6], () => 0.1);
    const b = shuffle([1, 2, 3, 4, 5, 6], () => 0.1);
    const c = shuffle([1, 2, 3, 4, 5, 6], () => 0.9);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it("due-first puts new and overdue cards first, then soonest-due", () => {
    expect(ids(orderForSession(cards, "due_first", now))).toEqual(["c1", "c4", "c2", "c3"]);
  });
  it("handles a single card", () => {
    expect(ids(orderForSession([cards[0]!], "shuffle", now))).toEqual(["c3"]);
  });
});
