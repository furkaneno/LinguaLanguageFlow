import { describe, expect, it } from "vitest";
import { nextSchedule, orderCards } from "@/lib/study/schedule";

const now = new Date("2026-01-10T00:00:00Z");
describe("nextSchedule", () => {
  it("moves up on a clean pass (one attempt per stage)", () => {
    expect(nextSchedule(0, 2, now)).toMatchObject({ level: 1, intervalDays: 3 });
    expect(nextSchedule(0, 2, now).nextReviewAt.toISOString()).toBe("2026-01-13T00:00:00.000Z");
  });
  it("holds with a few retries, drops after many, and caps at the top level", () => {
    expect(nextSchedule(2, 4, now).level).toBe(2);
    expect(nextSchedule(2, 7, now).level).toBe(1);
    expect(nextSchedule(0, 9, now).level).toBe(0);
    expect(nextSchedule(5, 2, now)).toMatchObject({ level: 5, intervalDays: 60 });
  });
  it("holds when attempt data is incomplete", () => {
    expect(nextSchedule(3, 1, now).level).toBe(3);
  });
});
describe("orderCards", () => {
  it("puts new and due cards first, then the rest soonest-due first", () => {
    const d = (n: number) => new Date(now.getTime() + n * 86_400_000);
    const out = orderCards([
      { id: "later", nextReviewAt: d(5) }, { id: "new", nextReviewAt: null },
      { id: "soon", nextReviewAt: d(1) }, { id: "due", nextReviewAt: d(-2) },
    ], now);
    expect(out.map((c) => c.id)).toEqual(["new", "due", "soon", "later"]);
  });
});
