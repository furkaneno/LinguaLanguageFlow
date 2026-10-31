import { scoreSpoken, type ScoreResult } from "@/lib/text/similarity";
import type { PronunciationAssessmentProvider, TurkishAnswerEvaluationProvider } from "./types";

/** Recognizers return several hypotheses for the same audio; we score each and keep the best. */
function best(alternatives: string[], score: (alt: string) => ScoreResult): ScoreResult {
  const scored = alternatives.map(score);
  const valid = scored.filter((s) => s.score !== null).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return valid[0] ?? scored[0] ?? { score: null, scoreType: "text-similarity", recognizedText: "", wordFeedback: [] };
}

export const recognitionMatchAssessor: PronunciationAssessmentProvider = {
  id: "recognition-match",
  assess: (target, alts, lang = "en") => best(alts, (a) => scoreSpoken(target, a, lang, "speech-recognition-match")),
};

export const lexicalTurkishEvaluator: TurkishAnswerEvaluationProvider = {
  id: "lexical-match",
  evaluate: (target, alts, lang = "tr") => best(alts, (a) => scoreSpoken(target, a, lang, "text-similarity")),
};
