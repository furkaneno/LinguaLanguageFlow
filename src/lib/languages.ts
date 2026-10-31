/**
 * Languages a class can use for each side of its cards. To add one (say German), add an entry here
 * and a normalizer in text/normalize.ts; everything else (speech, scoring, labels, PDF) follows.
 * `speech` is the BCP-47 tag used for the microphone and the voice that reads a card aloud.
 */
export const LANGUAGES = {
  en: { name: "English", short: "EN", speech: "en-US", sampleFront: "Why do you want to be a flight attendant?", sampleBack: "Because I enjoy helping people and I stay calm under pressure." },
  tr: { name: "Turkish", short: "TR", speech: "tr-TR", sampleFront: "Neden kabin memuru olmak istiyorsunuz?", sampleBack: "Çünkü insanlara yardım etmeyi seviyorum ve baskı altında sakin kalırım." },
  es: { name: "Spanish", short: "ES", speech: "es-ES", sampleFront: "¿Por qué quieres ser auxiliar de vuelo?", sampleBack: "Porque disfruto ayudando a las personas y mantengo la calma bajo presión." },
} as const;

export type LangCode = keyof typeof LANGUAGES;
export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

/** `front` is what you read aloud (word or question); `back` is what you then say (meaning or answer). */
export interface ClassLanguages { front: LangCode; back: LangCode }
export const DEFAULT_LANGUAGES: ClassLanguages = { front: "en", back: "tr" };

export const isLangCode = (v: unknown): v is LangCode => typeof v === "string" && (LANG_CODES as string[]).includes(v);

export const pairShort = (l: ClassLanguages) => `${LANGUAGES[l.front].short} → ${LANGUAGES[l.back].short}`;
export const pairName = (l: ClassLanguages) => `${LANGUAGES[l.front].name} → ${LANGUAGES[l.back].name}`;
