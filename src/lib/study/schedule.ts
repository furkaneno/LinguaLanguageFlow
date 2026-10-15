import { SPEECH } from "@/config/app";

const DAY = 86_400_000;
const MAX_LEVEL = SPEECH.intervalDays.length - 1;

/**
 * Simple, explainable scheduling. A card has a level 0..5 mapped to 1,3,7,14,30,60 days.
 * Passing both stages with one attempt each moves it up; many attempts move it down; otherwise it holds.
 * Fewer than two recorded attempts (e.g. a session resumed mid-card) means incomplete data, so the level holds.
 */
export function nextSchedule(prevLevel: number, totalAttempts: number, now: Date = new Date()) {
  let level = prevLevel;
  if (totalAttempts === 2) level = Math.min(prevLevel + 1, MAX_LEVEL);
  else if (totalAttempts >= 6) level = Math.max(prevLevel - 1, 0);
  const intervalDays = SPEECH.intervalDays[level] ?? 1;
  return { level, intervalDays, nextReviewAt: new Date(now.getTime() + intervalDays * DAY) };
}

/** Due or never-studied cards first (original order kept), then the rest soonest-due first. */
export function orderCards<T extends { id: string; nextReviewAt: Date | null }>(cards: T[], now: Date = new Date()): T[] {
  const due = cards.filter((c) => !c.nextReviewAt || c.nextReviewAt <= now);
  const later = cards.filter((c) => c.nextReviewAt && c.nextReviewAt > now)
    .sort((a, b) => a.nextReviewAt!.getTime() - b.nextReviewAt!.getTime());
  return [...due, ...later];
}
