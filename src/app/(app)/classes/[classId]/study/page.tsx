"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUid } from "@/components/auth/AuthProvider";
import { Splash } from "@/components/layout/Splash";
import { StartPicker, type Choice } from "@/components/study/StartPicker";
import { StudyScreen } from "@/components/study/StudyScreen";
import { LinkButton } from "@/components/ui/button";
import type { SessionInit } from "@/hooks/useStudySession";
import { firestoreErrorMessage, getClass, listCards } from "@/lib/firebase/repo";
import { abandonSession, createSession, findActiveSession } from "@/lib/firebase/study";
import { orderForSession } from "@/lib/study/order";
import type { CardDoc, SessionDoc } from "@/types";

type State =
  | { phase: "loading" }
  | { phase: "message"; title: string; body: string }
  | { phase: "pick"; name: string; cards: CardDoc[]; active: SessionDoc | null; busy: boolean }
  | { phase: "ready"; key: number; name: string; cards: Map<string, CardDoc>; init: SessionInit; resumed: boolean };

export default function StudyPage() {
  const uid = useUid();
  const { classId } = useParams<{ classId: string }>();
  const [state, setState] = useState<State>({ phase: "loading" });
  const started = useRef(false);

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const [cls, cards] = await Promise.all([getClass(uid, classId), listCards(uid, classId)]);
      if (!cls) return setState({ phase: "message", title: "Class not found", body: "It may have been deleted." });
      if (cards.length === 0) return setState({ phase: "message", title: "This class is empty", body: "Add at least one card before you start learning." });
      const ids = new Set(cards.map((c) => c.id));
      let active = await findActiveSession(uid, classId);
      const usable = active && active.cardIds.length > 0 && active.currentIndex < active.cardIds.length && active.cardIds.every((id) => ids.has(id));
      if (active && !usable) { await abandonSession(uid, active.id); active = null; } // cards changed since; its order is no longer valid
      setState({ phase: "pick", name: cls.name, cards, active, busy: false });
    } catch (e) {
      setState({ phase: "message", title: "Couldn't load the session", body: firestoreErrorMessage(e) });
    }
  }, [uid, classId]);

  useEffect(() => { if (!started.current) { started.current = true; void load(); } }, [load]);

  const pick = useCallback(async (choice: Choice) => {
    if (state.phase !== "pick" || state.busy) return;
    const { name, cards, active } = state;
    setState({ ...state, busy: true });
    try {
      const map = new Map(cards.map((c) => [c.id, c]));
      if (choice === "resume" && active) {
        return setState({
          phase: "ready", key: Date.now(), name, cards: map, resumed: true,
          init: { sessionId: active.id, cardIds: active.cardIds, baseAttempts: active.attemptCount,
            resume: { cardIds: active.cardIds, index: active.currentIndex, completedIds: active.completedCardIds, stage: active.currentStage } },
        });
      }
      if (active) await abandonSession(uid, active.id); // a new order replaces the unfinished session
      const ids = orderForSession(cards, choice === "resume" ? "sequential" : choice).map((c) => c.id);
      const sessionId = await createSession(uid, classId, ids);
      setState({ phase: "ready", key: Date.now(), name, cards: map, resumed: false, init: { sessionId, cardIds: ids, baseAttempts: 0 } });
    } catch (e) {
      setState({ phase: "message", title: "Couldn't start the session", body: firestoreErrorMessage(e) });
    }
  }, [state, uid, classId]);

  const restart = useCallback(async (abandonCurrent: boolean) => {
    if (abandonCurrent && state.phase === "ready") await abandonSession(uid, state.init.sessionId).catch(() => {});
    await load();
  }, [state, uid, load]);

  if (state.phase === "loading") return <Splash label="Preparing your session" />;
  if (state.phase === "message") {
    return (
      <div className="mx-auto max-w-md py-12">
        <h1 className="font-display text-3xl">{state.title}</h1>
        <p className="mt-3 text-ink-muted">{state.body}</p>
        <LinkButton href={`/classes/${classId}`} variant="secondary" className="mt-6">Back to class</LinkButton>
      </div>
    );
  }
  if (state.phase === "pick") {
    const a = state.active;
    return <StartPicker classId={classId} className={state.name} cardCount={state.cards.length} busy={state.busy}
      resume={a ? { position: a.currentIndex + 1, total: a.cardIds.length, done: a.completedCardIds.length } : null}
      onPick={(c) => void pick(c)} />;
  }
  return <StudyScreen key={state.key} uid={uid} classId={classId} className={state.name} cards={state.cards}
    init={state.init} resumed={state.resumed} onRestart={(a) => void restart(a)} />;
}
