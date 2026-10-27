export interface ClassDoc {
  id: string; name: string; description: string; cardCount: number;
  createdAt: Date | null; lastStudiedAt: Date | null;
}
export interface CardDoc {
  id: string; classId: string; englishText: string; turkishMeaning: string; createdAt: Date | null;
  /** Position in the class (1 = first card added). Derived when loading, so it shifts if an earlier card is deleted. */
  number: number;
  /** Spaced-repetition state; absent until the card is first completed. */
  level: number; nextReviewAt: Date | null; completedSessions: number;
}
export interface SessionDoc {
  id: string; classId: string; cardIds: string[]; currentIndex: number; currentStage: "english" | "turkish";
  completedCardIds: string[]; attemptCount: number; status: "active" | "completed" | "abandoned";
}
