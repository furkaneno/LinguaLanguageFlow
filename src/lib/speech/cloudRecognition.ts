import type { ListenOptions, RecognitionResult, SpeechErrorCode, SpeechRecognitionProvider } from "./types";

/** Loudness (0..1) that counts as speech. */
export const SPEECH_LEVEL = 0.02;
/** Nothing but silence for this long: give up. (Doubled for long answers.) */
export const NO_SPEECH_MS = 8000;
/** Silence after speaking that ends a short card. */
export const SHORT_END_MS = 1500;
/** If the recorder never reports that it stopped, carry on with what we have after this long. */
export const RECORDER_GRACE_MS = 1500;
export const UPLOAD_TIMEOUT_MS = 20000;
const SAMPLE_MS = 100;
const MIME_CANDIDATES = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];

export interface CloudDeps {
  /** Returns a fresh Firebase ID token for the signed-in user. */
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
  mediaDevices?: Pick<MediaDevices, "getUserMedia">;
  Recorder?: typeof MediaRecorder;
  AudioCtx?: typeof AudioContext;
}

function resolveEnv(deps: CloudDeps) {
  const w = typeof window === "undefined" ? undefined : (window as unknown as { webkitAudioContext?: typeof AudioContext; AudioContext?: typeof AudioContext });
  return {
    mediaDevices: deps.mediaDevices ?? (typeof navigator !== "undefined" ? navigator.mediaDevices : undefined),
    Recorder: deps.Recorder ?? (typeof MediaRecorder !== "undefined" ? MediaRecorder : undefined),
    AudioCtx: deps.AudioCtx ?? w?.AudioContext ?? w?.webkitAudioContext,
    fetchImpl: deps.fetchImpl ?? (typeof fetch !== "undefined" ? fetch : undefined),
  };
}

const pickMime = (Recorder: typeof MediaRecorder) => MIME_CANDIDATES.find((t) => Recorder.isTypeSupported?.(t));
const fileNameFor = (mime: string) => (mime.includes("mp4") ? "speech.m4a" : mime.includes("ogg") ? "speech.ogg" : "speech.webm");

