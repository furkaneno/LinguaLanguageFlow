import { describe, expect, it } from "vitest";
import { shouldReopen } from "@/components/ui/dialog";

describe("locked dialogs", () => {
  it("come back only while they are still meant to be open", () => {
    expect(shouldReopen(true, true)).toBe(true);    // someone pressed Esc during a task: keep it open
    expect(shouldReopen(true, false)).toBe(false);  // the task finished and the dialog was closed on purpose: stay closed
    expect(shouldReopen(false, true)).toBe(false);
    expect(shouldReopen(false, false)).toBe(false);
  });
});
