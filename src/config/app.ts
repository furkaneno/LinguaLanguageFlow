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
  englishLang: "en-US",
  turkishLang: "tr-TR",
  listenTimeoutMs: 12000,
  advanceDelayMs: 1400,
  maxSessionCards: 2000,
  /** Review intervals in days, indexed by a card's level. */
  intervalDays: [1, 3, 7, 14, 30, 60],
} as const;
