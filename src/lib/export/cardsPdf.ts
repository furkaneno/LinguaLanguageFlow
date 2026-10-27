import type { TDocumentDefinitions } from "pdfmake/interfaces";

export interface ExportCard { number: number; englishText: string; turkishMeaning: string }

const BURGUNDY = "#4A1D32";
const MUTED = "#77736D";

/** Pure document definition (testable without a browser). Roboto covers Turkish letters. */
export function buildCardsPdf(className: string, cards: ExportCard[], exportedAt: Date, appName: string): TDocumentDefinitions {
  const date = exportedAt.toLocaleDateString("tr-TR");
  const header = [
    { text: "#", style: "th" },
    { text: "English", style: "th" },
    { text: "Turkish", style: "th" },
  ];
  const rows = cards.map((c) => [
    { text: String(c.number), color: MUTED },
    { text: c.englishText },
    { text: c.turkishMeaning },
  ]);
  return {
    info: { title: `${className} - ${appName}`, creator: appName },
    pageSize: "A4",
    pageMargins: [40, 52, 40, 56],
    defaultStyle: { font: "Roboto", fontSize: 11, lineHeight: 1.2 },
    content: [
      { text: className, style: "title" },
      { text: `${cards.length} ${cards.length === 1 ? "card" : "cards"}  ·  ${date}  ·  ${appName}`, style: "meta" },
      {
        table: { headerRows: 1, dontBreakRows: true, widths: [30, "*", "*"], body: [header, ...rows] },
        layout: {
          fillColor: (row: number) => (row === 0 ? BURGUNDY : row % 2 === 0 ? "#F7EFE3" : null),
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingTop: () => 6,
          paddingBottom: () => 6,
          paddingLeft: () => 8,
          paddingRight: () => 8,
        },
      },
    ],
    footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: "center", fontSize: 9, color: MUTED, margin: [0, 20, 0, 0] }),
    styles: {
      title: { fontSize: 22, bold: true, color: BURGUNDY, margin: [0, 0, 0, 4] },
      meta: { fontSize: 10, color: MUTED, margin: [0, 0, 0, 16] },
      th: { bold: true, color: "#FFFFFF" },
    },
  };
}

export const pdfFileName = (className: string) =>
  `${className.replace(/[\\/:*?"<>|]+/g, "").trim().replace(/\s+/g, "-") || "cards"}.pdf`;
