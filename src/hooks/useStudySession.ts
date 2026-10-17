"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ENGLISH_PASS_THRESHOLD, SPEECH, TURKISH_PASS_THRESHOLD } from "@/config/app";
import { recordAttempt, recordCardCompletion, saveSessionProgress, touchClassStudied, type CardStats } from "@/lib/firebase/study";
import { BrowserSynthesisProvider } from "@/lib/speech/browserSynthesis";
import { lexicalTurkishEvaluator, recognitionMatchAssessor } from "@/lib/speech/assessment";
import type { SpeechRecognitionProvider, SpeechSynthesisProvider } from "@/lib/speech/types";
import { WebSpeechRecognitionProvider } from "@/lib/speech/webSpeechRecognition";
import { runAttempt, type Stage } from "@/lib/study/attempt";
import { initialContext, studyReducer, type StudySnapshot } from "@/lib/study/machine";
import type { ScoreResult } from "@/lib/text/similarity";
import type { CardDoc } from "@/types";

export interface SessionInit { sessionId: string; cardIds: string[]; resume?: StudySnapshot; baseAttempts: number }
export interface LastAttempt { stage: Stage; result: ScoreResult; passed: boolean }
const emptyStats = (): CardStats => ({ englishAttempts: 0, turkishAttempts: 0, lastEnglishScore: null, lastTurkishScore: null });

