"use client";
import { CheckCircle2, Lightbulb, SkipForward, Volume2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LinkButton, Button } from "@/components/ui/button";
import { useStudySession, type SessionInit } from "@/hooks/useStudySession";
import { LANGUAGES, type ClassLanguages } from "@/lib/languages";
import type { CardDoc } from "@/types";
import { MicButton } from "./MicButton";
import { ScoreBlock } from "./ScoreBlock";

interface Props {
  uid: string; classId: string; className: string; cards: Map<string, CardDoc>;
  init: SessionInit; languages: ClassLanguages; onRestart: () => void;
}

const prompts = (front: string, back: string): Record<string, string> => ({
  english_ready: `Read the card aloud in ${front}.`,
  english_recording: "Listening… tap the button when you're done.",
  english_evaluating: "Checking what you said…",
  english_failed: "Not quite. Listen if you like, then try again.",
  turkish_ready: `Now say the answer in ${back}.`,
  turkish_recording: "Listening… tap the button when you're done.",
  turkish_evaluating: "Checking your answer…",
  turkish_failed: "Not quite. Try again, or take a hint.",
  card_completed: "Both steps done. Next card…",
});

const fmt = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export function StudyScreen({ uid, classId, className, cards, init, languages, onRestart }: Props) {
  const s = useStudySession(uid, classId, cards, init, languages);
  const frontName = LANGUAGES[languages.front].name, backName = LANGUAGES[languages.back].name;
  const PROMPT = prompts(frontName, backName);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const { ctx, card, stage, last } = s;
  const back = `/classes/${classId}`;

  if (!s.support || ctx.status === "loading") return <p role="status" className="py-20 text-center text-ink-muted">Getting ready…</p>;

  if (!s.support.recognition || !s.support.secure) {
    return (
      <div className="mx-auto max-w-md py-12">
        <h1 className="font-display text-3xl">Voice study isn't available here</h1>
        <p className="mt-3 text-ink-muted">
          {!s.support.secure
            ? "Microphone access needs a secure connection (HTTPS, or localhost while developing)."
            : "This browser doesn't support speech recognition. Try Chrome, Edge or Safari."}
        </p>
        <LinkButton href={back} variant="secondary" className="mt-6">Back to class</LinkButton>
      </div>
    );
  }

  if (ctx.status === "session_error") {
    return (
      <div className="mx-auto max-w-md py-12">
        <h1 className="font-display text-3xl">Can't start this session</h1>
        <p className="mt-3 text-ink-muted">{ctx.notice}</p>
        <LinkButton href={back} variant="secondary" className="mt-6">Back to class</LinkButton>
      </div>
    );
  }

  if (ctx.status === "session_completed") {
    const attempts = init.baseAttempts + ctx.attempts;
    const skipped = ctx.cardIds.slice(init.startIndex).filter((id) => !ctx.completedIds.includes(id)).length;
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald" aria-hidden />
        <h1 className="mt-4 font-display text-4xl">Session complete</h1>
        <p className="mt-2 text-ink-muted">
          {skipped === 0 ? "Every card passed both steps." : "Skipped cards don't count as completed and will come up again in a later session."}
        </p>
        {init.remember && init.indexOffset + ctx.cardIds.length >= init.listTotal && (
          <p className="mt-2 text-sm text-ink-muted">You reached the end of the list, so your place is back at card #1.</p>
        )}
        <dl className="mt-8 grid grid-cols-2 gap-3 text-left">
          <div className="rounded-xl2 border border-line bg-cream-surface p-4"><dt className="text-sm text-ink-muted">Cards completed</dt><dd className="text-2xl font-medium">{ctx.completedIds.length}</dd></div>
          {skipped > 0 && <div className="rounded-xl2 border border-line bg-cream-surface p-4"><dt className="text-sm text-ink-muted">Skipped</dt><dd className="text-2xl font-medium">{skipped}</dd></div>}
          <div className="rounded-xl2 border border-line bg-cream-surface p-4"><dt className="text-sm text-ink-muted">Scored attempts</dt><dd className="text-2xl font-medium">{attempts}</dd></div>
          <div className="col-span-2 rounded-xl2 border border-line bg-cream-surface p-4"><dt className="text-sm text-ink-muted">Time</dt><dd className="text-2xl font-medium">{fmt(s.elapsedMs())}</dd></div>
        </dl>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <LinkButton href={back} variant="secondary">Back to class</LinkButton>
          <Button onClick={onRestart}>Start another session</Button>
        </div>
      </div>
    );
  }

  const recording = ctx.status === "english_recording" || ctx.status === "turkish_recording";
  const evaluating = ctx.status === "english_evaluating" || ctx.status === "turkish_evaluating";
  const done = ctx.status === "card_completed";
  const turkishFailed = ctx.status === "turkish_failed";
  const pct = Math.round((Math.min(ctx.index + (done ? 1 : 0), ctx.cardIds.length) / ctx.cardIds.length) * 100);
  const threshold = stage === "english" ? s.thresholds.english : s.thresholds.turkish;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="min-w-0 truncate font-medium">{className}</p>
        <Link href={back} className="shrink-0 text-ink-muted underline">Exit session</Link>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
        <span>Card {ctx.index + 1} of {ctx.cardIds.length}{card ? ` · #${card.number}` : ""}</span>
        <span>{ctx.completedIds.length} done</span>
      </div>
      <div role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-1.5 h-2 overflow-hidden rounded-full bg-blush">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
      </div>
      {init.remember && init.startIndex > 0 && ctx.index === init.startIndex && ctx.attempts === 0 && (
        <p className="mt-3 text-sm text-ink-muted">Continuing from where you left off.</p>
      )}

      <div className="mt-8 flex flex-col items-center gap-6 text-center">
        <p className="rounded-full bg-blush px-4 py-1.5 text-sm font-medium">
          {stage === "english" ? `Step 1 of 2: read it aloud in ${frontName}` : `Step 2 of 2: say the answer in ${backName}`}
        </p>
        <p lang={languages.front} className="font-display text-3xl leading-snug sm:text-5xl">{card?.englishText}</p>

        {stage === "english" && !done && (
          s.voiceMissing
            ? <p className="text-sm text-ink-muted">{`No ${frontName} voice was found on this device, so playback isn't available. You can still record.`}</p>
            : <Button variant="secondary" onClick={() => void s.listen()} disabled={recording || evaluating || s.speaking}>
                <Volume2 className="h-4 w-4" aria-hidden /> {s.speaking ? "Playing…" : "Listen"}
              </Button>
        )}

        <p role="status" aria-live="polite" className="text-lg text-ink-muted">{PROMPT[ctx.status]}</p>
        {ctx.notice && <p role="alert" className="rounded-xl bg-danger px-4 py-3 text-sm"><strong>Problem: </strong>{ctx.notice}</p>}

        <MicButton recording={recording} evaluating={evaluating} disabled={done} onClick={() => void s.mic()} />

        {ctx.status === "english_ready" && ctx.attempts === 0 && init.baseAttempts === 0 && (
          <p className="max-w-sm text-sm text-ink-muted">Your browser will ask to use the microphone. Lingua Flow doesn't save audio; your browser's speech service processes it to recognize what you say.</p>
        )}

        {last && !recording && !evaluating && <ScoreBlock last={last} threshold={last.stage === "english" ? s.thresholds.english : s.thresholds.turkish} />}
        {!last && !recording && !evaluating && !done && <p className="sr-only">Pass mark {threshold}%</p>}

        {turkishFailed && !s.hintShown && (
          <Button variant="ghost" onClick={s.showHint}><Lightbulb className="h-4 w-4" aria-hidden /> Show a hint</Button>
        )}
        {turkishFailed && s.hintShown && card && (
          <div className="rounded-xl2 bg-blush px-5 py-4 text-left">
            <p className="text-sm text-ink-muted">Hint: the saved answer. You still need to say it to continue.</p>
            <p lang={languages.back} className="mt-1 text-lg">{card.turkishMeaning}</p>
          </div>
        )}
        {!recording && !evaluating && !done && (
          confirmSkip ? (
            <div className="w-full rounded-xl2 border border-line bg-cream-surface px-5 py-4 text-left">
              <p className="text-sm">Skip this card? It won't count as completed and will come up again in a later session.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setConfirmSkip(false)}>Keep practicing</Button>
                <Button onClick={() => { setConfirmSkip(false); s.skip(); }}>Skip card</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" onClick={() => setConfirmSkip(true)}><SkipForward className="h-4 w-4" aria-hidden /> Skip this card</Button>
          )
        )}
        {s.saveError && <p role="alert" className="text-sm text-err"><strong>Not saved: </strong>{s.saveError}</p>}
      </div>
    </div>
  );
}
