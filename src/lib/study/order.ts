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
