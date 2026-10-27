import { ENGLISH_PASS_THRESHOLD, TURKISH_PASS_THRESHOLD } from "@/config/app";
import { passes } from "@/lib/text/similarity";

export type StudyStatus =
  | "loading" | "english_ready" | "english_recording" | "english_evaluating" | "english_failed"
  | "turkish_ready" | "turkish_recording" | "turkish_evaluating" | "turkish_failed"
  | "card_completed" | "session_completed" | "session_error";

export interface StudyContext {
  status: StudyStatus;
  cardIds: string[];
  index: number;
  completedIds: string[];
  attempts: number; // valid scored attempts only
  lastScore: number | null;
  /** Set when an attempt produced no valid evaluation (never counted, never passes). */
  notice: string | null;
}

export type StudyEvent =
  | { type: "LOADED"; cardIds: string[]; resume?: StudySnapshot }
  | { type: "START_RECORDING" }
  | { type: "STOP_RECORDING" }
  | { type: "CANCEL_RECORDING"; notice?: string }
  | { type: "RESULT"; score: number | null }
  | { type: "RETRY" }
  | { type: "ADVANCE"; fromIndex: number }
  | { type: "SKIP" }
  | { type: "ERROR"; message: string };

export interface StudySnapshot {
  cardIds: string[];
  index: number;
  completedIds: string[];
  stage: "english" | "turkish";
}

export const initialContext: StudyContext = {
  status: "loading", cardIds: [], index: 0, completedIds: [], attempts: 0, lastScore: null, notice: null,
};

/** Recording is never restored; recovery lands on a safe *_ready state. */
export function toSnapshot(ctx: StudyContext): StudySnapshot {
  const stage = ctx.status.startsWith("turkish") ? "turkish" : "english";
  return { cardIds: ctx.cardIds, index: ctx.index, completedIds: ctx.completedIds, stage };
}

export function studyReducer(ctx: StudyContext, ev: StudyEvent): StudyContext {
  const s = ctx.status;
  switch (ev.type) {
    case "LOADED": {
      if (s !== "loading") return ctx;
      if (ev.cardIds.length === 0) return { ...ctx, status: "session_error", notice: "This class has no cards to study." };
      const r = ev.resume;
      const valid = r && r.cardIds.join() === ev.cardIds.join() && r.index >= 0 && r.index < ev.cardIds.length;
      return {
        ...initialContext, cardIds: ev.cardIds,
        index: valid ? r.index : 0,
        completedIds: valid ? r.completedIds.filter((id) => ev.cardIds.includes(id)) : [],
        status: valid && r.stage === "turkish" ? "turkish_ready" : "english_ready",
      };
    }
    case "START_RECORDING":
      if (s === "english_ready" || s === "english_failed") return { ...ctx, status: "english_recording", notice: null };
      if (s === "turkish_ready" || s === "turkish_failed") return { ...ctx, status: "turkish_recording", notice: null };
      return ctx; // ignored: prevents concurrent recordings
    case "STOP_RECORDING":
      if (s === "english_recording") return { ...ctx, status: "english_evaluating" };
      if (s === "turkish_recording") return { ...ctx, status: "turkish_evaluating" };
      return ctx;
    case "CANCEL_RECORDING":
      if (s === "english_recording") return { ...ctx, status: "english_ready", notice: ev.notice ?? null };
      if (s === "turkish_recording") return { ...ctx, status: "turkish_ready", notice: ev.notice ?? null };
      return ctx;
    case "RESULT": {
      if (s !== "english_evaluating" && s !== "turkish_evaluating") return ctx;
      const english = s === "english_evaluating";
      if (typeof ev.score !== "number" || !Number.isFinite(ev.score)) {
        // No valid evaluation: do not count, do not pass.
        return { ...ctx, status: english ? "english_failed" : "turkish_failed", lastScore: null,
          notice: "We couldn't evaluate that attempt. Please try again." };
      }
      const ok = passes(ev.score, english ? ENGLISH_PASS_THRESHOLD : TURKISH_PASS_THRESHOLD);
      const base = { ...ctx, attempts: ctx.attempts + 1, lastScore: ev.score, notice: null };
      if (english) return { ...base, status: ok ? "turkish_ready" : "english_failed" };
      if (!ok) return { ...base, status: "turkish_failed" };
      const id = ctx.cardIds[ctx.index]!;
      return { ...base, status: "card_completed",
        completedIds: ctx.completedIds.includes(id) ? ctx.completedIds : [...ctx.completedIds, id] };
    }
    case "RETRY":
      if (s === "english_failed") return { ...ctx, status: "english_ready" };
      if (s === "turkish_failed") return { ...ctx, status: "turkish_ready" };
      return ctx;
    case "ADVANCE": {
      // fromIndex guards against duplicate timer events advancing twice.
      if (s !== "card_completed" || ev.fromIndex !== ctx.index) return ctx;
      const next = ctx.index + 1;
      if (next >= ctx.cardIds.length) return { ...ctx, status: "session_completed" };
      return { ...ctx, index: next, status: "english_ready", lastScore: null, notice: null };
    }
    case "SKIP": {
      // Moves on WITHOUT completing the card. Ignored while recording, evaluating or after completion.
      const allowed = ["english_ready", "english_failed", "turkish_ready", "turkish_failed"];
      if (!allowed.includes(s)) return ctx;
      const next = ctx.index + 1;
      if (next >= ctx.cardIds.length) return { ...ctx, status: "session_completed", lastScore: null, notice: null };
      return { ...ctx, index: next, status: "english_ready", lastScore: null, notice: null };
    }
    case "ERROR":
      return { ...ctx, status: "session_error", notice: ev.message };
  }
}
