import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { buildCardsPdf, pdfFileName } from "@/lib/export/cardsPdf";

const require = createRequire(import.meta.url);
const cards = [
  { number: 1, englishText: "I paid the ultimate price for it.", turkishMeaning: "Bedelini ağır ödedim." },
  { number: 2, englishText: "elevates my life", turkishMeaning: "Hayatımı yükseltiyor" },
  { number: 3, englishText: "draw lessons from setbacks", turkishMeaning: "Aksiliklerden ders çıkarmak" },
  { number: 4, englishText: "İstanbul çok büyük, şehir güzel: ĞÜŞİÖÇ ğüşıöç", turkishMeaning: "Turkish test" },
];

describe("cards PDF", () => {
  it("builds one header row plus one row per card, with numbers", () => {
    const def = buildCardsPdf("Daily English", cards, new Date("2026-10-24T10:00:00Z"), "Lingua Flow");
    const table = (def.content as { table?: { body: unknown[][]; headerRows: number } }[]).find((c) => c.table)!.table!;
    expect(table.headerRows).toBe(1);
    expect(table.body).toHaveLength(cards.length + 1);
    expect(JSON.stringify(table.body[1])).toContain("Bedelini ağır ödedim.");
    expect(JSON.stringify(table.body[1])).toContain('"1"');
  });
  it("produces a real PDF with the bundled font (Turkish letters included)", async () => {
    const pdfmake = require("pdfmake");
    const dir = require.resolve("pdfmake/package.json").replace("package.json", "fonts/Roboto/");
    pdfmake.addFonts({ Roboto: { normal: dir + "Roboto-Regular.ttf", bold: dir + "Roboto-Medium.ttf", italics: dir + "Roboto-Italic.ttf", bolditalics: dir + "Roboto-MediumItalic.ttf" } });
    const def = buildCardsPdf("Daily English", cards, new Date("2026-10-24T10:00:00Z"), "Lingua Flow");
    const buffer: Buffer = await pdfmake.createPdf(def).getBuffer();
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(2000);
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, buffer);
  });
  it("makes safe file names", () => {
    expect(pdfFileName('My: "class"/1')).toBe("My-class1.pdf");
    expect(pdfFileName("   ")).toBe("cards.pdf");
    expect(pdfFileName("Günlük İngilizce")).toBe("Günlük-İngilizce.pdf");
  });
});
