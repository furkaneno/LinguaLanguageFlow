import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CloudSpeechRecognitionProvider, NO_SPEECH_MS, RECORDER_GRACE_MS, SHORT_END_MS,
} from "@/lib/speech/cloudRecognition";

const level = { value: 0 };
const made: { recorders: FakeRecorder[]; contexts: FakeAudioCtx[]; track: { stop: ReturnType<typeof vi.fn> } } = {
  recorders: [], contexts: [], track: { stop: vi.fn() },
};

class FakeRecorder {
  static types = ["audio/mp4"];
  static silentStop = false;
  static bytes = 60;
  static isTypeSupported(t: string) { return FakeRecorder.types.includes(t); }
  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  constructor(public stream: unknown, opts?: { mimeType?: string }) { this.mimeType = opts?.mimeType ?? ""; made.recorders.push(this); }
  start() { this.state = "recording"; }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["x".repeat(FakeRecorder.bytes)], { type: this.mimeType }) });
    if (!FakeRecorder.silentStop) this.onstop?.();
  }
}
class FakeAudioCtx {
  resumed = false; closed = false;
  constructor() { made.contexts.push(this); }
  createAnalyser() {
    return { fftSize: 0, getByteTimeDomainData(buf: Uint8Array) { const amp = Math.round(level.value * 128); for (let i = 0; i < buf.length; i++) buf[i] = 128 + (i % 2 ? amp : -amp); } };
  }
  createMediaStreamSource() { return { connect() {} }; }
  resume() { this.resumed = true; return Promise.resolve(); }
  close() { this.closed = true; return Promise.resolve(); }
}

let fetchImpl: ReturnType<typeof vi.fn>;
let getUserMedia: ReturnType<typeof vi.fn>;
const make = (over: Record<string, unknown> = {}) => new CloudSpeechRecognitionProvider({
  getToken: async () => "tok", fetchImpl: fetchImpl as never, mediaDevices: { getUserMedia } as never,
  Recorder: FakeRecorder as never, AudioCtx: FakeAudioCtx as never, ...over,
});
const opts = { lang: "en-US", timeoutMs: 60000 };
const settle = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

async function speakThenStaySilent(done: Promise<unknown>, speakMs = 500, silenceMs = SHORT_END_MS + 200) {
  await settle(0);
  level.value = 0.1; await settle(speakMs);
  level.value = 0; await settle(silenceMs);
  return done;
}

