import { SPEECH } from "@/config/app";
import { orderCards } from "./schedule";

export type StudyOrder = "sequential" | "shuffle" | "due_first";

/** Fisher-Yates on a copy; `rand` is injectable for tests. */
export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface Orderable { id: string; number: number; nextReviewAt: Date | null }

/** Card order for a new session. Always a permutation of the input (capped at the session limit). */
export function orderForSession<T extends Orderable>(
  cards: T[], order: StudyOrder, now: Date = new Date(), rand: () => number = Math.random,
): T[] {
  const byNumber = [...cards].sort((a, b) => a.number - b.number);
  const ordered =
    order === "sequential" ? byNumber : order === "shuffle" ? shuffle(byNumber, rand) : orderCards(byNumber, now);
  return ordered.slice(0, SPEECH.maxSessionCards);
}

/** A remembered position in a class's card list (the "continue where I left off" bookmark). */
export interface StudyPlace { cardId: string | null; index: number }

/** Where the main run starts: by card id if it still exists, else by saved index, else the beginning. */
export function resolveStartIndex(cardIds: string[], place: StudyPlace | null): number {
  if (!place) return 0;
  const byId = place.cardId ? cardIds.indexOf(place.cardId) : -1;
  if (byId >= 0) return byId;
  return Number.isInteger(place.index) && place.index >= 0 && place.index < cardIds.length ? place.index : 0;
}

/**
 * The main "continue" run walks the whole list in order, starting at the saved place.
 * Only lists longer than the session limit are windowed (indexOffset says where the window starts).
 */
export function mainRun(cardIds: string[], place: StudyPlace | null, max: number = SPEECH.maxSessionCards) {
  const start = resolveStartIndex(cardIds, place);
  if (cardIds.length <= max) return { cardIds, startIndex: start, indexOffset: 0 };
  return { cardIds: cardIds.slice(start, start + max), startIndex: 0, indexOffset: start };
}

/**
 * The place to save after finishing (or skipping) the card before index `i` of a run.
 * "finished" means the whole list is done, so the saved place is cleared and the next run starts at #1.
 */
export function nextPlace(i: number, runCardIds: string[], indexOffset: number, listTotal: number): StudyPlace | "finished" {
  if (i >= runCardIds.length) {
    const end = indexOffset + runCardIds.length;
    return end >= listTotal ? "finished" : { cardId: null, index: end };
  }
  return { cardId: runCardIds[i] ?? null, index: indexOffset + i };
}
