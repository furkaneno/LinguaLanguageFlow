"use client";
import { CheckCircle2, Lightbulb, LogOut, SkipForward, Volume2, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [skipArmed, setSkipArmed] = useState(false);   // first tap arms, second tap skips
  const [hintVisible, setHintVisible] = useState(false); // stays on screen while you answer, until the next card
  useEffect(() => {
    if (!skipArmed) return;
    const t = setTimeout(() => setSkipArmed(false), 4000);
    return () => clearTimeout(t);
  }, [skipArmed]);
  useEffect(() => { setSkipArmed(false); setHintVisible(false); }, [s.ctx.index]);
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

  // Both helper buttons sit beside the microphone, so nothing needs scrolling: step 1 has Listen, step 2 has Hint.
  const left = stage === "english"
    ? <SideButton icon={Volume2} label={s.speaking ? "Playing" : "Listen"} onClick={() => void s.listen()}
        disabled={recording || evaluating || s.speaking || s.voiceMissing || done} />
    : <SideButton icon={Lightbulb} label={hintVisible ? "Hide" : "Hint"} onClick={() => setHintVisible((v) => !v)}
        disabled={recording || evaluating || done || (!turkishFailed && !hintVisible)} />;
  const right = <SideButton icon={SkipForward} label={skipArmed ? "Sure?" : "Skip"} danger={skipArmed} disabled={recording || evaluating || done}
    onClick={() => { if (skipArmed) { setSkipArmed(false); s.skip(); } else setSkipArmed(true); }} />;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="min-w-0 truncate font-medium">{className}</p>
        <LinkButton href={back} className="shrink-0"><LogOut className="h-4 w-4" aria-hidden /> Exit session</LinkButton>
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

      <div className="mt-6 flex flex-col items-center gap-5 text-center sm:mt-8">
        <p className="rounded-full bg-blush px-4 py-1.5 text-sm font-medium">
          {stage === "english" ? `Step 1 of 2: read it aloud in ${frontName}` : `Step 2 of 2: say the answer in ${backName}`}
        </p>
        <div className="w-full rounded-xl2 border-2 border-brand bg-cream-surface px-6 py-5">
          <p lang={languages.front} className="font-display text-3xl leading-snug sm:text-5xl">{card?.englishText}</p>
        </div>

        {stage === "turkish" && hintVisible && !done && card && (
          <div className="w-full max-w-xl rounded-xl2 border-2 border-brand bg-cream-surface px-5 py-3 text-left">
            <p className="text-xs font-medium text-brand-light">Hint · the saved answer. You still need to say it.</p>
            <p lang={languages.back} className="mt-1 max-h-40 overflow-y-auto whitespace-pre-line break-words text-lg leading-snug">{card.turkishMeaning}</p>
          </div>
        )}

        <p role="status" aria-live="polite" className="text-lg text-ink-muted">{PROMPT[ctx.status]}</p>
        {ctx.notice && <p role="alert" className="rounded-xl bg-danger px-4 py-3 text-sm"><strong>Problem: </strong>{ctx.notice}</p>}

        <div className="grid w-full max-w-sm grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
          <div className="flex justify-end">{left}</div>
          <MicButton recording={recording} evaluating={evaluating || (recording && s.phase === "processing")} disabled={done} onClick={() => { setSkipArmed(false); void s.mic(); }} />
          <div className="flex justify-start">{right}</div>
        </div>

        {recording && s.support.engine === "browser" && (
          <p aria-live="off" className="min-h-6 max-w-md break-words text-sm text-ink-muted">
            {s.heard ? `Hearing: “${s.heard}”` : "Listening…"}
          </p>
        )}
        {recording && s.support.engine === "cloud" && (
          <div className="w-full max-w-xs" aria-live="off">
            <div className="h-2 overflow-hidden rounded-full bg-blush">
              <div className="h-full rounded-full bg-brand transition-[width] duration-100" style={{ width: `${Math.round(s.level * 100)}%` }} />
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              {s.phase === "processing" ? "Transcribing…" : s.level > 0.05 ? "Hearing you…" : "Listening… speak now"}
            </p>
          </div>
        )}
        {skipArmed && <p role="status" className="text-sm text-err">Tap Skip again to skip this card. It won&apos;t count as completed.</p>}
        {stage === "english" && s.voiceMissing && (
          <p className="text-sm text-ink-muted">{`No ${frontName} voice was found on this device, so Listen isn't available. You can still record.`}</p>
        )}

        {ctx.status === "english_ready" && ctx.attempts === 0 && init.baseAttempts === 0 && (
          <p className="max-w-sm text-sm text-ink-muted">
            {s.support.engine === "cloud"
              ? "Your browser will ask to use the microphone. On iPhone each recording is sent to a transcription service (OpenAI) to turn it into text. Lingua Flow doesn't keep it."
              : <>
                  Your browser will ask to use the microphone. Lingua Flow doesn&apos;t save audio; your browser&apos;s speech service processes it to recognize what you say.
                  {s.support.ios && " On iPhone, Dictation must be on: Settings → General → Keyboard → Enable Dictation."}
                </>}
          </p>
        )}

        {last && !recording && !evaluating && <ScoreBlock last={last} threshold={last.stage === "english" ? s.thresholds.english : s.thresholds.turkish} />}
        {!last && !recording && !evaluating && !done && <p className="sr-only">Pass mark {threshold}%</p>}
        {s.saveError && <p role="alert" className="text-sm text-err"><strong>Not saved: </strong>{s.saveError}</p>}
      </div>

    </div>
  );
}

function SideButton({ icon: Icon, label, onClick, disabled, danger = false }:
  { icon: LucideIcon; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-xs font-medium transition-colors hover:bg-blush/50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-[4.5rem] sm:w-[4.5rem] ${danger ? "border-[#B42318] bg-danger text-on-danger" : "border-brand bg-cream-surface"}`}>
      <Icon className="h-5 w-5" aria-hidden />
      {label}
    </button>
  );
}
