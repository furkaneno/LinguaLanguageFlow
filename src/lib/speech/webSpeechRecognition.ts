import type { ListenOptions, RecognitionResult, SpeechErrorCode, SpeechRecognitionProvider } from "./types";

interface SRAlt { transcript: string; confidence: number }
interface SRResult { length: number; [i: number]: SRAlt | undefined }
interface SREvent { results: { length: number; [i: number]: SRResult | undefined } }
interface SRInstance {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: SREvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SRCtor = new () => SRInstance;

const getCtor = (): SRCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

function mapError(code: string): SpeechErrorCode {
  switch (code) {
    case "not-allowed": case "service-not-allowed": return "permission_denied";
    case "audio-capture": return "no_microphone";
    case "no-speech": return "no_speech";
    case "network": return "network";
    case "language-not-supported": return "language_unsupported";
    case "aborted": return "aborted";
    default: return "unknown";
  }
}

/**
 * Web Speech API adapter. Support and accuracy vary by browser (Chrome, Edge and Safari work; Firefox doesn't).
 * In Chrome the audio is processed by the browser's speech service, not by this app.
 */
export class WebSpeechRecognitionProvider implements SpeechRecognitionProvider {
  readonly id = "web-speech-api";
  private active: SRInstance | null = null;

  isSupported() { return getCtor() !== undefined; }

  listen({ lang, timeoutMs, longForm = false, silenceMs = 3500 }: ListenOptions): Promise<RecognitionResult> {
    const Ctor = getCtor();
    if (!Ctor) return Promise.resolve({ ok: false, error: "unsupported" });
    if (!window.isSecureContext) return Promise.resolve({ ok: false, error: "insecure_context" });
    if (this.active) return Promise.resolve({ ok: false, error: "busy" });

    return new Promise((resolve) => {
      const rec = new Ctor();
      this.active = rec;
      rec.lang = lang; rec.continuous = longForm; rec.interimResults = false; rec.maxAlternatives = 3;
      let result: RecognitionResult | null = null;
      let error: SpeechErrorCode | null = null;
      let settled = false;
      const timer = setTimeout(() => rec.stop(), timeoutMs);
      let quiet: ReturnType<typeof setTimeout> | undefined;
      const finish = (r: RecognitionResult) => {
        if (settled) return;
        settled = true; clearTimeout(timer); clearTimeout(quiet); this.active = null; resolve(r);
      };

      rec.onresult = (e) => {
        const segments = Array.from({ length: e.results.length }, (_, i) => e.results[i]).filter((s): s is SRResult => !!s);
        if (segments.length === 0) return;
        const alternatives = segments.length === 1
          ? Array.from({ length: segments[0]!.length }, (_, i) => segments[0]![i]?.transcript.trim() ?? "")
          : [segments.map((s) => s[0]?.transcript.trim() ?? "").join(" ")];
        const clean = alternatives.filter(Boolean);
        if (clean.length) result = { ok: true, alternatives: clean, confidence: segments[0]![0]?.confidence ?? null, provider: this.id };
        // Long answers: each finished phrase restarts a short quiet timer; when it runs out, the answer is over.
        if (longForm && clean.length) { clearTimeout(quiet); quiet = setTimeout(() => rec.stop(), silenceMs); }
      };
      rec.onerror = (e) => { error = mapError(e.error); };
      rec.onend = () => finish(result ?? { ok: false, error: error ?? "no_speech" });
      try { rec.start(); } catch { finish({ ok: false, error: "unknown" }); }
    });
  }

  stop() { this.active?.stop(); }
  abort() { this.active?.abort(); }
}
