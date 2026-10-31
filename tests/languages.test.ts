import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/import/parse";
import { DEFAULT_LANGUAGES, LANGUAGES, LANG_CODES, isLangCode, pairName, pairShort } from "@/lib/languages";
import { normalizeSpanish, normalizerFor } from "@/lib/text/normalize";
import { scoreSpoken } from "@/lib/text/similarity";
import { createSearch } from "@/lib/text/search";

describe("languages", () => {
  it("offers English, Turkish and Spanish, and old classes keep English to Turkish", () => {
    expect(LANG_CODES).toEqual(["en", "tr", "es"]);
    expect(DEFAULT_LANGUAGES).toEqual({ front: "en", back: "tr" });
    expect(LANGUAGES.es.speech).toBe("es-ES");
    expect(LANGUAGES.tr.speech).toBe("tr-TR");
  });
  it("validates codes and labels pairs", () => {
    expect(isLangCode("es")).toBe(true);
    expect(isLangCode("de")).toBe(false);
    expect(isLangCode("toString")).toBe(false);
    expect(pairShort({ front: "es", back: "tr" })).toBe("ES → TR");
    expect(pairName({ front: "en", back: "en" })).toBe("English → English");
  });
});

describe("Spanish scoring", () => {
  it("ignores accents, ¿ ¡ and case", () => {
    expect(normalizeSpanish("¿Cómo estás?")).toBe("como estas");
    expect(scoreSpoken("¡Qué bonita canción!", "que bonita cancion", "es", "text-similarity").score).toBe(100);
  });
  it("keeps ñ meaningful", () => {
    expect(normalizeSpanish("año")).not.toBe(normalizeSpanish("ano"));
    expect(scoreSpoken("el año", "el ano", "es", "text-similarity").score).toBeLessThan(80);
  });
  it("picks the right normalizer per language", () => {
    expect(normalizerFor("tr")("Ağır")).toBe("agir");
    expect(normalizerFor("en")("I'm here")).toBe("i am here");
    expect(normalizerFor("es")("Más")).toBe("mas");
  });
});

describe("any language pair", () => {
  it("scores English answers for English questions (contractions allowed)", () => {
    const target = "I'm calm under pressure and I enjoy helping people.";
    expect(scoreSpoken(target, "i am calm under pressure and i enjoy helping people", "en", "text-similarity").score).toBe(100);
  });
  it("scores Turkish answers for Turkish questions", () => {
    expect(scoreSpoken("Çünkü insanlara yardım etmeyi seviyorum.", "cunku insanlara yardim etmeyi seviyorum", "tr", "text-similarity").score).toBe(100);
  });
  it("omitting part of a long answer lowers the score", () => {
    const target = "Because I enjoy helping people and I stay calm under pressure and I love travelling";
    expect(scoreSpoken(target, "because I enjoy helping people", "en", "text-similarity").score).toBeLessThan(80);
  });
});

describe("search and import across languages", () => {
  it("finds Spanish text without typing accents", () => {
    const cards = [{ id: "a", number: 1, englishText: "¿Dónde está la canción?", turkishMeaning: "Şarkı nerede?" }];
    expect(createSearch(cards)("cancion")).toHaveLength(1);
    expect(createSearch(cards)("sarki")).toHaveLength(1);
  });
  it("CSV accepts front/back and question/answer headers", () => {
    for (const header of ["front,back", "question,answer", "Question,Answer", "english,turkish"]) {
      const p = parseCsv(`${header}\nWhy flying?,Because I love it`);
      if ("error" in p) throw new Error(p.error);
      expect(p.rows[0]).toMatchObject({ english: "Why flying?", turkish: "Because I love it", status: "valid" });
    }
  });
});
