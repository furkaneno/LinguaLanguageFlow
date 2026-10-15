"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormError, TextArea } from "@/components/ui/field";
import { createClass, firestoreErrorMessage, updateClass } from "@/lib/firebase/repo";
import { classSchema, fieldErrors } from "@/lib/validation/schemas";
import type { ClassDoc } from "@/types";

interface Props { open: boolean; onClose: () => void; uid: string; existing?: ClassDoc; onSaved: (message: string) => void }

export function ClassFormDialog({ open, onClose, ...rest }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title={rest.existing ? "Edit class" : "Create class"}>
      <ClassForm onClose={onClose} {...rest} />
    </Dialog>
  );
}

function ClassForm({ uid, existing, onSaved, onClose }: Omit<Props, "open">) {
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
      if (existing) await updateClass(uid, existing.id, input); else await createClass(uid, input);
      onSaved(existing ? "Class updated" : "Class created");
      onClose();
    } catch (err) { setFormError(firestoreErrorMessage(err)); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={formError} />
      <Field label="Class name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} placeholder="Daily English" autoFocus />
      <TextArea label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} error={errors.description} rows={3} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit" loading={busy}>{existing ? "Save changes" : "Create class"}</Button>
      </div>
    </form>
  );
}
