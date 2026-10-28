"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUid } from "@/components/auth/AuthProvider";
import { Splash } from "@/components/layout/Splash";
import { StartPicker, type Choice } from "@/components/study/StartPicker";
import { StudyScreen } from "@/components/study/StudyScreen";
import { LinkButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { SessionInit } from "@/hooks/useStudySession";
import { firestoreErrorMessage, getClass, listCards } from "@/lib/firebase/repo";
import { abandonSession, clearPlace, createSession, findActiveSession, getPlace, savePlace } from "@/lib/firebase/study";
import { mainRun, orderForSession, resolveStartIndex, type StudyPlace } from "@/lib/study/order";
import type { CardDoc } from "@/types";

type State =
  | { phase: "loading" }
  | { phase: "message"; title: string; body: string }
  | { phase: "pick"; name: string; cards: CardDoc[]; place: StudyPlace | null; busy: boolean }
  | { phase: "ready"; key: number; name: string; cards: Map<string, CardDoc>; init: SessionInit };

const byNumber = (cards: CardDoc[]) => [...cards].sort((a, b) => a.number - b.number);

export default function StudyPage() {
  const uid = useUid();
  const toast = useToast();
  const { classId } = useParams<{ classId: string }>();
  const [state, setState] = useState<State>({ phase: "loading" });
  const started = useRef(false);

  const load = useCallback(async () => {
    setState({ phase: "loading" });
    try {
      const [cls, cards, place, active] = await Promise.all([
        getClass(uid, classId), listCards(uid, classId),
        getPlace(uid, classId).catch(() => null), findActiveSession(uid, classId).catch(() => null),
      ]);
      if (!cls) return setState({ phase: "message", title: "Class not found", body: "It may have been deleted." });
      if (cards.length === 0) return setState({ phase: "message", title: "This class is empty", body: "Add at least one card before you start learning." });
      if (active) abandonSession(uid, active.id).catch(() => {}); // old unfinished runs are never resumed; your place is kept separately
      setState({ phase: "pick", name: cls.name, cards, place, busy: false });
    } catch (e) {
      setState({ phase: "message", title: "Couldn't load the session", body: firestoreErrorMessage(e) });
    }
  }, [uid, classId]);

  useEffect(() => { if (!started.current) { started.current = true; void load(); } }, [load]);

  const pick = useCallback(async (choice: Choice) => {
    if (state.phase !== "pick" || state.busy) return;
    const { name, cards, place } = state;
    setState({ ...state, busy: true });
    try {
      let init: Omit<SessionInit, "sessionId">;
      if (choice === "continue") {
        const run = mainRun(byNumber(cards).map((c) => c.id), place);
        init = { ...run, baseAttempts: 0, listTotal: cards.length, remember: true };
      } else {
        const ids = orderForSession(cards, choice).map((c) => c.id);
        init = { cardIds: ids, startIndex: 0, indexOffset: 0, baseAttempts: 0, listTotal: cards.length, remember: false };
      }
      const sessionId = await createSession(uid, classId, init.cardIds);
      setState({ phase: "ready", key: Date.now(), name, cards: new Map(cards.map((c) => [c.id, c])), init: { ...init, sessionId } });
    } catch (e) {
      setState({ phase: "message", title: "Couldn't start the session", body: firestoreErrorMessage(e) });
    }
  }, [state, uid, classId]);

  const setPlace = useCallback(async (cardNumber: number) => {
    if (state.phase !== "pick" || state.busy) return;
    const card = state.cards.find((c) => c.number === cardNumber);
    if (!card) return;
    const place: StudyPlace = { cardId: card.id, index: card.number - 1 };
    setState({ ...state, busy: true });
    try { await savePlace(uid, classId, place); toast(`Your place is now card #${cardNumber}`); setState({ ...state, place, busy: false }); }
    catch (e) { toast(firestoreErrorMessage(e), "error"); setState({ ...state, busy: false }); }
  }, [state, uid, classId, toast]);

  const resetPlace = useCallback(async () => {
    if (state.phase !== "pick" || state.busy) return;
    setState({ ...state, busy: true });
    try { await clearPlace(uid, classId); toast("Your place is back at card #1"); setState({ ...state, place: null, busy: false }); }
    catch (e) { toast(firestoreErrorMessage(e), "error"); setState({ ...state, busy: false }); }
  }, [state, uid, classId, toast]);

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
    const ordered = byNumber(state.cards);
    const start = state.place ? resolveStartIndex(ordered.map((c) => c.id), state.place) : null;
    const shown = start !== null && ordered[start] ? { number: ordered[start]!.number } : null;
    return <StartPicker key={shown?.number ?? 0} classId={classId} className={state.name} cardCount={state.cards.length} busy={state.busy}
      place={shown} onPick={(c) => void pick(c)} onSetPlace={(n) => void setPlace(n)} onResetPlace={() => void resetPlace()} />;
  }
  return <StudyScreen key={state.key} uid={uid} classId={classId} className={state.name} cards={state.cards}
    init={state.init} onRestart={() => void load()} />;
}
