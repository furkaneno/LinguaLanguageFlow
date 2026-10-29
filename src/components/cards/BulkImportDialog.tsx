"use client";
import { AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, TextArea } from "@/components/ui/field";
import { parseBulkText, parseCsv } from "@/lib/import/parse";
import { firestoreErrorMessage, importCards } from "@/lib/firebase/repo";

interface Props {
  open: boolean; onClose: () => void; uid: string; classId: string;
  existingKeys: string[]; onImported: (count: number) => void;
}

export function BulkImportDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Bulk import" wide>
      <ImportBody onClose={onClose} {...rest} />
    </Dialog>
  );
}

const STATUS = {
  valid: { label: "Ready", Icon: CheckCircle2, cls: "text-emerald" },
  invalid: { label: "Invalid", Icon: AlertTriangle, cls: "text-err" },
  duplicate: { label: "Duplicate", Icon: Copy, cls: "text-ink-muted" },
} as const;

function ImportBody({ uid, classId, existingKeys, onImported, onClose }: Omit<Props, "open">) {
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const preview = useMemo(() => parseBulkText(text, existingKeys), [text, existingKeys]);
  const busy = progress !== null;

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileError(null);
    const parsed = parseCsv(await file.text(), []);
    if ("error" in parsed) { setFileError(parsed.error); return; }
    // Load into the editor so rows can be corrected before importing.
    setText(parsed.rows.map((r) => `${r.english} | ${r.turkish}`).join("\n"));
  }

  async function run() {
    const rows = preview.rows.filter((r) => r.status === "valid");
    if (busy || rows.length === 0) return;
    setError(null); setProgress({ done: 0, total: rows.length });
    try {
      await importCards(uid, classId, rows, (done, total) => setProgress({ done, total }));
      onImported(rows.length);
      onClose();
    } catch (e) {
      setError(`${firestoreErrorMessage(e)} Cards already imported were kept; fix the text and import the rest.`);
      setProgress(null);
    }
  }

  const removeBad = () =>
    setText(preview.rows.filter((r) => r.status === "valid").map((r) => `${r.english} | ${r.turkish}`).join("\n"));

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Paste one card per line as <code className="rounded bg-blush/60 px-1.5 py-0.5">English text | Turkish meaning</code>. Or choose a UTF-8 CSV with <code className="rounded bg-blush/60 px-1.5 py-0.5">english</code> and <code className="rounded bg-blush/60 px-1.5 py-0.5">turkish</code> column headers; it loads here so you can fix rows first.
      </p>
      <FormError message={error ?? fileError} />
      <TextArea label="Cards" rows={7} value={text} onChange={(e) => setText(e.target.value)} disabled={busy}
        placeholder={"almost fumbled it | Neredeyse elinden kaçırıyordu\nelevates my life | Hayatımı yükseltiyor"} />
      <div>
        <label className="text-sm font-medium" htmlFor="csv">CSV file</label>
        <input id="csv" type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
          className="mt-1.5 block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-blush file:px-4 file:font-medium" />
      </div>

      {preview.rows.length > 0 && (
        <div>
          <p role="status" className="text-sm font-medium">
            {preview.validCount} ready · {preview.invalidCount} invalid · {preview.duplicateCount} duplicate
          </p>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-blush"><tr>
                <th className="px-3 py-2 font-medium">Line</th><th className="px-3 py-2 font-medium">English</th>
                <th className="px-3 py-2 font-medium">Turkish</th><th className="px-3 py-2 font-medium">Status</th>
              </tr></thead>
              <tbody>
                {preview.rows.map((r) => {
                  const s = STATUS[r.status];
                  return (
                    <tr key={r.line} className="border-t border-line align-top">
                      <td className="px-3 py-2 text-ink-muted">{r.line}</td>
                      <td className="px-3 py-2">{r.english}</td>
                      <td className="px-3 py-2">{r.turkish}</td>
                      <td className={`px-3 py-2 ${s.cls}`}>
                        <span className="inline-flex items-center gap-1.5"><s.Icon className="h-4 w-4 shrink-0" aria-hidden />{s.label}</span>
                        {r.error && <span className="block text-xs">{r.error}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {preview.invalidCount + preview.duplicateCount > 0 && (
            <p className="mt-2 text-sm text-ink-muted">
              Only ready rows are imported. Edit the text above to fix the others, or{" "}
              <button type="button" onClick={removeBad} disabled={busy} className="font-medium text-brand-light underline">remove them from the text</button>.
            </p>
          )}
        </div>
      )}

      {progress && <p role="status" className="text-sm">Imported {progress.done} of {progress.total}…</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button onClick={run} loading={busy} disabled={preview.validCount === 0}>
          {preview.validCount ? `Import ${preview.validCount} ${preview.validCount === 1 ? "card" : "cards"}` : "Import cards"}
        </Button>
      </div>
    </div>
  );
}
