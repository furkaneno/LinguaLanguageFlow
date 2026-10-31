import { CheckCircle2, XCircle } from "lucide-react";
import type { LastAttempt } from "@/hooks/useStudySession";

export function ScoreBlock({ last, threshold }: { last: LastAttempt; threshold: number }) {
  const { result, passed, stage } = last;
  const missed = stage === "english" ? result.wordFeedback.filter((w) => !w.matched).map((w) => w.word) : [];
  return (
    <div className={`w-full rounded-xl2 px-5 py-4 text-left ${passed ? "bg-success" : "bg-danger"}`}>
      <p className="flex items-center gap-2 font-medium">
        {passed ? <CheckCircle2 className="h-5 w-5 text-emerald" aria-hidden /> : <XCircle className="h-5 w-5 text-err" aria-hidden />}
        {result.score}% — {passed ? "passed" : `below ${threshold}%, try again`}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        {stage === "english"
          ? "Speech match: how closely what your device heard matches the card. It isn't a phonetic pronunciation score."
          : "Answer match: how closely your words match the saved answer. Different wording may score lower."}
      </p>
      {result.recognizedText && <p className="mt-2 text-sm">We heard: “{result.recognizedText}”</p>}
      {!passed && missed.length > 0 && <p className="mt-1 text-sm">Words to check: {missed.join(", ")}</p>}
    </div>
  );
}
