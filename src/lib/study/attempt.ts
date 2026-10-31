import { ENGLISH_PASS_THRESHOLD, TURKISH_PASS_THRESHOLD, SPEECH } from "@/config/app";
import { speechErrorMessage } from "@/lib/speech/messages";
import type { SpeechErrorCode, SpeechRecognitionProvider } from "@/lib/speech/types";
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
  assess: (alternatives: string[]) => ScoreResult;
  dispatch: (e: StudyEvent) => void;
}

/** One listen -> score cycle, driving the state machine. Never invents a score. */
export async function runAttempt(stage: Stage, { recognizer, assess, dispatch, lang, longForm = false }: Deps): Promise<AttemptOutcome> {
  dispatch({ type: "START_RECORDING" });
  const heard = await recognizer.listen({
    lang,
    timeoutMs: longForm ? SPEECH.longTimeoutMs : SPEECH.listenTimeoutMs,
    longForm, silenceMs: SPEECH.longSilenceMs,
  });
  if (!heard.ok) {
    if (heard.error === "aborted") return { kind: "cancelled", stage };
    dispatch({ type: "CANCEL_RECORDING", notice: speechErrorMessage(heard.error) });
    return { kind: "error", stage, error: heard.error };
  }
  dispatch({ type: "STOP_RECORDING" });
  const result = assess(heard.alternatives);
  dispatch({ type: "RESULT", score: result.score });
  if (result.score === null) return { kind: "unscored", stage };
  const threshold = stage === "english" ? ENGLISH_PASS_THRESHOLD : TURKISH_PASS_THRESHOLD;
  return { kind: "scored", stage, result, passed: passes(result.score, threshold), provider: heard.provider };
}
