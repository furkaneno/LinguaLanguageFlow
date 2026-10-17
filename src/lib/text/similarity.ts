import { normalizeEnglish, normalizeTurkish, tokens } from "./normalize";

export type ScoreType = "speech-recognition-match" | "text-similarity";

export interface ScoreResult {
  /** Integer 0-100, floored so a failing score is never rounded up to a pass. null = no valid evaluation. */
  score: number | null;
  scoreType: ScoreType;
  recognizedText: string;
  wordFeedback: { word: string; matched: boolean }[];
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

const charSim = (a: string, b: string) => 1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

/** Token similarity: near-matches earn partial credit. */
function tokenSim(a: string, b: string): number {
  const s = charSim(a, b);
  // Eşiği 0.75'ten 0.60'a çekerek "note" ve "not" gibi kelimelerin eşleşmesini kolaylaştırıyoruz
  return s >= 0.60 && Math.min(a.length, b.length) >= 3 ? s : a === b ? 1 : 0;
}

/** Word-level alignment (DP) with fuzzy substitution; omissions and extra words cost 1 each. */
export function alignedSimilarity(target: string[], spoken: string[]) {
  const n = target.length, m = spoken.length;
  if (n === 0 || m === 0) return { similarity: 0, matched: target.map(() => false) };
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) cost[i]![0] = i;
  for (let j = 0; j <= m; j++) cost[0]![j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      const sub = 1 - tokenSim(target[i - 1]!, spoken[j - 1]!);
      cost[i]![j] = Math.min(cost[i - 1]![j]! + 1, cost[i]![j - 1]! + 1, cost[i - 1]![j - 1]! + sub);
    }
  // backtrace for word feedback
  const matched = target.map(() => false);
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const sub = 1 - tokenSim(target[i - 1]!, spoken[j - 1]!);
    if (Math.abs(cost[i]![j]! - (cost[i - 1]![j - 1]! + sub)) < 1e-9) { matched[i - 1] = sub < 0.3; i--; j--; }
    else if (Math.abs(cost[i]![j]! - (cost[i - 1]![j]! + 1)) < 1e-9) i--;
    else j--;
  }
  const similarity = Math.max(0, 1 - cost[n]![m]! / Math.max(n, m));
  return { similarity, matched };
}

function score(
  target: string, spoken: string, norm: (s: string) => string, scoreType: ScoreType,
): ScoreResult {
  const t = tokens(norm(target)), s = tokens(norm(spoken));
  if (t.length === 0 || s.length === 0) {
    return { score: null, scoreType, recognizedText: spoken, wordFeedback: [] };
  }
  const { similarity, matched } = alignedSimilarity(t, s);
  return {
    score: Math.floor(similarity * 100 + 1e-9),
    scoreType,
    recognizedText: spoken,
    wordFeedback: t.map((word, k) => ({ word, matched: matched[k]! })),
  };
}

/** Honest label: this compares recognized speech to the target text. It is NOT a phonetic pronunciation score. */
export const scoreEnglishSpeech = (target: string, recognized: string) =>
  score(target, recognized, normalizeEnglish, "speech-recognition-match");

/** Conservative lexical match against the saved Turkish meaning. Does not understand paraphrases. */
export const scoreTurkishAnswer = (target: string, recognized: string) =>
  score(target, recognized, normalizeTurkish, "text-similarity");

/** Inclusive threshold; invalid scores never pass. */
export const passes = (score: number | null | undefined, threshold: number): boolean =>
  typeof score === "number" && Number.isFinite(score) && score >= threshold;
