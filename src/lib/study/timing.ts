import { SPEECH } from "@/config/app";

/**
 * How long to wait on a finished card before moving on.
 * Normally short. In free practice the correct answer is on screen, so give time to read it: longer answers wait longer.
 */
export function advanceDelay(freePractice: boolean, answerLength: number): number {
  if (!freePractice) return SPEECH.advanceDelayMs;
  const reading = SPEECH.advanceDelayFreeMs + Math.max(0, answerLength) * SPEECH.advanceFreePerCharMs;
  return Math.min(SPEECH.advanceFreeMaxMs, reading);
}
