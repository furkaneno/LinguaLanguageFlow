import { LIMITS } from "@/config/app";
import { normalizeEnglish, normalizeTurkish } from "@/lib/text/normalize";

export interface ImportRow {
  line: number;
  english: string;
  turkish: string;
  status: "valid" | "invalid" | "duplicate";
  error?: string;
}

export interface ImportPreview {
  rows: ImportRow[];
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
}

export const cardKey = (en: string, tr: string) => `${normalizeEnglish(en)}|${normalizeTurkish(tr)}`;

function validate(line: number, english: string, turkish: string, seen: Set<string>): ImportRow {
  const en = english.trim(), tr = turkish.trim();
  if (!en) return { line, english: en, turkish: tr, status: "invalid", error: "English text is empty." };
  if (!tr) return { line, english: en, turkish: tr, status: "invalid", error: "Turkish meaning is empty." };
  if (en.length > LIMITS.textMax || tr.length > LIMITS.textMax)
    return { line, english: en, turkish: tr, status: "invalid", error: `Text is longer than ${LIMITS.textMax} characters.` };
  const key = cardKey(en, tr);
  if (seen.has(key)) return { line, english: en, turkish: tr, status: "duplicate", error: "Duplicate of an existing or earlier card." };
  seen.add(key);
  return { line, english: en, turkish: tr, status: "valid" };
}

function summarize(rows: ImportRow[]): ImportPreview {
  const count = (s: ImportRow["status"]) => rows.filter((r) => r.status === s).length;
  return { rows, validCount: count("valid"), invalidCount: count("invalid"), duplicateCount: count("duplicate") };
}

/** Format: `English text | Turkish meaning`, one card per line. Splits on the first "|". Blank lines are ignored. */
export function parseBulkText(text: string, existingKeys: Iterable<string> = []): ImportPreview {
  const seen = new Set(existingKeys);
  const rows: ImportRow[] = [];
  text.replace(/^\uFEFF/, "").split(/\r?\n/).forEach((raw, i) => {
    if (!raw.trim()) return;
    const idx = raw.indexOf("|");
    if (idx === -1) {
      rows.push({ line: i + 1, english: raw.trim(), turkish: "", status: "invalid", error: 'Missing "|" separator.' });
      return;
    }
    rows.push(validate(i + 1, raw.slice(0, idx), raw.slice(idx + 1), seen));
  });
  return summarize(rows);
}

/** Minimal RFC 4180 parser (quoted fields, escaped quotes, embedded newlines). */
export function parseCsvRecords(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim())) out.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) out.push(row);
  return out;
}

/** CSV must be UTF-8 with a header row containing `english` and `turkish` columns (any order, case-insensitive). */
export function parseCsv(text: string, existingKeys: Iterable<string> = []): ImportPreview | { error: string } {
  const records = parseCsvRecords(text);
  const header = records[0]?.map((h) => h.trim().toLowerCase()) ?? [];
  const ei = header.indexOf("english"), ti = header.indexOf("turkish");
  if (ei === -1 || ti === -1) return { error: 'CSV needs a header row with "english" and "turkish" columns.' };
  const seen = new Set(existingKeys);
  return summarize(records.slice(1).map((r, i) => validate(i + 2, r[ei] ?? "", r[ti] ?? "", seen)));
}

export function chunk<T>(items: T[], size: number = LIMITS.batchSize): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
