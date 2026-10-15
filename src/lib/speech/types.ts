import type { ScoreResult } from "@/lib/text/similarity";

export type SpeechErrorCode =
  | "unsupported" | "insecure_context" | "permission_denied" | "no_microphone" | "no_speech"
  | "network" | "language_unsupported" | "aborted" | "busy" | "unknown";

export type RecognitionResult =
  | { ok: true; /** Recognizer hypotheses for the same audio, best first. */ alternatives: string[]; confidence: number | null; provider: string }
  | { ok: false; error: SpeechErrorCode };

export interface ListenOptions { lang: string; timeoutMs: number }

export interface SpeechRecognitionProvider {
  readonly id: string;
  isSupported(): boolean;
  listen(options: ListenOptions): Promise<RecognitionResult>;
  /** Finish capture early and use what was heard so far. */
  stop(): void;
  /** Cancel capture and discard the result. */
  abort(): void;
}

export interface SpeechSynthesisProvider {
  isSupported(): boolean;
  /** true/false once the device's voice list is known, null while unknown. */
  hasVoiceFor(lang: string): boolean | null;
  speak(text: string, lang: string): Promise<"spoken" | "error">;
  cancel(): void;
}

/** Scores English speech against the target. The default is a speech-recognition match, NOT phonetic scoring. */
export interface PronunciationAssessmentProvider { readonly id: string; assess(target: string, alternatives: string[]): ScoreResult }
/** Scores a spoken Turkish answer against the saved meaning. The default is a conservative lexical match. */
export interface TurkishAnswerEvaluationProvider { readonly id: string; evaluate(target: string, alternatives: string[]): ScoreResult }
