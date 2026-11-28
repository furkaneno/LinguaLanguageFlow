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
/** If the browser never says it has ended after stop() (it happens on iPhone), give up after this long and use what we have. */
export const STOP_GRACE_MS = 1500;
/** If the engine produces nothing at all for this long, it is not listening; stop instead of waiting for the full limit. */
export const NO_RESPONSE_MS = 7000;
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
  private trace: string[] = [];
  private traceStart = 0;

  isSupported() { return getCtor() !== undefined; }
  /** What the engine did during the latest recording, e.g. "start 0.0s › audiostart 0.1s › error:no-speech 7.0s › end 7.0s". */
  diagnostics() { return this.trace.join(" › "); }

  listen({ lang, timeoutMs, longForm = false, silenceMs = 3500, onInterim, onPhase }: ListenOptions): Promise<RecognitionResult> {
    const Ctor = getCtor();
    if (!Ctor) return Promise.resolve({ ok: false, error: "unsupported" });
    if (!window.isSecureContext) return Promise.resolve({ ok: false, error: "insecure_context" });
    if (this.active) return Promise.resolve({ ok: false, error: "busy" });

    const ios = isIOS();
    const chain = longForm && ios;
    const quietMs = longForm ? silenceMs : SHORT_QUIET_MS;

    this.trace = []; this.traceStart = Date.now();
    const log = (name: string) => {
      if (this.trace.length >= 40) return;
      if (name === "result" && this.trace[this.trace.length - 1]?.startsWith("result")) return; // one entry per run of results
      this.trace.push(`${name} ${((Date.now() - this.traceStart) / 1000).toFixed(1)}s`);
    };
    log(`listen ${lang}${ios ? " ios" : ""}`);

    return new Promise((resolve) => {
      let current: SRInstance | null = null;
      let settled = false, stopRequested = false, aborted = false;
      let committed = "";                                  // text from earlier sessions of an iPhone chain
      let latest: { alternatives: string[]; confidence: number | null } | null = null; // this session's text
      let lastError: SpeechErrorCode | null = null;
      let sessions = 0;
      let ended = false;                                    // the current session reported its end
      let readyTimer: ReturnType<typeof setTimeout> | undefined;
      let ready = false;
      const markReady = () => { if (ready) return; ready = true; clearTimeout(readyTimer); onPhase?.("listening"); };
      let quiet: ReturnType<typeof setTimeout> | undefined;
      let force: ReturnType<typeof setTimeout> | undefined;
      let noResponse: ReturnType<typeof setTimeout> | undefined;

      const compose = (): Extract<RecognitionResult, { ok: true }> | null => {
        if (!committed && !latest) return null;
        const parts = latest ? latest.alternatives : [];
        const alternatives = parts.length ? parts.map((a) => (committed ? `${committed} ${a}` : a)) : [committed];
        return { ok: true, alternatives, confidence: latest?.confidence ?? null, provider: this.id };
      };
      const finish = (r: RecognitionResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(overall); clearTimeout(quiet); clearTimeout(force); clearTimeout(noResponse); clearTimeout(readyTimer);
        // A session that never reported its end can keep holding the microphone (iPhone); release it so the next recording starts clean.
        if (current && !ended) {
          const dead = current;
          dead.onresult = null; dead.onerror = null; dead.onend = null;
          try { dead.abort(); } catch { /* already gone */ }
        }
        this.active = null; this.requestStop = null; this.requestAbort = null;
        resolve(r);
      };
      const stop = () => {
        stopRequested = true; log("stop");
        clearTimeout(force);
        force = setTimeout(() => { log("no end event, forced"); finish(compose() ?? { ok: false, error: lastError ?? "no_speech" }); }, STOP_GRACE_MS); // armed before stop() on purpose
        try { current?.stop(); } catch { /* already ended */ }
      };
      const overall = setTimeout(stop, timeoutMs);

      const startSession = (restart: boolean) => {
        const rec = new Ctor();
        current = rec; this.active = rec; sessions++; ended = false;
        latest = null;
        let sessionError: SpeechErrorCode | null = null;
        rec.lang = lang;
        rec.continuous = longForm && !ios;   // iOS: no continuous mode
        rec.interimResults = true;           // iOS may never send a final result, so interim text is used too
        rec.maxAlternatives = 3;
        for (const name of ["start", "audiostart", "soundstart", "speechstart", "speechend", "soundend", "audioend", "nomatch"]) {
          (rec as unknown as Record<string, unknown>)[`on${name}`] = () => { log(name); if (name === "audiostart" || name === "soundstart" || name === "speechstart") markReady(); };
        }

        rec.onresult = (e) => {
          const r = readResults(e.results);
          if (!r) return;
          log("result"); markReady();
          latest = r;
          onInterim?.(compose()?.alternatives[0] ?? "");
          clearTimeout(quiet);
          quiet = setTimeout(stop, quietMs);
        };
        rec.onerror = (e) => {
          const code = mapError(e.error);
          // Safari reports "aborted" by itself when it heard nothing. Only an abort WE asked for counts as a cancel.
          sessionError = code === "aborted" && !aborted ? "no_speech" : code;
          lastError = sessionError; log(`error:${e.error}`);
        };
        rec.onend = () => {
          log("end"); ended = true;
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
      onPhase?.("starting");
      readyTimer = setTimeout(markReady, 2500); // in case a browser never reports that audio started
      this.requestAbort = () => {
        aborted = true;
        try { current?.abort(); } catch { /* already ended */ }
        setTimeout(() => finish({ ok: false, error: "aborted" }), 300); // safety net if the browser never fires onend
      };
      startSession(false); // runs synchronously inside the tap, which iOS requires
      noResponse = setTimeout(() => { if (!latest && !committed) { log("nothing heard, stopping"); stop(); } }, longForm ? NO_RESPONSE_MS * 2 : NO_RESPONSE_MS);
    });
  }

  stop() { this.requestStop?.(); }
  abort() { this.requestAbort?.(); }
}
