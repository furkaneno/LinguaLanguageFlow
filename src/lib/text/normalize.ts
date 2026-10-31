import type { LangCode } from "@/lib/languages";

const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
  "he's": "he is", "she's": "she is", "it's": "it is", "that's": "that is",
  "there's": "there is", "i've": "i have", "you've": "you have", "we've": "we have",
  "they've": "they have", "i'll": "i will", "you'll": "you will", "we'll": "we will",
  "they'll": "they will", "i'd": "i would", "you'd": "you would", "don't": "do not",
  "doesn't": "does not", "didn't": "did not", "can't": "cannot", "won't": "will not",
  "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
  "haven't": "have not", "hasn't": "has not", "couldn't": "could not",
  "wouldn't": "would not", "shouldn't": "should not", "let's": "let us",
};

const stripPunctuation = (s: string) =>
  s.replace(/[\u2018\u2019]/g, "'").replace(/[^\p{L}\p{N}\s']/gu, " ");

export function normalizeEnglish(input: string): string {
  let s = stripPunctuation(input.normalize("NFKC").toLowerCase());
  s = s.replace(/'?\b[\w']+\b/g, (w) => CONTRACTIONS[w] ?? w);
  return s.replace(/'/g, "").replace(/\s+/g, " ").trim();
}

const TR_FOLD: Record<string, string> = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };

/** Turkish-aware lowercase, punctuation removal and diacritic folding (recognizers often drop diacritics). */
export function normalizeTurkish(input: string): string {
  const lower = input.normalize("NFC").replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase();
  const s = stripPunctuation(lower).replace(/'/g, " ");
  return s.replace(/[çğıöşüâîû]/g, (c) => TR_FOLD[c] ?? c).replace(/\s+/g, " ").trim();
}

export const tokens = (normalized: string): string[] => (normalized ? normalized.split(" ") : []);

/** Lowercase, drops accents and punctuation (including ¿ ¡), but keeps ñ distinct: "año" is not "ano". */
export function normalizeSpanish(input: string): string {
  const s = input.normalize("NFC").toLowerCase().replace(/ñ/g, "ny").normalize("NFD").replace(/\p{M}/gu, "");
  return stripPunctuation(s).replace(/'/g, "").replace(/\s+/g, " ").trim();
}

export const normalizerFor = (lang: LangCode): ((s: string) => string) =>
  lang === "tr" ? normalizeTurkish : lang === "es" ? normalizeSpanish : normalizeEnglish;
