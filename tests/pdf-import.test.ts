import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { parseBulkText } from "@/lib/import/parse";
import {
  extractPdfLines, joinWrappedLines, linesFromTextItems, PDF_MAX_BYTES, pdfImportMessage, type PdfJsLike,
} from "@/lib/import/pdf";

const require = createRequire(import.meta.url);
const load = () => import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as Promise<PdfJsLike>;

async function makePdf(def: Record<string, unknown>): Promise<ArrayBuffer> {
  const pdfmake = require("pdfmake");
  const dir = require.resolve("pdfmake/package.json").replace("package.json", "fonts/Roboto/");
  pdfmake.addFonts({ Roboto: { normal: dir + "Roboto-Regular.ttf", bold: dir + "Roboto-Medium.ttf", italics: dir + "Roboto-Italic.ttf", bolditalics: dir + "Roboto-MediumItalic.ttf" } });
  const buf: Buffer = await pdfmake.createPdf({ defaultStyle: { font: "Roboto", fontSize: 12 }, ...def }).getBuffer();
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}
const lines = (...l: string[]) => ({ content: l.map((text) => ({ text })) });

describe("reading a real PDF", () => {
  it("returns each line, with Turkish and Spanish letters intact", async () => {
    const pdf = await makePdf(lines("hello | merhaba", "I paid the ultimate price for it. | Bedelini ağır ödedim.", "¿Por qué quieres volar? | Çünkü şehirleri görmeyi seviyorum."));
    expect(await extractPdfLines(pdf, load)).toEqual([
      "hello | merhaba", "I paid the ultimate price for it. | Bedelini ağır ödedim.", "¿Por qué quieres volar? | Çünkü şehirleri görmeyi seviyorum.",
    ]);
  });
  it("feeds straight into the normal import preview", async () => {
    const pdf = await makePdf(lines("Title of my list", "hello | merhaba", "good morning|günaydın", "draw lessons from setbacks | Aksiliklerden ders çıkarmak"));
    const preview = parseBulkText((await extractPdfLines(pdf, load)).join("\n"));
    expect(preview.validCount).toBe(3);
    expect(preview.invalidCount).toBe(1); // the title line is flagged, not silently dropped
    expect(preview.rows[2]).toMatchObject({ english: "good morning", turkish: "günaydın" });
  });
  it("reads every page", async () => {
    const many = Array.from({ length: 150 }, (_, i) => `word${i} | kelime${i}`);
    const out = await extractPdfLines(await makePdf(lines(...many)), load);
    expect(out).toHaveLength(150);
    expect(out[149]).toBe("word149 | kelime149");
  });
  it("long answers that wrap can be joined back together", async () => {
    const long = "Why do you want to be a flight attendant? | Because I enjoy helping people and I stay calm under pressure and I love meeting people from many different cultures every day";
    const pdf = await makePdf({ pageMargins: [150, 60, 150, 60], content: [{ text: long }, { text: "next | sonraki" }] });
    const raw = await extractPdfLines(pdf, load);
    expect(raw.length).toBeGreaterThan(2);
    expect(joinWrappedLines(raw)).toEqual([long, "next | sonraki"]);
  });
  it("reports a password-protected PDF", async () => {
    const pdf = await makePdf({ ...lines("a | b"), userPassword: "secret", ownerPassword: "owner" });
    await expect(extractPdfLines(pdf, load)).rejects.toMatchObject({ code: "password" });
  });
  it("reports a PDF with no text (like a scan)", async () => {
    const pdf = await makePdf({ content: [{ canvas: [{ type: "rect", x: 0, y: 0, w: 100, h: 50 }] }] });
    await expect(extractPdfLines(pdf, load)).rejects.toMatchObject({ code: "no_text" });
  });
});

describe("bad files", () => {
  it("rejects files that are not PDFs, and oversized ones before reading them", async () => {
    await expect(extractPdfLines(new TextEncoder().encode("hello | merhaba").buffer as ArrayBuffer, load)).rejects.toMatchObject({ code: "not_pdf" });
    await expect(extractPdfLines(new ArrayBuffer(PDF_MAX_BYTES + 1), load)).rejects.toMatchObject({ code: "too_large" });
  });
  it("turns a broken PDF into a clear error", async () => {
    const broken = new TextEncoder().encode("%PDF-1.4\nthis is not really a pdf").buffer as ArrayBuffer;
    await expect(extractPdfLines(broken, load)).rejects.toMatchObject({ code: expect.stringMatching(/not_pdf|failed/) });
  });
  it("explains every error in plain words", () => {
    for (const code of ["not_pdf", "too_large", "password", "no_text", "failed"]) expect(pdfImportMessage({ code }).length).toBeGreaterThan(20);
  });
});

describe("line rebuilding", () => {
  const item = (str: string, x: number, y: number, width: number, extra: object = {}) => ({ str, width, transform: [12, 0, 0, 12, x, y], ...extra });
  it("starts a new line when the height changes and trims spaces", () => {
    expect(linesFromTextItems([item("hello |", 10, 700, 40), item("  merhaba ", 55, 700, 40), item("second | line", 10, 680, 60)])).toEqual(["hello | merhaba", "second | line"]);
  });
  it("adds a space where words are apart, but not inside a word", () => {
    expect(linesFromTextItems([item("good", 10, 700, 24), item("morning", 40, 700, 40)])).toEqual(["good morning"]);
    expect(linesFromTextItems([item("mer", 10, 700, 18), item("haba", 28, 700, 24)])).toEqual(["merhaba"]);
  });
  it("respects end-of-line markers and skips empty lines", () => {
    expect(linesFromTextItems([item("a | b", 10, 700, 30, { hasEOL: true }), item("", 0, 700, 0, { hasEOL: true }), item("c | d", 10, 700, 30)])).toEqual(["a | b", "c | d"]);
  });
  it("joins only continuation lines that follow a card", () => {
    expect(joinWrappedLines(["Title", "a | b", "more of b", "c | d"])).toEqual(["Title", "a | b more of b", "c | d"]);
    expect(joinWrappedLines([])).toEqual([]);
  });
});
