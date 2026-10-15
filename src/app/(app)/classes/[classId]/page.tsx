"use client";
import { ArrowLeft, FileUp, Pencil, Play, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUid } from "@/components/auth/AuthProvider";
import { BulkImportDialog } from "@/components/cards/BulkImportDialog";
import { CardFormDialog } from "@/components/cards/CardFormDialog";
import { ClassFormDialog } from "@/components/classes/ClassFormDialog";
import { Splash } from "@/components/layout/Splash";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { cardKey } from "@/lib/import/parse";
import { deleteCard, firestoreErrorMessage, getClass, listCards } from "@/lib/firebase/repo";
import type { CardDoc, ClassDoc } from "@/types";

export default function ClassPage() {
  const uid = useUid();
  const { classId } = useParams<{ classId: string }>();
  const toast = useToast();
  const [cls, setCls] = useState<ClassDoc | null | undefined>(undefined); // undefined = loading, null = missing
  const [cards, setCards] = useState<CardDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [cardForm, setCardForm] = useState<{ open: boolean; existing?: CardDoc }>({ open: false });
  const [editClass, setEditClass] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toDelete, setToDelete] = useState<CardDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, list] = await Promise.all([getClass(uid, classId), listCards(uid, classId)]);
      setCls(c); setCards(list); setError(null);
    } catch (e) { setError(firestoreErrorMessage(e)); setCls((c) => (c === undefined ? null : c)); }
  }, [uid, classId]);
  useEffect(() => { void load(); }, [load]);

  const existingKeys = useMemo(() => cards.map((c) => cardKey(c.englishText, c.turkishMeaning)), [cards]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try { await deleteCard(uid, classId, toDelete.id); toast("Card deleted"); setToDelete(null); await load(); }
    catch (e) { toast(firestoreErrorMessage(e), "error"); }
    finally { setDeleting(false); }
  }

  if (cls === undefined) return <Splash label="Loading class" />;
  if (cls === null) {
    return (
      <div className="max-w-md">
        <h1 className="font-display text-3xl">Class not found</h1>
        <p className="mt-2 text-ink-muted">{error ?? "It may have been deleted, or it isn't in your account."}</p>
        <LinkButton href="/dashboard" variant="secondary" className="mt-6">Back to my classes</LinkButton>
      </div>
    );
  }
  const canStudy = cards.length > 0;

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"><ArrowLeft className="h-4 w-4" aria-hidden /> My classes</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl tracking-tight">{cls.name}</h1>
          {cls.description && <p className="mt-1 max-w-xl text-ink-muted">{cls.description}</p>}
          <p className="mt-2 text-sm text-ink-muted">{cards.length} {cards.length === 1 ? "card" : "cards"}</p>
        </div>
        <Button variant="ghost" onClick={() => setEditClass(true)}><Pencil className="h-4 w-4" aria-hidden /> Edit class</Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {canStudy
          ? <LinkButton href={`/classes/${classId}/study`}><Play className="h-4 w-4" aria-hidden /> Start learning</LinkButton>
          : <Button disabled><Play className="h-4 w-4" aria-hidden /> Start learning</Button>}
        <Button variant="secondary" onClick={() => setCardForm({ open: true })}><Plus className="h-4 w-4" aria-hidden /> Add card</Button>
        <Button variant="secondary" onClick={() => setImportOpen(true)}><FileUp className="h-4 w-4" aria-hidden /> Bulk import</Button>
      </div>
      {!canStudy && <p className="mt-3 text-sm text-ink-muted">Add at least one card to start learning.</p>}

      <div className="mt-6"><FormError message={error} /></div>

      {cards.length === 0 ? (
        <div className="mt-8 rounded-xl2 border border-dashed border-line bg-cream-surface px-6 py-12 text-center">
          <h2 className="font-display text-2xl">This class is empty</h2>
          <p className="mx-auto mt-2 max-w-sm text-ink-muted">Add a word, phrase or whole sentence with its Turkish meaning, or paste many at once.</p>
          <Button className="mt-5" onClick={() => setCardForm({ open: true })}>Add a card</Button>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-cream-surface">
          {cards.map((c) => (
            <li key={c.id} className="flex items-start gap-3 p-4 sm:p-5">
              <div className="min-w-0 flex-1">
                <p lang="en" className="break-words text-lg">{c.englishText}</p>
                <p lang="tr" className="mt-1 break-words text-ink-muted">{c.turkishMeaning}</p>
              </div>
              <div className="flex shrink-0">
                <button onClick={() => setCardForm({ open: true, existing: c })} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-blush/50" aria-label={`Edit card: ${c.englishText}`}><Pencil className="h-4 w-4" aria-hidden /></button>
                <button onClick={() => setToDelete(c)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#B42318] hover:bg-danger" aria-label={`Delete card: ${c.englishText}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CardFormDialog open={cardForm.open} uid={uid} classId={classId}
        {...(cardForm.existing ? { existing: cardForm.existing } : {})}
        onClose={() => { setCardForm({ open: false }); void load(); }}
        onSaved={(m) => { toast(m); void load(); }} />
      <BulkImportDialog open={importOpen} onClose={() => setImportOpen(false)} uid={uid} classId={classId}
        existingKeys={existingKeys} onImported={(n) => { toast(`Imported ${n} ${n === 1 ? "card" : "cards"}`); void load(); }} />
      <ClassFormDialog open={editClass} onClose={() => setEditClass(false)} uid={uid} existing={cls}
        onSaved={(m) => { toast(m); void load(); }} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete} busy={deleting}
        title="Delete this card?" confirmLabel="Delete card"
        body={<p>“{toDelete?.englishText}” and its study progress will be permanently deleted.</p>} />
    </div>
  );
}
