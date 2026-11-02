import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { speechErrorMessage } from "@/lib/speech/messages";
import { isIOS } from "@/lib/speech/platform";
import { MAX_CHAINED_SESSIONS, SHORT_QUIET_MS, WebSpeechRecognitionProvider } from "@/lib/speech/webSpeechRecognition";

const DESKTOP = { userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/120", platform: "Win32", maxTouchPoints: 0 };
const IPHONE = { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1", platform: "iPhone", maxTouchPoints: 5 };
const IPAD = { userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5 };

class FakeSR {
  static instances: FakeSR[] = [];
  lang = ""; continuous = false; interimResults = false; maxAlternatives = 1;
  onresult: ((e: { results: unknown }) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false; stopped = false; aborted = false;
  constructor() { FakeSR.instances.push(this); }
  start() { this.started = true; }
  stop() { this.stopped = true; this.onend?.(); }
  abort() { this.aborted = true; this.onerror?.({ error: "aborted" }); this.onend?.(); }
  /** Each argument is one spoken segment, given as its list of alternative transcripts. */
  say(...segments: string[][]) { this.onresult?.({ results: segments.map((alts) => alts.map((transcript) => ({ transcript, confidence: 0.9 }))) }); }
  fail(error: string) { this.onerror?.({ error }); }
  end() { this.onend?.(); }
}
const last = () => FakeSR.instances[FakeSR.instances.length - 1]!;

function setup(nav = DESKTOP, secure = true) {
  FakeSR.instances = [];
  vi.stubGlobal("window", { SpeechRecognition: FakeSR, isSecureContext: secure });
  vi.stubGlobal("navigator", nav);
}
beforeEach(() => { vi.useFakeTimers(); setup(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

const opts = { lang: "en-US", timeoutMs: 12000 };

describe("short cards", () => {
  it("returns the recognizer's alternatives and asks for interim results", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen(opts);
    const rec = last();
    expect(rec).toMatchObject({ started: true, lang: "en-US", interimResults: true, continuous: false });
    rec.say(["hello world", "hollow world"]); rec.end();
    await expect(done).resolves.toMatchObject({ ok: true, alternatives: ["hello world", "hollow world"] });
  });
  it("uses interim text when the browser never sends a final result (the iPhone case)", async () => {
    const done = new WebSpeechRecognitionProvider().listen(opts);
    last().say(["good morning"]); last().end();
    await expect(done).resolves.toMatchObject({ ok: true, alternatives: ["good morning"] });
  });
  it("keeps the newest text as it grows", async () => {
    const done = new WebSpeechRecognitionProvider().listen(opts);
    last().say(["good"]); last().say(["good morning"]); last().say(["good morning everyone"]); last().end();
    await expect(done).resolves.toMatchObject({ alternatives: ["good morning everyone"] });
  });
  it("reports silence", async () => {
    const done = new WebSpeechRecognitionProvider().listen(opts);
    last().end();
    await expect(done).resolves.toEqual({ ok: false, error: "no_speech" });
  });
  it("maps browser errors", async () => {
    for (const [browser, ours] of [["not-allowed", "permission_denied"], ["service-not-allowed", "permission_denied"], ["audio-capture", "no_microphone"], ["no-speech", "no_speech"], ["network", "network"], ["weird", "unknown"]]) {
      setup();
      const done = new WebSpeechRecognitionProvider().listen(opts);
      last().fail(browser!); last().end();
      await expect(done).resolves.toEqual({ ok: false, error: ours });
    }
  });
  it("ends on its own a moment after the last words if the browser keeps listening", async () => {
    const done = new WebSpeechRecognitionProvider().listen(opts);
    last().say(["hello"]);
    await vi.advanceTimersByTimeAsync(SHORT_QUIET_MS + 10);
    expect(last().stopped).toBe(true);
    await expect(done).resolves.toMatchObject({ ok: true, alternatives: ["hello"] });
  });
  it("gives up at the overall time limit", async () => {
    const done = new WebSpeechRecognitionProvider().listen({ ...opts, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1001);
    await expect(done).resolves.toEqual({ ok: false, error: "no_speech" });
  });
  it("streams what it hears to the screen", async () => {
    const seen: string[] = [];
    const done = new WebSpeechRecognitionProvider().listen({ ...opts, onInterim: (t) => seen.push(t) });
    last().say(["good"]); last().say(["good morning"]); last().end();
    await done;
    expect(seen).toEqual(["good", "good morning"]);
  });
  it("tapping stop uses what was heard so far", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen(opts);
    last().say(["almost there"]);
    p.stop();
    await expect(done).resolves.toMatchObject({ alternatives: ["almost there"] });
  });
  it("abort discards the capture", async () => {
    const p = new WebSpeechRecognitionProvider();
    const done = p.listen(opts);
    last().say(["ignored"]);
    p.abort();
    await expect(done).resolves.toEqual({ ok: false, error: "aborted" });
  });
});

describe("guards", () => {
  it("refuses a second capture while one is running", async () => {
    const p = new WebSpeechRecognitionProvider();
    const first = p.listen(opts);
    await expect(p.listen(opts)).resolves.toEqual({ ok: false, error: "busy" });
    last().end(); await first;
    const again = p.listen(opts); last().end();
    await expect(again).resolves.toEqual({ ok: false, error: "no_speech" });
  });
  it("needs a secure connection and a supporting browser", async () => {
    setup(DESKTOP, false);
    await expect(new WebSpeechRecognitionProvider().listen(opts)).resolves.toEqual({ ok: false, error: "insecure_context" });
    vi.stubGlobal("window", { isSecureContext: true });
    const p = new WebSpeechRecognitionProvider();
    expect(p.isSupported()).toBe(false);
    await expect(p.listen(opts)).resolves.toEqual({ ok: false, error: "unsupported" });
  });
  it("also finds the prefixed constructor Safari uses", () => {
    vi.stubGlobal("window", { webkitSpeechRecognition: FakeSR, isSecureContext: true });
    expect(new WebSpeechRecognitionProvider().isSupported()).toBe(true);
  });
});

describe("long answers", () => {
  const long = { ...opts, timeoutMs: 90000, longForm: true, silenceMs: 3500 };

  it("desktop and Android keep one continuous session and join the segments", async () => {
    const done = new WebSpeechRecognitionProvider().listen(long);
    expect(last().continuous).toBe(true);
    last().say(["because I enjoy helping people"], ["and I stay calm under pressure"]);
    await vi.advanceTimersByTimeAsync(3510);
    await expect(done).resolves.toMatchObject({ alternatives: ["because I enjoy helping people and I stay calm under pressure"] });
    expect(FakeSR.instances).toHaveLength(1);
  });

  describe("on iPhone", () => {
    beforeEach(() => setup(IPHONE));

    it("avoids continuous mode", () => {
      void new WebSpeechRecognitionProvider().listen(long);
      expect(last().continuous).toBe(false);
    });
    it("keeps listening across pauses by chaining sessions, then joins what was said", async () => {
      const done = new WebSpeechRecognitionProvider().listen(long);
      last().say(["hello world"]); last().end();                 // iOS ended the session on a pause
      expect(FakeSR.instances).toHaveLength(2);                   // a new session started
      last().say(["how are you"]); last().end();
      expect(FakeSR.instances).toHaveLength(3);
      await vi.advanceTimersByTimeAsync(3510);                    // the user is done
      await expect(done).resolves.toMatchObject({ ok: true, alternatives: ["hello world how are you"] });
    });
    it("tapping stop ends the chain without restarting", async () => {
      const p = new WebSpeechRecognitionProvider();
      const done = p.listen(long);
      last().say(["first part"]); last().end();
      last().say(["second part"]);
      p.stop();
      await expect(done).resolves.toMatchObject({ alternatives: ["first part second part"] });
      expect(FakeSR.instances).toHaveLength(2);
    });
    it("a silent follow-up session finishes with what was already captured", async () => {
      const done = new WebSpeechRecognitionProvider().listen(long);
      last().say(["only this"]); last().end();
      last().fail("no-speech"); last().end();
      await expect(done).resolves.toMatchObject({ ok: true, alternatives: ["only this"] });
    });
    it("an error in the first session is reported, not hidden", async () => {
      const done = new WebSpeechRecognitionProvider().listen(long);
      last().fail("service-not-allowed"); last().end();
      await expect(done).resolves.toEqual({ ok: false, error: "permission_denied" });
    });
    it("stops chaining after a safe number of sessions", async () => {
      const done = new WebSpeechRecognitionProvider().listen(long);
      for (let i = 0; i < MAX_CHAINED_SESSIONS + 3 && FakeSR.instances.length <= MAX_CHAINED_SESSIONS; i++) { last().say([`part ${i}`]); last().end(); }
      await done;
      expect(FakeSR.instances.length).toBe(MAX_CHAINED_SESSIONS);
    });
    it("short cards are not chained", async () => {
      const done = new WebSpeechRecognitionProvider().listen(opts);
      last().say(["hello"]); last().end();
      await expect(done).resolves.toMatchObject({ alternatives: ["hello"] });
      expect(FakeSR.instances).toHaveLength(1);
    });
  });
});

describe("platform and messages", () => {
  it("detects iPhone and iPad but not desktop or Android", () => {
    vi.stubGlobal("navigator", IPHONE); expect(isIOS()).toBe(true);
    vi.stubGlobal("navigator", IPAD); expect(isIOS()).toBe(true);
    vi.stubGlobal("navigator", DESKTOP); expect(isIOS()).toBe(false);
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile", platform: "Linux armv8l", maxTouchPoints: 5 });
    expect(isIOS()).toBe(false);
  });
  it("adds iPhone-specific setup help only on iPhone", () => {
    expect(speechErrorMessage("permission_denied", true)).toMatch(/Enable Dictation/);
    expect(speechErrorMessage("permission_denied", false)).not.toMatch(/Dictation/);
    expect(speechErrorMessage("no_speech", true)).toMatch(/Dictation/);
    expect(speechErrorMessage("no_speech")).not.toMatch(/Dictation/);
    expect(speechErrorMessage("unsupported", true)).toMatch(/Safari/);
  });
});
