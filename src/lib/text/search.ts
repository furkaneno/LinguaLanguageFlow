import { normalizeTurkish } from "./normalize";

export interface Searchable { englishText: string; turkishMeaning: string; number: number }

/** Folds case, punctuation and Turkish diacritics: "agir" finds "ağır", "istanbul" finds "İstanbul". */
export const searchKey = (s: string): string => normalizeTurkish(s);

/**
 * Builds a search over English text, Turkish meaning and card number.
 * Every word you type must match (so "price bedelini" finds a card containing both).
 * "#12" matches card number 12 exactly; a plain number matches the number or the text.
 */
export function createSearch<T extends Searchable>(cards: T[]) {
  const index = cards.map((card) => ({ card, haystack: searchKey(`${card.englishText} ${card.turkishMeaning}`) }));

  return (query: string): T[] => {
    const words = query.trim().split(/\s+/).filter(Boolean);
    const tests: ((card: T, haystack: string) => boolean)[] = [];
    for (const word of words) {
      const numbered = /^#(\d+)$/.exec(word);
      if (numbered) {
        const n = Number(numbered[1]);
        tests.push((card) => card.number === n);
        continue;
      }
      const key = searchKey(word);
      if (!key) continue; // punctuation only
      const asNumber = /^\d+$/.test(key) ? Number(key) : null;
      tests.push((card, haystack) => haystack.includes(key) || card.number === asNumber);
    }
    if (tests.length === 0) return cards;
    return index.filter(({ card, haystack }) => tests.every((t) => t(card, haystack))).map((e) => e.card);
  };
}
