"use client";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError, TextArea } from "@/components/ui/field";
import { createCard, firestoreErrorMessage, updateCard } from "@/lib/firebase/repo";
import { cardSchema, fieldErrors } from "@/lib/validation/schemas";
import type { CardDoc } from "@/types";

interface Props {
  open: boolean; onClose: () => void; uid: string; classId: string; existing?: CardDoc;
  onSaved: (message: string) => void;
}

export function CardFormDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={rest.existing ? "Edit card" : "Add card"}>
      <CardForm onClose={onClose} {...rest} />
    </Dialog>
  );
}

function CardForm({ uid, classId, existing, onSaved, onClose }: Omit<Props, "open">) {
  const [english, setEnglish] = useState(existing?.englishText ?? "");
  const [turkish, setTurkish] = useState(existing?.turkishMeaning ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const englishRef = useRef<HTMLDivElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // prevents duplicate submissions
    const data = { englishText: english, turkishMeaning: turkish };
    const errs = fieldErrors(cardSchema, data);
    setErrors(errs ?? {}); setFormError(null);
    if (errs) return;
    const input = cardSchema.parse(data);
    setBusy(true);
    try {
      if (existing) {
        await updateCard(uid, classId, existing, input);
        onSaved("Card updated");
        onClose();
      } else {
        await createCard(uid, classId, input);
        onSaved("Card saved");
        setEnglish(""); setTurkish("");
        englishRef.current?.querySelector("textarea")?.focus(); // keep adding
      }
    } catch (err) { setFormError(firestoreErrorMessage(err)); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <div ref={englishRef}>
        <TextArea label="English text" value={english} onChange={(e) => setEnglish(e.target.value)} error={errors.englishText}
          rows={3} lang="en" placeholder="I paid the ultimate price for it." autoFocus />
      </div>
      <TextArea label="Turkish meaning" value={turkish} onChange={(e) => setTurkish(e.target.value)} error={errors.turkishMeaning}
        rows={3} lang="tr" placeholder="Bedelini ağır ödedim." />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>{existing ? "Cancel" : "Done"}</Button>
        <Button type="submit" loading={busy}>{existing ? "Save changes" : "Save card"}</Button>
      </div>
    </form>
  );
}
