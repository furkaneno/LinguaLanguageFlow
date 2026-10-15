import { describe, expect, it } from "vitest";
import { normalizeEnglish, normalizeTurkish } from "@/lib/text/normalize";
import { passes, scoreEnglishSpeech, scoreTurkishAnswer } from "@/lib/text/similarity";

describe("normalization", () => {
  it("ignores case, punctuation and whitespace in English", () => {
    expect(normalizeEnglish("  I paid  the ULTIMATE price, for it! ")).toBe("i paid the ultimate price for it");
  });
  it("expands contractions", () => {
    expect(normalizeEnglish("I'm sure")).toBe(normalizeEnglish("I am sure"));
    expect(normalizeEnglish("don't go")).toBe("do not go");
  });
  it("handles Turkish dotted/dotless i and diacritics", () => {
    expect(normalizeTurkish("Bedelini AĞIR ödedim.")).toBe("bedelini agir odedim");
    expect(normalizeTurkish("ISIK")).toBe(normalizeTurkish("ışık"));
  });
});

describe("threshold", () => {
  it("passes at exactly 80, fails at 79", () => {
    expect(passes(80, 80)).toBe(true);
    expect(passes(79, 80)).toBe(false);
  });
  it("never passes missing or invalid scores", () => {
    expect(passes(null, 80)).toBe(false);
    expect(passes(undefined, 80)).toBe(false);
    expect(passes(NaN, 80)).toBe(false);
  });
});

describe("scoring", () => {
  it("scores identical speech 100", () => {
    expect(scoreEnglishSpeech("I paid the ultimate price for it.", "i paid the ultimate price for it").score).toBe(100);
  });
  it("rejects unrelated text", () => {
    expect(scoreEnglishSpeech("I paid the ultimate price for it.", "what a lovely day today").score).toBeLessThan(30);
  });
  it("penalises omissions in sentences", () => {
    const r = scoreEnglishSpeech("I paid the ultimate price for it", "I paid price");
    expect(r.score).toBeLessThan(80);
    expect(r.wordFeedback.some((w) => !w.matched)).toBe(true);
  });
  it("is strict for single words", () => {
    expect(scoreEnglishSpeech("elevate", "elevator").score).toBeLessThan(80);
    expect(scoreEnglishSpeech("elevate", "Elevate.").score).toBe(100);
  });
  it("returns null for empty recognition instead of a fake score", () => {
    expect(scoreEnglishSpeech("hello", "   ").score).toBeNull();
    expect(scoreTurkishAnswer("merhaba", "").score).toBeNull();
  });
  it("accepts Turkish answers missing diacritics", () => {
    expect(scoreTurkishAnswer("Bedelini ağır ödedim.", "bedelini agir odedim").score).toBe(100);
  });
  it("labels score types honestly", () => {
    expect(scoreEnglishSpeech("a", "a").scoreType).toBe("speech-recognition-match");
    expect(scoreTurkishAnswer("a", "a").scoreType).toBe("text-similarity");
  });
  it("floors rather than rounds up", () => {
    // 4 of 5 words match -> 80 exactly passes; 7 of 9 would be 77.7 -> 77
    const r = scoreEnglishSpeech("one two three four five six seven eight nine", "one two three four five six seven");
    expect(r.score).toBe(77);
  });
});
