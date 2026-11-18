import { describe, expect, it } from "vitest";
import { SPEECH } from "@/config/app";
import { advanceDelay } from "@/lib/study/timing";

describe("time before the next card", () => {
  it("is short in normal mode, whatever the answer length", () => {
    expect(advanceDelay(false, 0)).toBe(SPEECH.advanceDelayMs);
    expect(advanceDelay(false, 500)).toBe(SPEECH.advanceDelayMs);
  });
  it("gives free practice at least the base reading time", () => {
    expect(advanceDelay(true, 0)).toBe(SPEECH.advanceDelayFreeMs);
    expect(advanceDelay(true, 5)).toBeGreaterThan(SPEECH.advanceDelayFreeMs);
  });
  it("grows with the length of the answer, up to a limit", () => {
    expect(advanceDelay(true, 40)).toBeLessThan(advanceDelay(true, 120));
    expect(advanceDelay(true, 100000)).toBe(SPEECH.advanceFreeMaxMs);
    expect(advanceDelay(true, -5)).toBe(SPEECH.advanceDelayFreeMs);
  });
  it("lets a short word be read quickly and a long interview answer be read fully", () => {
    expect(advanceDelay(true, 8)).toBeLessThan(4000);
    expect(advanceDelay(true, 200)).toBeGreaterThan(10000);
  });
});