function mapMediaError(e: unknown): SpeechErrorCode {
  const name = (e as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "permission_denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no_microphone";
  return "unknown";
}

/**
 * Speech recognition that does not depend on the browser's own recognizer: it records the microphone and
 * has the server transcribe it. Used on iPhone/iPad, where Safari's built-in recognizer can freeze or go deaf.
 * The recording is sent only to our own /api/transcribe route and is not kept.
 */
export class CloudSpeechRecognitionProvider implements SpeechRecognitionProvider {
  readonly id = "cloud-transcription";
  private busy = false;
  private requestStop: (() => void) | null = null;
  private requestAbort: (() => void) | null = null;

  constructor(private readonly deps: CloudDeps) {}

  isSupported() {
    const env = resolveEnv(this.deps);
    return Boolean(env.mediaDevices?.getUserMedia && env.Recorder);
  }

  async listen({ lang, timeoutMs, longForm = false, silenceMs = 3500, onLevel, onPhase }: ListenOptions): Promise<RecognitionResult> {
    const env = resolveEnv(this.deps);
    if (!env.mediaDevices || !env.Recorder || !env.fetchImpl) return { ok: false, error: "unsupported" };
    if (typeof window !== "undefined" && window.isSecureContext === false) return { ok: false, error: "insecure_context" };
    if (this.busy) return { ok: false, error: "busy" };
    this.busy = true;

    let stream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;
    let aborted = false;
    const cleanup = () => {
      stream?.getTracks().forEach((t) => { try { t.stop(); } catch { /* already stopped */ } }); // releases the microphone / iOS audio session
      stream = null;
      if (audioCtx) { void audioCtx.close?.().catch?.(() => {}); audioCtx = null; }
      onLevel?.(0);
    };

    try {
      // Everything up to getUserMedia must run inside the user's tap: iOS only allows audio then.
      if (env.AudioCtx) { try { audioCtx = new env.AudioCtx(); void audioCtx.resume?.(); } catch { audioCtx = null; } }
      try {
        stream = await env.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      } catch (e) { return { ok: false, error: mapMediaError(e) }; }
      void audioCtx?.resume?.();

      const mimeType = pickMime(env.Recorder);
      const recorder = new env.Recorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

      let analyser: AnalyserNode | null = null;
      if (audioCtx) {
        try { analyser = audioCtx.createAnalyser(); analyser.fftSize = 1024; audioCtx.createMediaStreamSource(stream).connect(analyser); } catch { analyser = null; }
      }
      const samples = analyser ? new Uint8Array(analyser.fftSize) : null;
      const loudness = () => {
        if (!analyser || !samples) return 0;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) { const d = (v - 128) / 128; sum += d * d; }
        return Math.sqrt(sum / samples.length);
      };

      let heardSpeech = false;
      let maxLevel = 0;
      const endMs = longForm ? silenceMs : SHORT_END_MS;
      const noSpeechMs = longForm ? NO_SPEECH_MS * 2 : NO_SPEECH_MS;

      const finished = new Promise<"done" | "aborted">((resolve) => {
        let ended = false, elapsed = 0, lastSpeech = 0;
        const end = (why: "done" | "aborted") => { if (ended) return; ended = true; clearInterval(tick); clearTimeout(overall); resolve(why); };
        const tick = setInterval(() => {
          elapsed += SAMPLE_MS;
          const level = loudness();
          maxLevel = Math.max(maxLevel, level);
          onLevel?.(Math.min(1, level * 8));
          if (level >= SPEECH_LEVEL) { heardSpeech = true; lastSpeech = elapsed; }
          else if (heardSpeech && elapsed - lastSpeech >= endMs) end("done");
          else if (!heardSpeech && elapsed >= noSpeechMs) end("done");
        }, SAMPLE_MS);
        const overall = setTimeout(() => end("done"), timeoutMs);
        this.requestStop = () => end("done");
        this.requestAbort = () => { aborted = true; end("aborted"); };
      });

      onPhase?.("listening");
      try { recorder.start(1000); } catch { return { ok: false, error: "unknown" }; }
      await finished;

      const blob = await new Promise<Blob>((resolve) => {
        const make = () => new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/mp4" });
        const grace = setTimeout(() => resolve(make()), RECORDER_GRACE_MS); // never hang on a recorder that doesn't report back
        recorder.onstop = () => { clearTimeout(grace); resolve(make()); };
        try { if (recorder.state !== "inactive") recorder.stop(); else { clearTimeout(grace); resolve(make()); } }
        catch { clearTimeout(grace); resolve(make()); }
      });
      cleanup();

      if (aborted) return { ok: false, error: "aborted" };
      // If the level meter never moved at all it isn't working (not silence), so send the audio anyway.
      const meterDead = maxLevel === 0;
      if (blob.size === 0 || (!heardSpeech && !(meterDead && blob.size > 2000))) return { ok: false, error: "no_speech" };

      onPhase?.("processing");
      const result = await this.upload(blob, lang, env.fetchImpl);
      return aborted ? { ok: false, error: "aborted" } : result;
    } finally {
      cleanup();
      this.busy = false; this.requestStop = null; this.requestAbort = null;
    }
  }

  private async upload(blob: Blob, lang: string, fetchImpl: typeof fetch): Promise<RecognitionResult> {
    let token: string;
    try { token = await this.deps.getToken(); } catch { return { ok: false, error: "service_error" }; }
    const form = new FormData();
    form.append("audio", blob, fileNameFor(blob.type));
    form.append("lang", lang);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const res = await fetchImpl("/api/transcribe", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, signal: ctrl.signal });
      if (res.status === 429) return { ok: false, error: "rate_limited" };
      if (!res.ok) return { ok: false, error: "service_error" };
      const text = ((await res.json()) as { text?: unknown }).text;
      const clean = typeof text === "string" ? text.trim() : "";
      return clean ? { ok: true, alternatives: [clean], confidence: null, provider: this.id } : { ok: false, error: "no_speech" };
    } catch { return { ok: false, error: "network" }; }
    finally { clearTimeout(timer); }
  }

  stop() { this.requestStop?.(); }
  abort() { this.requestAbort?.(); }
}
