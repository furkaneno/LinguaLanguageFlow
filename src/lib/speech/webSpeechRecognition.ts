import { isIOS } from "./platform";
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

/** Short cards: stop this long after the last words, in case the browser never ends the session itself. */
export const SHORT_QUIET_MS = 2500;
/** iPhone chains short sessions for long answers; this caps how many. */
export const MAX_CHAINED_SESSIONS = 12;

/** Latest transcript(s) from a results list: interim text counts too, so nothing said is lost. */
function readResults(results: SREvent["results"]): { alternatives: string[]; confidence: number | null } | null {
  const segments = Array.from({ length: results.length }, (_, i) => results[i]).filter((s): s is SRResult => !!s);
  const first = segments[0];
  if (!first) return null;
  const alternatives = segments.length === 1
    ? Array.from({ length: first.length }, (_, i) => first[i]?.transcript.trim() ?? "")
    : [segments.map((s) => s[0]?.transcript.trim() ?? "").filter(Boolean).join(" ")];
  const clean = alternatives.filter(Boolean);
  return clean.length ? { alternatives: clean, confidence: first[0]?.confidence ?? null } : null;
}

/**
 * Web Speech API adapter (Chrome, Edge, Safari; Firefox is unsupported). In Chrome the audio is processed by the
 * browser's speech service, not by this app.
 *
 * iPhone/iPad notes: Safari often delivers only interim text and ends sessions early, and its continuous mode is
 * unreliable. So interim text is always used, a quiet timer ends the capture, and long answers are captured as a
 * chain of short sessions whose text is joined together.
 */
export class WebSpeechRecognitionProvider implements SpeechRecognitionProvider {
  readonly id = "web-speech-api";
  private active: SRInstance | null = null;
  private requestStop: (() => void) | null = null;
  private requestAbort: (() => void) | null = null;

  isSupported() { return getCtor() !== undefined; }

  listen({ lang, timeoutMs, longForm = false, silenceMs = 3500, onInterim }: ListenOptions): Promise<RecognitionResult> {
    const Ctor = getCtor();
    if (!Ctor) return Promise.resolve({ ok: false, error: "unsupported" });
    if (!window.isSecureContext) return Promise.resolve({ ok: false, error: "insecure_context" });
    if (this.active) return Promise.resolve({ ok: false, error: "busy" });

    const ios = isIOS();
    const chain = longForm && ios;
    const quietMs = longForm ? silenceMs : SHORT_QUIET_MS;

    return new Promise((resolve) => {
      let current: SRInstance | null = null;
      let settled = false, stopRequested = false, aborted = false;
      let committed = "";                                  // text from earlier sessions of an iPhone chain
      let latest: { alternatives: string[]; confidence: number | null } | null = null; // this session's text
      let lastError: SpeechErrorCode | null = null;
      let sessions = 0;
      let quiet: ReturnType<typeof setTimeout> | undefined;

      const compose = (): Extract<RecognitionResult, { ok: true }> | null => {
        if (!committed && !latest) return null;
        const parts = latest ? latest.alternatives : [];
        const alternatives = parts.length ? parts.map((a) => (committed ? `${committed} ${a}` : a)) : [committed];
        return { ok: true, alternatives, confidence: latest?.confidence ?? null, provider: this.id };
      };
      const finish = (r: RecognitionResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(overall); clearTimeout(quiet);
        this.active = null; this.requestStop = null; this.requestAbort = null;
        resolve(r);
      };
      const stop = () => { stopRequested = true; try { current?.stop(); } catch { /* already ended */ } };
      const overall = setTimeout(stop, timeoutMs);

      const startSession = (restart: boolean) => {
        const rec = new Ctor();
        current = rec; this.active = rec; sessions++;
        latest = null;
        let sessionError: SpeechErrorCode | null = null;
        rec.lang = lang;
        rec.continuous = longForm && !ios;   // iOS: no continuous mode
        rec.interimResults = true;           // iOS may never send a final result, so interim text is used too
        rec.maxAlternatives = 3;

        rec.onresult = (e) => {
          const r = readResults(e.results);
          if (!r) return;
          latest = r;
          onInterim?.(compose()?.alternatives[0] ?? "");
          clearTimeout(quiet);
          quiet = setTimeout(stop, quietMs);
        };
        rec.onerror = (e) => { sessionError = mapError(e.error); lastError = sessionError; };
        rec.onend = () => {
          if (settled) return;
          if (aborted) return finish({ ok: false, error: "aborted" });
          // iPhone: the session ended on a pause while the user is still within the quiet window, so keep listening.
          if (chain && !stopRequested && !sessionError && latest && sessions < MAX_CHAINED_SESSIONS) {
            committed = compose()?.alternatives[0] ?? committed;
            return startSession(true);
          }
          finish(compose() ?? { ok: false, error: lastError ?? "no_speech" });
        };
        try { rec.start(); }
        catch { finish(restart ? compose() ?? { ok: false, error: "unknown" } : { ok: false, error: "unknown" }); }
      };

      this.requestStop = stop;
      this.requestAbort = () => {
        aborted = true;
        try { current?.abort(); } catch { /* already ended */ }
        setTimeout(() => finish({ ok: false, error: "aborted" }), 300); // safety net if the browser never fires onend
      };
      startSession(false); // runs synchronously inside the tap, which iOS requires
    });
  }

  stop() { this.requestStop?.(); }
  abort() { this.requestAbort?.(); }
}
