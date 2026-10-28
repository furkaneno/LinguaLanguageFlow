"use client";
import { CalendarClock, ListOrdered, MapPin, Play, Shuffle, type LucideIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import type { StudyOrder } from "@/lib/study/order";

export type Choice = StudyOrder | "continue";

interface Props {
  classId: string; className: string; cardCount: number; busy: boolean;
  /** Where "continue" will start; null means no saved place (it starts at #1). */
  place: { number: number } | null;
  onPick: (choice: Choice) => void;
  onSetPlace: (cardNumber: number) => void;
  onResetPlace: () => void;
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

function PlaceEditor({ cardCount, place, busy, onSetPlace, onResetPlace }:
  Pick<Props, "cardCount" | "place" | "busy" | "onSetPlace" | "onResetPlace">) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(place?.number ?? 1));
  const n = Number(value);
  const valid = Number.isInteger(n) && n >= 1 && n <= cardCount;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (valid && !busy) { onSetPlace(n); setOpen(false); }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-ink-muted underline">
        <MapPin className="h-4 w-4" aria-hidden /> Change my place
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="mt-2 rounded-xl2 border border-line bg-cream-surface p-4">
      <label htmlFor="place" className="block text-sm font-medium">Continue from card number</label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input id="place" type="number" inputMode="numeric" min={1} max={cardCount} value={value} onChange={(e) => setValue(e.target.value)}
          className="w-28 rounded-xl border border-line bg-cream px-3 py-2 text-base text-ink" aria-invalid={!valid} />
        <span className="text-sm text-ink-muted">of {cardCount}</span>
        <Button type="submit" disabled={!valid || busy}>Set place</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {!valid && <p className="mt-2 text-sm text-[#FF8A80]"><strong>Error: </strong>Enter a number from 1 to {cardCount}.</p>}
      {place && (
        <button type="button" disabled={busy} onClick={() => { onResetPlace(); setOpen(false); setValue("1"); }}
          className="mt-3 text-sm font-medium text-brand-light underline">Reset my place to #1</button>
      )}
    </form>
  );
}

export function StartPicker({ classId, className, cardCount, busy, place, onPick, onSetPlace, onResetPlace }: Props) {
  return (
    <div className="mx-auto max-w-xl">
      <p className="truncate text-sm text-ink-muted">{className} · {cardCount} {cardCount === 1 ? "card" : "cards"}</p>
      <h1 className="mt-1 font-display text-4xl tracking-tight">How do you want to study?</h1>
      <p className="mt-2 text-ink-muted">Every card works the same way: say the English, then the Turkish. This only sets the order.</p>

      <div className="mt-8" role="group" aria-label="Study order">
        <Option highlight icon={Play} disabled={busy} onClick={() => onPick("continue")}
          title="Continue where I left off"
          body={place ? `Card #${place.number} of ${cardCount}. Your place is kept until you reset it.` : "Starts at card #1 and remembers where you stop."} />
        <PlaceEditor cardCount={cardCount} place={place} busy={busy} onSetPlace={onSetPlace} onResetPlace={onResetPlace} />

        <p className="mb-2 mt-8 text-sm font-medium text-ink-muted">Or practice, without changing your place</p>
        <div className="space-y-3">
          <Option icon={ListOrdered} disabled={busy} onClick={() => onPick("sequential")}
            title="In order" body="From card #1 every time." />
          <Option icon={Shuffle} disabled={busy} onClick={() => onPick("shuffle")}
            title="Shuffled" body="A fresh random order every time." />
          <Option icon={CalendarClock} disabled={busy} onClick={() => onPick("due_first")}
            title="Due for review first" body="New and overdue cards first, then the rest by review date." />
        </div>
      </div>

      {busy && <p role="status" className="mt-4 text-sm text-ink-muted">Working…</p>}
      <LinkButton href={`/classes/${classId}`} variant="ghost" className="mt-6">Back to class</LinkButton>
    </div>
  );
}
