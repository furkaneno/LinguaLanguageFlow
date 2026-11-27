import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAttempt } from "@/lib/study/attempt";
import { WebSpeechRecognitionProvider } from "@/lib/speech/webSpeechRecognition";
import type { RecognitionResult, SpeechRecognitionProvider } from "@/lib/speech/types";
import type { StudyEvent } from "@/lib/study/machine";

const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", platform: "iPhone", maxTouchPoints: 5 };
const DESKTOP = { userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120", platform: "Win32", maxTouchPoints: 0 };

class FakeSR {
  static last: FakeSR;
  lang = ""; continuous = false; interimResults = false; maxAlternatives = 1;
  onresult: ((e: { results: unknown }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  [key: string]: unknown;
  constructor() { FakeSR.last = this; }
  start() {}
  stop() { (this.onend as (() => void))(); }
  abort() {}
}
const fire = (rec: FakeSR, name: string) => (rec[`on${name}`] as (() => void) | undefined)?.();

beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal("window", { SpeechRecognition: FakeSR, isSecureContext: true }); vi.stubGlobal("navigator", IPHONE); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("what the browser engine did, for finding out why a recording failed", () => {
  it("records the engine's events with timings", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen({ lang: "tr-TR", timeoutMs: 12000 });
    fire(FakeSR.last, "start"); vi.advanceTimersByTime(100); fire(FakeSR.last, "audiostart");
    vi.advanceTimersByTime(900); FakeSR.last.onerror?.({ error: "no-speech" }); FakeSR.last.onend?.();
    await done;
    expect(p.diagnostics()).toBe("listen tr-TR ios 0.0s › start 0.0s › audiostart 0.1s › error:no-speech 1.0s › end 1.0s");
  });
  it("notes a run of results once, not every time", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen({ lang: "en-US", timeoutMs: 12000 });
    for (const t of ["a", "a b", "a b c"]) FakeSR.last.onresult?.({ results: [[{ transcript: t, confidence: 0.9 }]] });
    FakeSR.last.onend?.();
    await done;
    expect(p.diagnostics().match(/result/g)).toHaveLength(1);
  });
  it("shows when the engine never answered and had to be forced", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen({ lang: "tr-TR", timeoutMs: 12000 });
    FakeSR.last.stop = () => {}; // an engine that ignores stop(), like a stalled Safari
    vi.advanceTimersByTime(7000 + 1500 + 10);
    await done;
    expect(p.diagnostics()).toMatch(/nothing heard, stopping.*stop.*no end event, forced/);
  });
  it("never grows without limit", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen({ lang: "en-US", timeoutMs: 12000 });
    for (let i = 0; i < 100; i++) fire(FakeSR.last, "soundstart");
    FakeSR.last.onend?.();
    await done;
    expect(p.diagnostics().split(" › ").length).toBeLessThanOrEqual(40);
  });
});

describe("showing the trace when a recording fails", () => {
  const failing = (trace: string): SpeechRecognitionProvider => ({
    id: "fake", isSupported: () => true, stop() {}, abort() {}, diagnostics: () => trace,
    listen: async (): Promise<RecognitionResult> => ({ ok: false, error: "no_speech" }),
  });
  const run = async (provider: SpeechRecognitionProvider) => {
    const events: StudyEvent[] = [];
    await runAttempt("turkish", { recognizer: provider, assess: () => ({ score: null } as never), dispatch: (e) => events.push(e), lang: "tr-TR" });
    return events.find((e) => e.type === "CANCEL_RECORDING") as { notice: string };
  };
  it("adds the details on iPhone", async () => {
    expect((await run(failing("listen tr-TR ios 0.0s › end 0.2s"))).notice).toMatch(/We didn't hear anything.*\(Details: listen tr-TR ios 0.0s › end 0.2s\)/);
  });
  it("keeps other devices' messages clean", async () => {
    vi.stubGlobal("navigator", DESKTOP);
    expect((await run(failing("listen tr-TR 0.0s"))).notice).not.toMatch(/Details/);
  });
  it("works with engines that have no trace", async () => {
    const plain = failing("");
    delete (plain as { diagnostics?: unknown }).diagnostics;
    expect((await run(plain)).notice).not.toMatch(/Details/);
  });
});