export function useStudySession(uid: string, classId: string, cards: Map<string, CardDoc>, init: SessionInit) {
  const [ctx, dispatch] = useReducer(studyReducer, initialContext);
  const [last, setLast] = useState<LastAttempt | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [voiceMissing, setVoiceMissing] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const recognizer = useRef<SpeechRecognitionProvider | null>(null);
  const synth = useRef<SpeechSynthesisProvider | null>(null);
  const busy = useRef(false);
  const stats = useRef<CardStats>(emptyStats());
  const completionWritten = useRef(new Set<string>());
  const lastPersisted = useRef("");
  const persistedIndex = useRef(init.resume?.index ?? 0);
  const classTouched = useRef(false);
  const startedAt = useRef(Date.now());
  const [support, setSupport] = useState<{ recognition: boolean; secure: boolean; synthesis: boolean } | null>(null);

  const getRecognizer = () => (recognizer.current ??= new WebSpeechRecognitionProvider());
  const getSynth = () => (synth.current ??= new BrowserSynthesisProvider());
  const reportSaveError = useCallback(() => setSaveError("Your progress couldn't be saved. Check your connection; you can keep studying."), []);

  useEffect(() => {
    setSupport({ recognition: getRecognizer().isSupported(), secure: window.isSecureContext, synthesis: getSynth().isSupported() });
    dispatch({ type: "LOADED", cardIds: init.cardIds, ...(init.resume ? { resume: init.resume } : {}) });
    const check = () => setVoiceMissing(getSynth().hasVoiceFor(SPEECH.englishLang) === false);
    check();
    window.speechSynthesis?.addEventListener?.("voiceschanged", check);
    return () => {
      window.speechSynthesis?.removeEventListener?.("voiceschanged", check);
      recognizer.current?.abort();
      synth.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardId = ctx.cardIds[ctx.index];
  const card = cardId ? cards.get(cardId) : undefined;

  // Reset per-card state when the card changes.
  useEffect(() => { stats.current = emptyStats(); setHintShown(false); setLast(null); }, [ctx.index]);

    // Persist only at meaningful transitions (English passed, card completed, card skipped), never per UI event.
  useEffect(() => {
    const attemptCount = init.baseAttempts + ctx.attempts;
    let progress: Parameters<typeof saveSessionProgress>[2] | null = null;
    if (ctx.status === "turkish_ready") {
      persistedIndex.current = ctx.index;
      progress = { currentIndex: ctx.index, currentStage: "turkish", completedCardIds: ctx.completedIds, attemptCount, status: "active" };
    } else if (ctx.status === "card_completed") {
      const lastCard = ctx.index + 1 >= ctx.cardIds.length;
      persistedIndex.current = lastCard ? ctx.index : ctx.index + 1;
      progress = { currentIndex: lastCard ? ctx.index : ctx.index + 1, currentStage: lastCard ? "turkish" : "english",
        completedCardIds: ctx.completedIds, attemptCount, status: lastCard ? "completed" : "active" };
      if (cardId && !completionWritten.current.has(cardId)) {
        completionWritten.current.add(cardId); // guards against duplicate completion writes
        recordCardCompletion(uid, classId, cardId, card?.level ?? 0, stats.current).catch(reportSaveError);
        if (!classTouched.current) { classTouched.current = true; touchClassStudied(uid, classId).catch(() => {}); }
      }
    } else if (ctx.status === "english_ready") {
      // Only reached with a new index after a skip; normal advances were already saved at card completion.
      if (ctx.index === persistedIndex.current) return;
      persistedIndex.current = ctx.index;
      progress = { currentIndex: ctx.index, currentStage: "english", completedCardIds: ctx.completedIds, attemptCount, status: "active" };
    } else if (ctx.status === "session_completed") {
      if (lastPersisted.current.includes('"status":"completed"')) return; // already saved when the last card completed
      progress = { currentIndex: ctx.index, currentStage: "english", completedCardIds: ctx.completedIds, attemptCount, status: "completed" };
    }
    if (!progress) return;
    const key = JSON.stringify(progress);
    if (key === lastPersisted.current) return;
    lastPersisted.current = key;
    saveSessionProgress(uid, init.sessionId, progress).catch(reportSaveError);
  }, [ctx.status, ctx.index, ctx.cardIds.length, ctx.completedIds, ctx.attempts, cardId, card, uid, classId, init, reportSaveError]);

  // One automatic advance per completed card.
  useEffect(() => {
    if (ctx.status !== "card_completed") return;
    const from = ctx.index;
    const t = setTimeout(() => dispatch({ type: "ADVANCE", fromIndex: from }), SPEECH.advanceDelayMs);
    return () => clearTimeout(t);
  }, [ctx.status, ctx.index]);

  const stage: Stage = ctx.status.startsWith("turkish") || ctx.status === "card_completed" ? "turkish" : "english";

  const mic = useCallback(async () => {
    if (ctx.status === "english_recording" || ctx.status === "turkish_recording") { getRecognizer().stop(); return; }
    const ready = ["english_ready", "english_failed", "turkish_ready", "turkish_failed"].includes(ctx.status);
    if (!ready || busy.current || !card) return;
    busy.current = true;
    getSynth().cancel(); setSpeaking(false); setLast(null); setSaveError(null);
    const target = stage === "english" ? card.englishText : card.turkishMeaning;
    try {
      const outcome = await runAttempt(stage, {
        recognizer: getRecognizer(), dispatch,
        assess: (alts) => (stage === "english" ? recognitionMatchAssessor.assess(target, alts) : lexicalTurkishEvaluator.evaluate(target, alts)),
      });
      if (outcome.kind !== "scored") return;
      const s = stats.current;
      if (stage === "english") { s.englishAttempts++; s.lastEnglishScore = outcome.result.score; }
      else { s.turkishAttempts++; s.lastTurkishScore = outcome.result.score; }
      setLast({ stage, result: outcome.result, passed: outcome.passed });
      recordAttempt(uid, init.sessionId, {
        cardId: card.id, stage, recognizedText: outcome.result.recognizedText, score: outcome.result.score ?? 0,
        scoreType: outcome.result.scoreType, passed: outcome.passed, provider: outcome.provider,
      }).catch(reportSaveError);
    } finally { busy.current = false; }
  }, [ctx.status, card, stage, uid, init.sessionId, reportSaveError]);

  const skip = useCallback(() => {
    if (busy.current) return;
    getSynth().cancel(); setSpeaking(false);
    dispatch({ type: "SKIP" }); // the machine ignores this while recording or evaluating
  }, []);

  const listen = useCallback(async () => {
    if (!card || speaking) return;
    setSpeaking(true);
    await getSynth().speak(card.englishText, SPEECH.englishLang);
    setSpeaking(false);
  }, [card, speaking]);

  return {
    ctx, card, stage, last, support, hintShown, showHint: () => setHintShown(true),
    saveError, voiceMissing, speaking, mic, listen, skip,
    thresholds: { english: ENGLISH_PASS_THRESHOLD, turkish: TURKISH_PASS_THRESHOLD },
    elapsedMs: () => Date.now() - startedAt.current,
  };
}
