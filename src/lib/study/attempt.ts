import { ENGLISH_PASS_THRESHOLD, TURKISH_PASS_THRESHOLD, SPEECH } from "@/config/app";
import { speechErrorMessage } from "@/lib/speech/messages";
import { isIOS } from "@/lib/speech/platform";
import type { RecognitionResult, SpeechErrorCode, SpeechRecognitionProvider } from "@/lib/speech/types";
import { passes, type ScoreResult } from "@/lib/text/similarity";
import type { StudyEvent } from "./machine";

export type Stage = "english" | "turkish";

export type AttemptOutcome =
  | { kind: "scored"; stage: Stage; result: ScoreResult; passed: boolean; provider: string }
  | { kind: "unscored"; stage: Stage }                    // heard speech but nothing comparable
  | { kind: "error"; stage: Stage; error: SpeechErrorCode }
  | { kind: "cancelled"; stage: Stage };

interface Deps {
  recognizer: SpeechRecognitionProvider;
  /** BCP-47 tag to listen for (comes from the class languages). */
  lang: string;
  longForm?: boolean;
  /** Live text while the user is speaking. */
  onInterim?: (text: string) => void;
  /** 0 turns the pass mark off: any score, even 0%, lets the user move on. Omit for the normal 80%. */
  passMark?: number;
  /** Cloud engine: microphone level and processing phase. */
  onLevel?: (level: number) => void;
  onPhase?: (phase: "listening" | "processing") => void;
  assess: (alternatives: string[]) => ScoreResult;
  dispatch: (e: StudyEvent) => void;
}

/** One listen -> score cycle, driving the state machine. Never invents a score. */
export async function runAttempt(stage: Stage, { recognizer, assess, dispatch, lang, longForm = false, passMark, onInterim, onLevel, onPhase }: Deps): Promise<AttemptOutcome> {
  dispatch({ type: "START_RECORDING" });
  let heard: RecognitionResult;
  try {
    heard = await recognizer.listen({
      lang,
      timeoutMs: longForm ? SPEECH.longTimeoutMs : SPEECH.listenTimeoutMs,
      longForm, silenceMs: SPEECH.longSilenceMs, ...(onInterim ? { onInterim } : {}),
      ...(onLevel ? { onLevel } : {}), ...(onPhase ? { onPhase } : {}),
    });
  } catch {
    heard = { ok: false, error: "unknown" }; // an engine that throws must never leave the screen stuck on "recording"
  }
  if (!heard.ok) {
    if (heard.error === "aborted") return { kind: "cancelled", stage };
    const detail = isIOS() ? recognizer.diagnostics?.() : "";
    dispatch({ type: "CANCEL_RECORDING", notice: speechErrorMessage(heard.error, isIOS()) + (detail ? ` (Details: ${detail})` : "") });
    return { kind: "error", stage, error: heard.error };
  }
  dispatch({ type: "STOP_RECORDING" });
  let result = assess(heard.alternatives);
  // Without a pass mark, something was heard but nothing could be compared: count it as 0% so the user can move on.
  if (passMark === 0 && result.score === null) result = { ...result, score: 0 };
  dispatch({ type: "RESULT", score: result.score, ...(passMark !== undefined ? { passMark } : {}) });
  if (result.score === null) return { kind: "unscored", stage };
  const threshold = passMark ?? (stage === "english" ? ENGLISH_PASS_THRESHOLD : TURKISH_PASS_THRESHOLD);
  return { kind: "scored", stage, result, passed: passes(result.score, threshold), provider: heard.provider };
}
