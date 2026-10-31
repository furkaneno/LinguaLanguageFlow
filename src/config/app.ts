export const APP_NAME = "Lingua Flow";
export const APP_TAGLINE = "Say it. Understand it. Keep it.";

/** Inclusive pass thresholds (80 passes). */
export const ENGLISH_PASS_THRESHOLD = 80;
export const TURKISH_PASS_THRESHOLD = 80;

export const LIMITS = {
  textMax: 500,
  classNameMax: 80,
  descriptionMax: 300,
  batchSize: 400, // Firestore batch limit is 500 writes
} as const;

export const SPEECH = {
  listenTimeoutMs: 12000,
  /** Answers of this many words or more are treated as long: keep listening through pauses. */
  longFormWords: 10,
  longTimeoutMs: 90000,
  longSilenceMs: 3500,
  advanceDelayMs: 1400,
  maxSessionCards: 2000,
} as const;
