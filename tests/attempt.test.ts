import { describe, expect, it } from "vitest";
import { lexicalTurkishEvaluator, recognitionMatchAssessor } from "@/lib/speech/assessment";
import type { ListenOptions, RecognitionResult, SpeechRecognitionProvider } from "@/lib/speech/types";
import { runAttempt, type Stage } from "@/lib/study/attempt";
import { initialContext, studyReducer, type StudyContext, type StudyEvent } from "@/lib/study/machine";

const EN = "I paid the ultimate price for it.";
const TR = "Bedelini ağır ödedim.";

class MockRecognizer implements SpeechRecognitionProvider {
  readonly id = "mock";
  calls: ListenOptions[] = [];
  constructor(private queue: RecognitionResult[]) {}
  isSupported() { return true; }
  async listen(o: ListenOptions) { this.calls.push(o); return this.queue.shift() ?? { ok: false as const, error: "no_speech" as const }; }
  stop() {} abort() {}
}
const heard = (...alternatives: string[]): RecognitionResult => ({ ok: true, alternatives, confidence: 0.9, provider: "mock" });

function session(ids = ["c1", "c2"]) {
  let ctx: StudyContext = studyReducer(initialContext, { type: "LOADED", cardIds: ids });
  const events: StudyEvent[] = [];
  const dispatch = (e: StudyEvent) => { events.push(e); ctx = studyReducer(ctx, e); };
  const attempt = (stage: Stage, rec: MockRecognizer) =>
    runAttempt(stage, {
      recognizer: rec, dispatch,
      assess: (alts) => (stage === "english" ? recognitionMatchAssessor.assess(EN, alts) : lexicalTurkishEvaluator.evaluate(TR, alts)),
    });
  return { get ctx() { return ctx; }, attempt, events, dispatch };
}

describe("two-stage attempt flow with a mocked provider", () => {
  it("passing English unlocks Turkish without completing the card", async () => {
    const s = session();
    const out = await s.attempt("english", new MockRecognizer([heard("i paid the ultimate price for it")]));
    expect(out).toMatchObject({ kind: "scored", passed: true });
    expect(s.ctx.status).toBe("turkish_ready");
    expect(s.ctx.completedIds).toEqual([]);
  });

  it("uses the recognizer's best alternative", async () => {
    const s = session();
    const out = await s.attempt("english", new MockRecognizer([heard("eye payed the all tea mate prize", "I paid the ultimate price for it")]));
    expect(out).toMatchObject({ kind: "scored", passed: true });
  });

  it("failing English keeps the card on the English stage and allows a retry", async () => {
    const s = session();
    const out = await s.attempt("english", new MockRecognizer([heard("what a lovely day")]));
    expect(out).toMatchObject({ kind: "scored", passed: false });
    expect(s.ctx.status).toBe("english_failed");
    await s.attempt("english", new MockRecognizer([heard("i paid the ultimate price for it")]));
    expect(s.ctx.status).toBe("turkish_ready");
  });

  it("completes the card only after Turkish also passes, using the Turkish language", async () => {
    const s = session();
    await s.attempt("english", new MockRecognizer([heard(EN)]));
    const tr = new MockRecognizer([heard("bunun bedelini agir odedim")]);
    const out = await s.attempt("turkish", tr);
    expect(tr.calls[0]?.lang).toBe("tr-TR");
    expect(out).toMatchObject({ kind: "scored", stage: "turkish" });
    // "bunun" is an extra word: 3 of 4 tokens -> 75 -> not enough
    expect(s.ctx.status).toBe("turkish_failed");
    expect(s.ctx.completedIds).toEqual([]);
    await s.attempt("turkish", new MockRecognizer([heard("bedelini ağır ödedim")]));
    expect(s.ctx.status).toBe("card_completed");
    expect(s.ctx.completedIds).toEqual(["c1"]);
  });

  it("does not let a failed Turkish stage advance, even if English was perfect", async () => {
    const s = session();
    await s.attempt("english", new MockRecognizer([heard(EN)]));
    await s.attempt("turkish", new MockRecognizer([heard("tamamen alakasız bir cümle")]));
    s.dispatch({ type: "ADVANCE", fromIndex: 0 });
    expect(s.ctx.index).toBe(0);
    expect(s.ctx.status).toBe("turkish_failed");
  });

  it("recognition errors return to ready with a notice and count no attempt", async () => {
    const s = session();
    const out = await s.attempt("english", new MockRecognizer([{ ok: false, error: "permission_denied" }]));
    expect(out).toMatchObject({ kind: "error", error: "permission_denied" });
    expect(s.ctx.status).toBe("english_ready");
    expect(s.ctx.notice).toMatch(/blocked/i);
    expect(s.ctx.attempts).toBe(0);
  });

  it("silence is reported, never scored", async () => {
    const s = session();
    const out = await s.attempt("english", new MockRecognizer([{ ok: false, error: "no_speech" }]));
    expect(out.kind).toBe("error");
    expect(s.ctx.lastScore).toBeNull();
  });

  it("an unusable transcript fails the stage without a fabricated score", async () => {
    const s = session();
    const out = await s.attempt("english", new MockRecognizer([heard("   ")]));
    expect(out.kind).toBe("unscored");
    expect(s.ctx.status).toBe("english_failed");
    expect(s.ctx.attempts).toBe(0);
    expect(s.ctx.lastScore).toBeNull();
  });

  it("an aborted capture dispatches nothing after START", async () => {
    const s = session();
    const out = await s.attempt("english", new MockRecognizer([{ ok: false, error: "aborted" }]));
    expect(out.kind).toBe("cancelled");
    expect(s.events.map((e) => e.type)).toEqual(["START_RECORDING"]);
  });
});
