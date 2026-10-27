import { describe, expect, it } from "vitest";
import { createSearch } from "@/lib/text/search";

const cards = [
  { id: "a", number: 1, englishText: "I paid the ultimate price for it.", turkishMeaning: "Bedelini ağır ödedim." },
  { id: "b", number: 2, englishText: "almost fumbled it", turkishMeaning: "Neredeyse elinden kaçırıyordu" },
  { id: "c", number: 12, englishText: "Istanbul is huge", turkishMeaning: "İstanbul çok büyük" },
  { id: "d", number: 3, englishText: "elevates my life", turkishMeaning: "Hayatımı yükseltiyor" },
];
const ids = (q: string) => createSearch(cards)(q).map((c) => c.id);

describe("card search", () => {
  it("finds English text, ignoring case and punctuation", () => {
    expect(ids("ULTIMATE price")).toEqual(["a"]);
    expect(ids("fumbled,")).toEqual(["b"]);
  });
  it("finds Turkish text, with or without Turkish letters", () => {
    expect(ids("ağır")).toEqual(["a"]);
    expect(ids("agir")).toEqual(["a"]);
    expect(ids("hayatimi yukseltiyor")).toEqual(["d"]);
    expect(ids("kaçırıyordu")).toEqual(["b"]);
  });
  it("handles dotted and dotless I", () => {
    expect(ids("istanbul").sort()).toEqual(["c"]);
    expect(ids("İSTANBUL")).toEqual(["c"]);
  });
  it("needs every word, and words can mix English and Turkish", () => {
    expect(ids("price bedelini")).toEqual(["a"]);
    expect(ids("price istanbul")).toEqual([]);
  });
  it("searches by card number", () => {
    expect(ids("#12")).toEqual(["c"]);
    expect(ids("#1")).toEqual(["a"]); // exact, not "#12"
    expect(ids("3")).toEqual(["d"]);
  });
  it("returns everything for an empty or punctuation-only query", () => {
    expect(ids("")).toHaveLength(4);
    expect(ids("  ")).toHaveLength(4);
    expect(ids("...")).toHaveLength(4);
  });
  it("returns nothing when nothing matches", () => {
    expect(ids("zzzz")).toEqual([]);
  });
});
