import { describe, expect, it } from "vitest";
import { initialContext, studyReducer, toSnapshot, type StudyContext, type StudyEvent } from "@/lib/study/machine";

const run = (events: StudyEvent[], from: StudyContext = initialContext) => events.reduce(studyReducer, from);
const load = (ids = ["a", "b"]) => run([{ type: "LOADED", cardIds: ids }]);
const english = (score: number | null): StudyEvent[] => [{ type: "START_RECORDING" }, { type: "STOP_RECORDING" }, { type: "RESULT", score }];

describe("study machine", () => {
  it("errors on empty class", () => {
    expect(run([{ type: "LOADED", cardIds: [] }]).status).toBe("session_error");
  });
  it("unlocks Turkish only when English >= 80 (inclusive)", () => {
    expect(run(english(79), load()).status).toBe("english_failed");
    expect(run(english(80), load()).status).toBe("turkish_ready");
  });
  it("a failed English stage can retry and never records completion", () => {
    const c = run([...english(40), { type: "RETRY" }], load());
    expect(c.status).toBe("english_ready");
    expect(c.completedIds).toEqual([]);
  });
  it("invalid score fails the stage, is not counted, never passes", () => {
    const c = run(english(null), load());
    expect(c.status).toBe("english_failed");
    expect(c.attempts).toBe(0);
    expect(c.notice).toBeTruthy();
  });
  it("completes a card only after both stages pass", () => {
    const afterEn = run(english(95), load());
    expect(afterEn.completedIds).toEqual([]);
    const done = run(english(85), afterEn);
    expect(done.status).toBe("card_completed");
    expect(done.completedIds).toEqual(["a"]);
  });
  it("failed Turkish keeps the card active", () => {
    const c = run([...english(90), ...english(50)], load());
    expect(c.status).toBe("turkish_failed");
    expect(c.index).toBe(0);
    expect(c.completedIds).toEqual([]);
  });
  it("advances once; duplicate ADVANCE events are ignored", () => {
    const done = run([...english(90), ...english(90)], load());
    const once = studyReducer(done, { type: "ADVANCE", fromIndex: 0 });
    expect(once.index).toBe(1);
    expect(once.status).toBe("english_ready");
    expect(studyReducer(once, { type: "ADVANCE", fromIndex: 0 })).toBe(once);
  });
  it("cannot skip stages or advance from non-completed states", () => {
    const c = load();
    expect(studyReducer(c, { type: "ADVANCE", fromIndex: 0 })).toBe(c);
    expect(studyReducer(c, { type: "RESULT", score: 100 })).toBe(c);
  });
  it("ignores a second START_RECORDING while recording", () => {
    const rec = run([{ type: "START_RECORDING" }], load());
    expect(studyReducer(rec, { type: "START_RECORDING" })).toBe(rec);
  });
  it("completes a single-card session", () => {
    const c = run([...english(90), ...english(90), { type: "ADVANCE", fromIndex: 0 }], load(["only"]));
    expect(c.status).toBe("session_completed");
    expect(c.completedIds).toEqual(["only"]);
  });
  it("recovers a session into a safe ready state", () => {
    const mid = run([...english(90), ...english(90), { type: "ADVANCE", fromIndex: 0 }, ...english(90)], load());
    expect(mid.status).toBe("turkish_ready");
    const snap = toSnapshot(run([{ type: "START_RECORDING" }], mid)); // recording mid-turkish
    const restored = run([{ type: "LOADED", cardIds: ["a", "b"], resume: snap }]);
    expect(restored).toMatchObject({ status: "turkish_ready", index: 1, completedIds: ["a"] });
  });
  it("discards a stale snapshot when the card list changed", () => {
    const snap = { cardIds: ["x"], index: 0, completedIds: ["x"], stage: "turkish" as const };
    expect(run([{ type: "LOADED", cardIds: ["a", "b"], resume: snap }])).toMatchObject({ status: "english_ready", index: 0 });
  });

  it("skipping moves on without completing the card", () => {
    const c = studyReducer(load(), { type: "SKIP" });
    expect(c).toMatchObject({ index: 1, status: "english_ready", completedIds: [] });
  });
  it("can skip from a failed stage but not while recording or evaluating", () => {
    const failed = run(english(10), load());
    expect(studyReducer(failed, { type: "SKIP" }).index).toBe(1);
    const rec = run([{ type: "START_RECORDING" }], load());
    expect(studyReducer(rec, { type: "SKIP" })).toBe(rec);
    const evaluating = run([{ type: "START_RECORDING" }, { type: "STOP_RECORDING" }], load());
    expect(studyReducer(evaluating, { type: "SKIP" })).toBe(evaluating);
  });
  it("skipping the last card ends the session with nothing completed", () => {
    const c = studyReducer(load(["only"]), { type: "SKIP" });
    expect(c.status).toBe("session_completed");
    expect(c.completedIds).toEqual([]);
  });
  it("cannot skip a card that is already completed (no double advance)", () => {
    const done = run([...english(90), ...english(90)], load());
    expect(studyReducer(done, { type: "SKIP" })).toBe(done);
  });
});
