import { describe, expect, it, vi } from "vitest";
import { createGuard } from "@/lib/study/guard";
import { speechErrorMessage } from "@/lib/speech/messages";

describe("attempt guard", () => {
  it("lets the newest attempt act", () => {
    const g = createGuard();
    const t = g.begin();
    expect(g.isCurrent(t)).toBe(true);
  });
  it("silences an attempt that was given up on, even if it finishes later", () => {
    const g = createGuard();
    const dispatch = vi.fn();
    const stuck = g.begin();
    const act = (token: number) => { if (g.isCurrent(token)) dispatch("event"); };
    g.invalidate();                 // the safety net gave up on it
    act(stuck);                     // it wakes up and tries to change the screen
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("a new attempt is not affected by an old stuck one", () => {
    const g = createGuard();
    const old = g.begin();
    g.invalidate();
    const fresh = g.begin();
    expect(g.isCurrent(old)).toBe(false);
    expect(g.isCurrent(fresh)).toBe(true);
  });
  it("starting a second attempt also retires the first", () => {
    const g = createGuard();
    const first = g.begin();
    const second = g.begin();
    expect(g.isCurrent(first)).toBe(false);
    expect(g.isCurrent(second)).toBe(true);
  });
});

describe("the message when the microphone stops responding", () => {
  it("tells everyone to try again, and gives iPhone users the extra steps", () => {
    expect(speechErrorMessage("no_response")).toMatch(/try again/i);
    expect(speechErrorMessage("no_response")).not.toMatch(/iPhone/);
    expect(speechErrorMessage("no_response", true)).toMatch(/Dictation/);
    expect(speechErrorMessage("no_response", true)).toMatch(/reload/i);
  });
});
