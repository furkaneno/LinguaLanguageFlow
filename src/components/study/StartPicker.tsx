"use client";
import { CalendarClock, ListOrdered, Play, Shuffle, type LucideIcon } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import type { StudyOrder } from "@/lib/study/order";

export type Choice = StudyOrder | "resume";

interface Props {
  classId: string; className: string; cardCount: number; busy: boolean;
  resume: { position: number; total: number; done: number } | null;
  onPick: (choice: Choice) => void;
}

function Option({ icon: Icon, title, body, onClick, disabled, highlight }:
  { icon: LucideIcon; title: string; body: string; onClick: () => void; disabled: boolean; highlight?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`flex w-full items-center gap-4 rounded-xl2 border bg-cream-surface p-4 text-left transition-colors hover:bg-blush/50 disabled:cursor-not-allowed disabled:opacity-60 sm:p-5 ${highlight ? "border-brand" : "border-line"}`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blush"><Icon className="h-5 w-5" aria-hidden /></span>
      <span className="min-w-0">
        <span className="block text-lg font-medium">{title}</span>
        <span className="block text-sm text-ink-muted">{body}</span>
      </span>
    </button>
  );
}

export function StartPicker({ classId, className, cardCount, busy, resume, onPick }: Props) {
  return (
    <div className="mx-auto max-w-xl">
      <p className="truncate text-sm text-ink-muted">{className} · {cardCount} {cardCount === 1 ? "card" : "cards"}</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">How do you want to study?</h1>
      <p className="mt-2 text-ink-muted">Every card works the same way: say the English, then the Turkish. This only sets the order.</p>

      <div className="mt-8 space-y-3" role="group" aria-label="Study order">
        {resume && (
          <Option highlight icon={Play} disabled={busy} onClick={() => onPick("resume")}
            title="Continue where I left off" body={`Card ${resume.position} of ${resume.total} · ${resume.done} done`} />
        )}
        <Option icon={ListOrdered} disabled={busy} onClick={() => onPick("sequential")}
          title="In order" body="From card #1, as they appear in your list." />
        <Option icon={Shuffle} disabled={busy} onClick={() => onPick("shuffle")}
          title="Shuffled" body="A random order every session." />
        <Option icon={CalendarClock} disabled={busy} onClick={() => onPick("due_first")}
          title="Due for review first" body="New and overdue cards first, then the rest by review date." />
      </div>

      {resume && <p className="mt-4 text-sm text-ink-muted">Choosing a different order closes your unfinished session.</p>}
      {busy && <p role="status" className="mt-4 text-sm text-ink-muted">Starting…</p>}
      <LinkButton href={`/classes/${classId}`} variant="ghost" className="mt-6">Back to class</LinkButton>
    </div>
  );
}
