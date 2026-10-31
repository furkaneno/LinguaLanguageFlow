"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, SelectField, TextArea } from "@/components/ui/field";
import { saveClassLanguages } from "@/lib/firebase/languages";
import { DEFAULT_LANGUAGES, LANGUAGES, LANG_CODES, isLangCode, type ClassLanguages } from "@/lib/languages";
import { createClass, firestoreErrorMessage, updateClass } from "@/lib/firebase/repo";
import { classSchema, fieldErrors } from "@/lib/validation/schemas";
import type { ClassDoc } from "@/types";

interface Props { open: boolean; onClose: () => void; uid: string; existing?: ClassDoc; languages?: ClassLanguages; onSaved: (message: string) => void }

export function ClassFormDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={rest.existing ? "Edit class" : "Create class"}>
      <ClassForm onClose={onClose} {...rest} />
    </Dialog>
  );
}

function ClassForm({ uid, existing, languages, onSaved, onClose }: Omit<Props, "open">) {
  const [front, setFront] = useState((languages ?? DEFAULT_LANGUAGES).front);
  const [back, setBack] = useState((languages ?? DEFAULT_LANGUAGES).back);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs = fieldErrors(classSchema, { name, description });
    setErrors(errs ?? {}); setFormError(null);
    if (errs) return;
    const input = classSchema.parse({ name, description });
    setBusy(true);
    try {
      const classId = existing ? existing.id : await createClass(uid, input);
      if (existing) await updateClass(uid, existing.id, input);
      let languagesSaved = true;
      await saveClassLanguages(uid, classId, { front, back }).catch(() => { languagesSaved = false; });
      onSaved(languagesSaved ? (existing ? "Class updated" : "Class created") : "Saved, but the languages could not be saved. Open Edit to set them again.");
      onClose();
    } catch (err) { setFormError(firestoreErrorMessage(err)); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Class name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Daily English" autoFocus />
      <TextArea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} rows={3} />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Front side language" value={front} onChange={(e) => isLangCode(e.target.value) && setFront(e.target.value)}
          hint="The word or question you read aloud.">
          {LANG_CODES.map((c) => <option key={c} value={c}>{LANGUAGES[c].name}</option>)}
        </SelectField>
        <SelectField label="Back side language" value={back} onChange={(e) => isLangCode(e.target.value) && setBack(e.target.value)}
          hint="The meaning or answer you say next.">
          {LANG_CODES.map((c) => <option key={c} value={c}>{LANGUAGES[c].name}</option>)}
        </SelectField>
      </div>
      <p className="-mt-1 text-sm text-ink-muted">Both sides can be the same language, for example English → English for interview questions and answers.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={busy}>{existing ? "Save changes" : "Create class"}</Button>
      </div>
    </form>
  );
}
