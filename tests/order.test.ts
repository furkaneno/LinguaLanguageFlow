import { describe, expect, it } from "vitest";
import { orderForSession, shuffle } from "@/lib/study/order";

const cards = [
  { id: "c3", number: 3 }, { id: "c1", number: 1 }, { id: "c4", number: 4 }, { id: "c2", number: 2 },
];
const ids = (xs: { id: string }[]) => xs.map((c) => c.id);

describe("session order", () => {
  it("sequential follows card numbers", () => {
    expect(ids(orderForSession(cards, "sequential"))).toEqual(["c1", "c2", "c3", "c4"]);
  });
  it("shuffle keeps every card exactly once and does not mutate the input", () => {
    const before = ids(cards);
    const out = orderForSession(cards, "shuffle", () => 0.3);
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
  it("handles a single card", () => {
    expect(ids(orderForSession([cards[0]!], "shuffle"))).toEqual(["c3"]);
  });
});

import { mainRun, resolveStartIndex } from "@/lib/study/order";

describe("saved place (continue where I left off)", () => {
  const ids = ["a", "b", "c", "d", "e"];
  it("starts at the beginning when nothing is saved", () => {
    expect(resolveStartIndex(ids, null)).toBe(0);
  });
  it("finds the saved card by id, even if earlier cards were deleted", () => {
    expect(resolveStartIndex(ids, { cardId: "d", index: 3 })).toBe(3);
    expect(resolveStartIndex(["b", "c", "d", "e"], { cardId: "d", index: 3 })).toBe(2);
  });
  it("falls back to the saved index when the card was deleted", () => {
    expect(resolveStartIndex(["a", "b", "d", "e"], { cardId: "c", index: 2 })).toBe(2);
  });
  it("goes back to the start when the saved place is past the end", () => {
    expect(resolveStartIndex(["a", "b"], { cardId: "zz", index: 9 })).toBe(0);
    expect(resolveStartIndex(ids, { cardId: null, index: -1 })).toBe(0);
  });
  it("the main run covers the whole list and begins at the saved place", () => {
    expect(mainRun(ids, { cardId: "c", index: 2 })).toEqual({ cardIds: ids, startIndex: 2, indexOffset: 0 });
  });
  it("only very large lists are windowed from the saved place", () => {
    expect(mainRun(ids, { cardId: "c", index: 2 }, 2)).toEqual({ cardIds: ["c", "d"], startIndex: 0, indexOffset: 2 });
  });
  it("sequential and shuffled runs never depend on the saved place", () => {
    const cards = ids.map((id, i) => ({ id, number: i + 1 }));
    expect(orderForSession(cards, "sequential").map((c) => c.id)).toEqual(ids);
  });
});

import { nextPlace } from "@/lib/study/order";

describe("what gets saved as your place", () => {
  const run = ["a", "b", "c"];
  it("points at the next card after finishing or skipping one", () => {
    expect(nextPlace(1, run, 0, 3)).toEqual({ cardId: "b", index: 1 });
    expect(nextPlace(2, run, 100, 200)).toEqual({ cardId: "c", index: 102 });
  });
  it("clears the place after the last card of the list", () => {
    expect(nextPlace(3, run, 0, 3)).toBe("finished");
  });
  it("keeps a place after the end of a window on a very large list", () => {
    expect(nextPlace(3, run, 0, 5000)).toEqual({ cardId: null, index: 3 });
  });
  it("a long walk: 185 cards in, practice runs elsewhere do not move the place", () => {
    const all = Array.from({ length: 240 }, (_, i) => `k${i + 1}`);
    let saved = nextPlace(185, all, 0, 240); // finished card #185 in the main run
    expect(saved).toEqual({ cardId: "k186", index: 185 });
    // A sequential or shuffled run saves nothing, so `saved` is untouched; the next main run resumes there.
    const run = mainRun(all, saved as { cardId: string | null; index: number });
    expect(run.cardIds[run.startIndex]).toBe("k186");
    saved = nextPlace(240, all, 0, 240);
    expect(saved).toBe("finished");
  });
});
