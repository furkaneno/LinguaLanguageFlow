import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserSynthesisProvider } from "@/lib/speech/browserSynthesis";
import { lexicalTurkishEvaluator, recognitionMatchAssessor } from "@/lib/speech/assessment";
import { WebSpeechRecognitionProvider, NO_RESPONSE_MS, STOP_GRACE_MS } from "@/lib/speech/webSpeechRecognition";
import { runAttempt, type Stage } from "@/lib/study/attempt";
import { initialContext, studyReducer, type StudyContext, type StudyEvent } from "@/lib/study/machine";

const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", platform: "iPhone", maxTouchPoints: 5 };

/** A stand-in for Safari's recognizer that can misbehave in the ways seen on a real iPhone. */
class SafariSR {
  static all: SafariSR[] = [];
  lang = ""; continuous = false; interimResults = false; maxAlternatives = 1;
  onresult: ((e: { results: unknown }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  [key: string]: unknown;
  aborted = false; stopped = false;
  /** how it reacts when stop() is called: "aborted" = reports error:aborted then end (heard nothing), "silent" = never ends */
  static onStop: "aborted" | "silent" | "end" = "aborted";
  constructor() { SafariSR.all.push(this); }
  start() {}
  stop() {
    this.stopped = true;
    if (SafariSR.onStop === "aborted") { this.onerror?.({ error: "aborted" }); this.onend?.(); }
    else if (SafariSR.onStop === "end") this.onend?.();
  }
  abort() { this.aborted = true; this.onerror?.({ error: "aborted" }); this.onend?.(); }
  event(name: string) { (this[`on${name}`] as (() => void) | undefined)?.(); }
  say(text: string) { this.onresult?.({ results: [[{ transcript: text, confidence: 0.9 }]] }); }
}
const cur = () => SafariSR.all[SafariSR.all.length - 1]!;

beforeEach(() => {
  vi.useFakeTimers(); SafariSR.all = []; SafariSR.onStop = "aborted";
  vi.stubGlobal("window", { SpeechRecognition: SafariSR, isSecureContext: true });
  vi.stubGlobal("navigator", IPHONE);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function session() {
  let ctx: StudyContext = studyReducer(initialContext, { type: "LOADED", cardIds: ["c1"] });
  const dispatch = (e: StudyEvent) => { ctx = studyReducer(ctx, e); };
  const provider = new WebSpeechRecognitionProvider();
  const attempt = (stage: Stage) => runAttempt(stage, {
    recognizer: provider, dispatch, lang: stage === "english" ? "en-US" : "tr-TR",
    assess: (alts) => (stage === "english" ? recognitionMatchAssessor.assess("point blank", alts) : lexicalTurkishEvaluator.evaluate("tam isabet", alts)),
  });
  return { get ctx() { return ctx; }, attempt, provider };
}
const recording = (c: StudyContext) => c.status === "english_recording" || c.status === "turkish_recording";

describe("the iPhone freeze: Safari ends a silent session with error:aborted", () => {
  it("is reported as 'nothing heard', not as a cancel", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen({ lang: "tr-TR", timeoutMs: 12000 });
    cur().event("audiostart");
    vi.advanceTimersByTime(NO_RESPONSE_MS + 10); // nothing heard: the app stops the session; Safari answers "aborted"
    await expect(done).resolves.toEqual({ ok: false, error: "no_speech" });
  });
  it("puts the screen back to ready with a message, so the button works again", async () => {
    const s = session();
    const run = s.attempt("turkish");
    cur().event("audiostart");
    vi.advanceTimersByTime(NO_RESPONSE_MS + 10);
    await run;
    expect(recording(s.ctx)).toBe(false);
    expect(s.ctx.status).toBe("english_ready");
    expect(s.ctx.notice).toMatch(/didn't hear anything/);
  });
  it("tapping stop on a silent recording also ends cleanly", async () => {
    const s = session();
    const run = s.attempt("english");
    cur().event("audiostart");
    s.provider.stop();
    await run;
    expect(recording(s.ctx)).toBe(false);
  });
  it("an abort we asked for is still a cancel (leaving the page)", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen({ lang: "en-US", timeoutMs: 12000 });
    p.abort();
    await expect(done).resolves.toEqual({ ok: false, error: "aborted" });
  });
  it("can record again right after a silent failure", async () => {
    const s = session();
    const first = s.attempt("english"); cur().event("audiostart"); vi.advanceTimersByTime(NO_RESPONSE_MS + 10); await first;
    const second = s.attempt("english"); cur().event("audiostart"); cur().say("point blank"); cur().onend?.();
    await expect(second).resolves.toMatchObject({ kind: "scored", passed: true });
    expect(s.ctx.status).toBe("turkish_ready");
  });
});

describe("a recording can never leave the screen stuck, whatever the engine does", () => {
  const behaviours: [string, (s: ReturnType<typeof session>, run: Promise<unknown>) => Promise<void>][] = [
    ["answers with a result", async (_s, run) => { cur().say("point blank"); cur().onend?.(); await run; }],
    ["stays silent and aborts itself", async (_s, run) => { cur().event("audiostart"); vi.advanceTimersByTime(NO_RESPONSE_MS + 10); await run; }],
    ["ignores stop() completely", async (_s, run) => { SafariSR.onStop = "silent"; vi.advanceTimersByTime(NO_RESPONSE_MS + STOP_GRACE_MS + 50); await run; }],
    ["fails with an error", async (_s, run) => { cur().onerror?.({ error: "not-allowed" }); cur().onend?.(); await run; }],
    ["fails with a network error", async (_s, run) => { cur().onerror?.({ error: "network" }); cur().onend?.(); await run; }],
    ["ends at once without anything", async (_s, run) => { cur().onend?.(); await run; }],
  ];
  it.each(behaviours)("when the engine %s", async (_name, act) => {
    const s = session();
    const run = s.attempt("english");
    expect(recording(s.ctx)).toBe(true);
    await act(s, run);
    expect(recording(s.ctx)).toBe(false);
  });
  it("survives 40 attempts in a row with mixed behaviour", async () => {
    const s = session();
    for (let i = 0; i < 40; i++) {
      SafariSR.onStop = i % 3 === 0 ? "silent" : "aborted";
      const run = s.attempt("english");
      if (i % 4 === 0) { cur().say("point blank"); cur().onend?.(); }
      else vi.advanceTimersByTime(NO_RESPONSE_MS + STOP_GRACE_MS + 50);
      await run;
      expect(recording(s.ctx)).toBe(false);
    }
  });
});

describe("a dead session is released", () => {
  it("aborts a session that never reported its end, so it cannot keep holding the microphone", async () => {
    SafariSR.onStop = "silent";
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen({ lang: "tr-TR", timeoutMs: 12000 });
    vi.advanceTimersByTime(NO_RESPONSE_MS + STOP_GRACE_MS + 50);
    await done;
    expect(cur().aborted).toBe(true);
  });
  it("does not abort a session that ended normally", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen({ lang: "en-US", timeoutMs: 12000 });
    cur().say("hello"); cur().onend?.();
    await done;
    expect(cur().aborted).toBe(false);
  });
});

describe("telling the user when to speak", () => {
  it("says 'starting' first and 'listening' only when Safari reports audio", () => {
    const phases: string[] = [];
    new WebSpeechRecognitionProvider().listen({ lang: "en-US", timeoutMs: 12000, onPhase: (p) => phases.push(p) });
    expect(phases).toEqual(["starting"]);
    cur().event("audiostart");
    cur().event("soundstart");
    expect(phases).toEqual(["starting", "listening"]);
  });
  it("does not stay on 'starting' if a browser never reports audio", () => {
    const phases: string[] = [];
    new WebSpeechRecognitionProvider().listen({ lang: "en-US", timeoutMs: 12000, onPhase: (p) => phases.push(p) });
    vi.advanceTimersByTime(2600);
    expect(phases).toEqual(["starting", "listening"]);
  });
});

describe("the speech synthesizer is left alone unless it is speaking", () => {
  const stubSynth = (state: { speaking: boolean; pending: boolean }) => {
    const cancel = vi.fn();
    vi.stubGlobal("window", { speechSynthesis: { ...state, cancel, getVoices: () => [] } });
    return cancel;
  };
  it("does not cancel when idle (cancelling an idle one can mute the iPhone microphone)", () => {
    const cancel = stubSynth({ speaking: false, pending: false });
    new BrowserSynthesisProvider().cancel();
    expect(cancel).not.toHaveBeenCalled();
  });
  it("cancels when it is speaking or has something queued", () => {
    const a = stubSynth({ speaking: true, pending: false });
    new BrowserSynthesisProvider().cancel();
    expect(a).toHaveBeenCalledTimes(1);
    const b = stubSynth({ speaking: false, pending: true });
    new BrowserSynthesisProvider().cancel();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
