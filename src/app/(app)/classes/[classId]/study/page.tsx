"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUid } from "@/components/auth/AuthProvider";
import { Splash } from "@/components/layout/Splash";
import { StudyScreen } from "@/components/study/StudyScreen";
import { LinkButton } from "@/components/ui/button";
import { SPEECH } from "@/config/app";
import type { SessionInit } from "@/hooks/useStudySession";
import { firestoreErrorMessage, getClass, listCards } from "@/lib/firebase/repo";
import { abandonSession, createSession, findActiveSession } from "@/lib/firebase/study";
import { orderCards } from "@/lib/study/schedule";
import type { CardDoc } from "@/types";

type State =
  | { phase: "loading" }
  | { phase: "message"; title: string; body: string }
  | { phase: "ready"; key: number; name: string; cards: Map<string, CardDoc>; init: SessionInit; resumed: boolean };

export default function StudyPage() {
  const uid = useUid();
  const { classId } = useParams<{ classId: string }>();
  const [state, setState] = useState<State>({ phase: "loading" });
  const started = useRef(false);

  const start = useCallback(async (fresh: boolean) => {
    setState({ phase: "loading" });
    try {
      const [cls, list] = await Promise.all([getClass(uid, classId), listCards(uid, classId)]);
      if (!cls) return setState({ phase: "message", title: "Class not found", body: "It may have been deleted." });
      if (list.length === 0) return setState({ phase: "message", title: "This class is empty", body: "Add at least one card before you start learning." });
      const cards = new Map(list.map((c) => [c.id, c]));
      const active = fresh ? null : await findActiveSession(uid, classId);
      if (active && active.cardIds.length > 0 && active.cardIds.every((id) => cards.has(id)) && active.currentIndex < active.cardIds.length) {
        return setState({
          phase: "ready", key: Date.now(), name: cls.name, cards, resumed: true,
          init: { sessionId: active.id, cardIds: active.cardIds, baseAttempts: active.attemptCount,
            resume: { cardIds: active.cardIds, index: active.currentIndex, completedIds: active.completedCardIds, stage: active.currentStage } },
        });
      }
      if (active) await abandonSession(uid, active.id); // cards changed since; its order is no longer valid
      const ids = orderCards(list).slice(0, SPEECH.maxSessionCards).map((c) => c.id);
      const sessionId = await createSession(uid, classId, ids);
      setState({ phase: "ready", key: Date.now(), name: cls.name, cards, resumed: false, init: { sessionId, cardIds: ids, baseAttempts: 0 } });
    } catch (e) {
      setState({ phase: "message", title: "Couldn't load the session", body: firestoreErrorMessage(e) });
    }
  }, [uid, classId]);

  useEffect(() => { if (!started.current) { started.current = true; void start(false); } }, [start]);

  const restart = useCallback(async (abandonCurrent: boolean) => {
    if (abandonCurrent && state.phase === "ready") await abandonSession(uid, state.init.sessionId).catch(() => {});
    await start(true);
  }, [state, uid, start]);

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
  return <StudyScreen key={state.key} uid={uid} classId={classId} className={state.name} cards={state.cards}
    init={state.init} resumed={state.resumed} onRestart={(a) => void restart(a)} />;
}
