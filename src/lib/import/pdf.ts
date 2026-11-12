/**
 * Reads a PDF whose lines look like `front | back` and returns its text lines, which then go through the same
 * preview and validation as pasted text. Runs entirely in the browser; the file never leaves the device.
 */
export const PDF_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_MAX_PAGES = 300;

export type PdfImportErrorCode = "not_pdf" | "too_large" | "password" | "no_text" | "failed";
export class PdfImportError extends Error {
  constructor(readonly code: PdfImportErrorCode) { super(code); this.name = "PdfImportError"; }
}

export function pdfImportMessage(err: unknown): string {
  switch ((err as PdfImportError)?.code) {
    case "not_pdf": return "That doesn't look like a PDF file.";
    case "too_large": return "That PDF is too large (the limit is 10 MB).";
    case "password": return "That PDF is password-protected. Remove the password and try again.";
    case "no_text": return "No text was found in that PDF. Scanned PDFs (pictures of text) can't be read; use a PDF with real text.";
    default: return "The PDF couldn't be read. Try saving it again as a PDF from your document app.";
  }
}

export interface TextItemLike { str: string; hasEOL?: boolean; width?: number; transform?: number[] }

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Rebuilds visual lines from pdf.js text pieces: a new line on a change of height, a space where words are apart. */
export function linesFromTextItems(items: TextItemLike[]): string[] {
  const lines: string[] = [];
  let cur = "", lastY: number | null = null, lastEnd: number | null = null;
  const push = () => { const t = clean(cur); if (t) lines.push(t); cur = ""; lastY = null; lastEnd = null; };
  for (const it of items) {
    const x = it.transform?.[4], y = it.transform?.[5];
    const size = Math.abs(it.transform?.[3] ?? 0) || 10;
    if (cur && lastY !== null && typeof y === "number" && Math.abs(y - lastY) > size * 0.5) push();
    if (cur && lastEnd !== null && typeof x === "number" && x - lastEnd > size * 0.25 && !/\s$/.test(cur) && !/^\s/.test(it.str)) cur += " ";
    cur += it.str;
    if (typeof y === "number") lastY = y;
    if (typeof x === "number" && typeof it.width === "number") lastEnd = x + it.width;
    if (it.hasEOL) push();
  }
  push();
  return lines;
}

/** For long answers that wrap: a line without "|" belongs to the card above it. Off by default, since page numbers would also be joined. */
export function joinWrappedLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (line.includes("|") || prev === undefined || !prev.includes("|")) out.push(line);
    else out[out.length - 1] = `${prev} ${line}`;
  }
  return out;
}

interface PdfPageLike { getTextContent(): Promise<{ items: unknown[] }> }
interface PdfDocLike { numPages: number; getPage(n: number): Promise<PdfPageLike>; destroy(): Promise<void> }
export interface PdfJsLike { getDocument(src: { data: Uint8Array; isEvalSupported?: boolean }): { promise: Promise<PdfDocLike> } }

/** Loads pdf.js only when a PDF is chosen, so it never slows down normal pages. The legacy build also runs on older iPhones. */
export async function loadPdfJs(): Promise<PdfJsLike> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs as unknown as PdfJsLike;
}

export async function extractPdfLines(data: ArrayBuffer, load: () => Promise<PdfJsLike> = loadPdfJs): Promise<string[]> {
  if (data.byteLength > PDF_MAX_BYTES) throw new PdfImportError("too_large");
  const head = new TextDecoder("latin1").decode(new Uint8Array(data.slice(0, 1024)));
  if (!head.includes("%PDF-")) throw new PdfImportError("not_pdf");

  let doc: PdfDocLike;
  try {
    doc = await (await load()).getDocument({ data: new Uint8Array(data.slice(0)), isEvalSupported: false }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") throw new PdfImportError("password");
    if (name === "InvalidPDFException" || name === "MissingPDFException") throw new PdfImportError("not_pdf");
    throw new PdfImportError("failed");
  }
  const lines: string[] = [];
  try {
    for (let n = 1; n <= Math.min(doc.numPages, PDF_MAX_PAGES); n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      lines.push(...linesFromTextItems(content.items as TextItemLike[]));
    }
  } catch { throw new PdfImportError("failed"); }
  finally { void doc.destroy().catch(() => {}); }
  if (lines.length === 0) throw new PdfImportError("no_text");
  return lines;
}