beforeEach(() => {
  vi.useFakeTimers();
  level.value = 0; made.recorders.length = 0; made.contexts.length = 0; made.track = { stop: vi.fn() };
  FakeRecorder.silentStop = false; FakeRecorder.bytes = 60;
  fetchImpl = vi.fn(async () => new Response(JSON.stringify({ text: "hello" }), { status: 200 }));
  getUserMedia = vi.fn(async () => ({ getTracks: () => [made.track] }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("recording and transcribing", () => {
  it("records speech, stops on silence, uploads once, and returns the text", async () => {
    const done = make().listen(opts);
    const result = await speakThenStaySilent(done);
    expect(result).toEqual({ ok: true, alternatives: ["hello"], confidence: null, provider: "cloud-transcription" });
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    expect(made.recorders[0]!.mimeType).toBe("audio/mp4");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: FormData }];
    expect(url).toBe("/api/transcribe");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.body.get("lang")).toBe("en-US");
    expect((init.body.get("audio") as File).name).toBe("speech.m4a");
  });
  it("releases the microphone afterwards, on success and on failure", async () => {
    await speakThenStaySilent(make().listen(opts));
    expect(made.track.stop).toHaveBeenCalled();
    expect(made.contexts[0]!.closed).toBe(true);
  });
  it("creates the audio context before asking for the microphone (iOS needs the tap)", async () => {
    let contextsWhenAsked = -1;
    getUserMedia = vi.fn(async () => { contextsWhenAsked = made.contexts.length; return { getTracks: () => [made.track] }; });
    await speakThenStaySilent(make().listen(opts));
    expect(contextsWhenAsked).toBe(1);
    expect(made.contexts[0]!.resumed).toBe(true);
  });
  it("tapping stop uploads right away", async () => {
    const p = make();
    const done = p.listen(opts);
    await settle(0); level.value = 0.1; await settle(600);
    p.stop();
    await settle(0);
    await expect(done).resolves.toMatchObject({ ok: true, alternatives: ["hello"] });
  });
  it("reports phases and a live level", async () => {
    const phases: string[] = []; const levels: number[] = [];
    await speakThenStaySilent(make().listen({ ...opts, onPhase: (p) => phases.push(p), onLevel: (l) => levels.push(l) }));
    expect(phases).toEqual(["listening", "processing"]);
    expect(Math.max(...levels)).toBeGreaterThan(0.5);
    expect(levels[levels.length - 1]).toBe(0);
  });
  it("waits longer through pauses for long answers", async () => {
    const done = make().listen({ ...opts, longForm: true, silenceMs: 3500 });
    await settle(0); level.value = 0.1; await settle(500); level.value = 0;
    await settle(2500);
    expect(fetchImpl).not.toHaveBeenCalled();           // a 2.5 s pause does not end a long answer
    level.value = 0.1; await settle(500); level.value = 0;
    await settle(3700);
    await expect(done).resolves.toMatchObject({ ok: true });
  });
});

describe("when nothing is said or something goes wrong", () => {
  it("does not send silence to the paid service", async () => {
    level.value = 0.005; // quiet room, meter working
    const done = make().listen(opts);
    await settle(0); await settle(NO_SPEECH_MS + 300);
    await expect(done).resolves.toEqual({ ok: false, error: "no_speech" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("still sends the audio if the level meter itself is dead", async () => {
    FakeRecorder.bytes = 5000; // a real recording of a second or more
    const p = make();
    const done = p.listen(opts);
    await settle(0); await settle(1000);
    p.stop(); await settle(0);
    await expect(done).resolves.toMatchObject({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("maps microphone permission problems", async () => {
    for (const [name, error] of [["NotAllowedError", "permission_denied"], ["SecurityError", "permission_denied"], ["NotFoundError", "no_microphone"], ["WeirdError", "unknown"]]) {
      getUserMedia = vi.fn(async () => { throw Object.assign(new Error("x"), { name }); });
      await expect(make().listen(opts)).resolves.toEqual({ ok: false, error });
    }
  });
  it("can record again after an error", async () => {
    const p = make({ mediaDevices: { getUserMedia: vi.fn(async () => { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); }) } });
    await p.listen(opts);
    const ok = make();
    await speakThenStaySilent(ok.listen(opts));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("refuses a second recording while one is running", async () => {
    const p = make();
    const first = p.listen(opts);
    await expect(p.listen(opts)).resolves.toEqual({ ok: false, error: "busy" });
    await speakThenStaySilent(first);
  });
  it("abort throws the recording away without uploading", async () => {
    const p = make();
    const done = p.listen(opts);
    await settle(0); level.value = 0.1; await settle(300);
    p.abort(); await settle(0);
    await expect(done).resolves.toEqual({ ok: false, error: "aborted" });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(made.track.stop).toHaveBeenCalled();
  });
  it("does not hang on a recorder that never reports back", async () => {
    FakeRecorder.silentStop = true;
    const done = make().listen(opts);
    await settle(0); level.value = 0.1; await settle(500); level.value = 0;
    await settle(SHORT_END_MS + 200);
    await settle(RECORDER_GRACE_MS + 50);
    await expect(done).resolves.toMatchObject({ ok: true });
  });
  it("maps server answers", async () => {
    const cases: [() => Promise<Response>, string][] = [
      [async () => new Response("{}", { status: 429 }), "rate_limited"],
      [async () => new Response("{}", { status: 500 }), "service_error"],
      [async () => new Response("{}", { status: 401 }), "service_error"],
      [async () => { throw new Error("offline"); }, "network"],
      [async () => new Response(JSON.stringify({ text: "   " }), { status: 200 }), "no_speech"],
    ];
    for (const [impl, error] of cases) {
      fetchImpl = vi.fn(impl);
      await expect(speakThenStaySilent(make().listen(opts))).resolves.toEqual({ ok: false, error });
    }
  });
  it("reports an unusable sign-in token as a service problem", async () => {
    await expect(speakThenStaySilent(make({ getToken: async () => { throw new Error("no user"); } }).listen(opts))).resolves.toEqual({ ok: false, error: "service_error" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("support checks", () => {
  it("needs a recorder and a microphone API", async () => {
    expect(make().isSupported()).toBe(true);
    const noRecorder = make({ Recorder: undefined });
    expect(noRecorder.isSupported()).toBe(false);
    await expect(noRecorder.listen(opts)).resolves.toEqual({ ok: false, error: "unsupported" });
  });
  it("needs a secure connection", async () => {
    vi.stubGlobal("window", { isSecureContext: false });
    await expect(make().listen(opts)).resolves.toEqual({ ok: false, error: "insecure_context" });
  });
});
