"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError } from "@/components/ui/field";
import { ACCOUNT_DELETED_FLAG } from "@/config/app";
import { accountErrorMessage, deleteAccount } from "@/lib/firebase/account";

const flag = {
  set: () => { try { sessionStorage.setItem(ACCOUNT_DELETED_FLAG, "1"); } catch { /* storage unavailable: skip the notice */ } },
  clear: () => { try { sessionStorage.removeItem(ACCOUNT_DELETED_FLAG); } catch { /* nothing to clear */ } },
};

export const DELETE_CONFIRM_WORD = "DELETE";

interface Props { open: boolean; onClose: () => void; onDeleted: () => void }

export function DeleteAccountDialog({ open, onClose, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={() => { if (!busy) onClose(); }} locked={busy} title="Delete your account?">
      <DeleteForm busy={busy} setBusy={setBusy} onClose={onClose} onDeleted={onDeleted} />
    </Dialog>
  );
}

function DeleteForm({ busy, setBusy, onClose, onDeleted }:
  { busy: boolean; setBusy: (b: boolean) => void; onClose: () => void; onDeleted: () => void }) {
  const [word, setWord] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const ready = word.trim() === DELETE_CONFIRM_WORD && password.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true); setError(null); setProgress("Checking your password…");
    try {
      await deleteAccount(password, setProgress, flag.set); // the sign-in page shows "account deleted" once we land there
      onDeleted();
    } catch (err) {
      flag.clear();
      setError(accountErrorMessage(err));
      setBusy(false); setProgress(null);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="text-sm text-ink-muted">
        <p>This permanently deletes your account and everything in it:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>all your classes and cards</li>
          <li>your study history and saved places</li>
          <li>your sign-in account and settings</li>
        </ul>
        <p className="mt-2 font-medium text-ink">This can&apos;t be undone.</p>
      </div>
      <FormError message={error} />
      <Field label="Your password" type="password" autoComplete="current-password" value={password} disabled={busy}
        onChange={(e) => setPassword(e.target.value)} />
      <Field label={`Type ${DELETE_CONFIRM_WORD} to confirm`} value={word} disabled={busy} autoComplete="off" autoCapitalize="characters"
        onChange={(e) => setWord(e.target.value)} placeholder={DELETE_CONFIRM_WORD} />
      {progress && <p role="status" className="text-sm text-ink-muted">{progress}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" variant="danger" loading={busy} disabled={!ready}>Delete my account</Button>
      </div>
    </form>
  );
}
