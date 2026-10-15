import { describe, expect, it } from "vitest";
import { cardKey, chunk, parseBulkText, parseCsv } from "@/lib/import/parse";

describe("bulk text import", () => {
  const sample = `I paid the ultimate price for it. | Bedelini ağır ödedim.
almost fumbled it|Neredeyse elinden kaçırıyordu

elevates my life | Hayatımı yükseltiyor`;
  it("parses rows, trims spaces and ignores blank lines", () => {
    const p = parseBulkText(sample);
    expect(p.validCount).toBe(3);
    expect(p.rows[1]).toMatchObject({ english: "almost fumbled it", turkish: "Neredeyse elinden kaçırıyordu" });
  });
  it("flags malformed and empty-side rows without discarding them", () => {
    const p = parseBulkText("no separator here\nhello |\n| merhaba");
    expect(p.invalidCount).toBe(3);
    expect(p.rows).toHaveLength(3);
    expect(p.rows[0]!.english).toBe("no separator here");
  });
  it("detects duplicates in paste and against existing cards", () => {
    const p = parseBulkText("Hello | Merhaba\nhello! | merhaba", [cardKey("Good", "İyi")]);
    expect(p.validCount).toBe(1);
    expect(p.duplicateCount).toBe(1);
    expect(parseBulkText("good | iyi", [cardKey("Good", "İyi")]).duplicateCount).toBe(1);
  });
  it("keeps extra pipes in the Turkish side", () => {
    expect(parseBulkText("a | b | c").rows[0]!.turkish).toBe("b | c");
  });
});

describe("csv import", () => {
  it("reads headers in any order, quotes and commas", () => {
    const p = parseCsv('Turkish,English\n"Merhaba, dünya",Hello world\nİyi,Good');
    if ("error" in p) throw new Error(p.error);
    expect(p.validCount).toBe(2);
    expect(p.rows[0]).toMatchObject({ english: "Hello world", turkish: "Merhaba, dünya" });
  });
  it("errors on missing headers", () => {
    expect(parseCsv("a,b\n1,2")).toHaveProperty("error");
  });
});

describe("chunk", () => {
  it("splits into Firestore-safe batches", () => {
    expect(chunk(Array.from({ length: 900 }, (_, i) => i), 400).map((c) => c.length)).toEqual([400, 400, 100]);
  });
});
