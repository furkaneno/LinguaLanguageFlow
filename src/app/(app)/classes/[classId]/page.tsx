"use client";
import { ArrowLeft, FileDown, FileUp, Pencil, Play, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useUid } from "@/components/auth/AuthProvider";
import { BulkImportDialog } from "@/components/cards/BulkImportDialog";
import { CardFormDialog } from "@/components/cards/CardFormDialog";
import { ClassFormDialog } from "@/components/classes/ClassFormDialog";
import { Splash } from "@/components/layout/Splash";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { downloadCardsPdf } from "@/lib/export/downloadCardsPdf";
import { cardKey } from "@/lib/import/parse";
import { deleteCard, firestoreErrorMessage, getClass, listCards } from "@/lib/firebase/repo";
import { createSearch } from "@/lib/text/search";
import type { CardDoc, ClassDoc } from "@/types";

const PAGE_SIZE = 100;

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
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(query);

  const load = useCallback(async () => {
    try {
      const [c, list] = await Promise.all([getClass(uid, classId), listCards(uid, classId)]);
      setCls(c); setCards(list); setError(null);
    } catch (e) { setError(firestoreErrorMessage(e)); setCls((c) => (c === undefined ? null : c)); }
  }, [uid, classId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setVisible(PAGE_SIZE); }, [deferredQuery]);

  const existingKeys = useMemo(() => cards.map((c) => cardKey(c.englishText, c.turkishMeaning)), [cards]);
  const search = useMemo(() => createSearch(cards), [cards]);
  const filtered = useMemo(() => search(deferredQuery), [search, deferredQuery]);
  const searching = deferredQuery.trim().length > 0;

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try { await deleteCard(uid, classId, toDelete.id); toast("Card deleted"); setToDelete(null); await load(); }
    catch (e) { toast(firestoreErrorMessage(e), "error"); }
    finally { setDeleting(false); }
  }

  async function exportPdf() {
    if (!cls || exporting) return;
    setExporting(true);
    try { await downloadCardsPdf(cls.name, cards); toast("PDF downloaded"); }
    catch { toast("Couldn't create the PDF. Please try again.", "error"); }
    finally { setExporting(false); }
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
        <Button variant="secondary" onClick={() => void exportPdf()} loading={exporting} disabled={!canStudy}><FileDown className="h-4 w-4" aria-hidden /> Export PDF</Button>
      </div>
      {!canStudy && <p className="mt-3 text-sm text-ink-muted">Add at least one card to start learning.</p>}

      <div className="mt-6"><FormError message={error} /></div>

      {canStudy && (
        <div className="mt-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <input
              type="search" value={query} onChange={(e) => setQuery(e.target.value)}
              aria-label="Search cards" placeholder="Search English, Turkish or #number"
              className="w-full rounded-full border border-line bg-cream-surface py-3 pl-11 pr-12 text-base text-ink placeholder:text-ink-muted/70"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full hover:bg-blush/50">
                <X className="h-4 w-4" aria-hidden />
              </button>
            )}
          </div>
          {searching && <p role="status" className="mt-2 text-sm text-ink-muted">{filtered.length} of {cards.length} cards</p>}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="mt-8 rounded-xl2 border border-dashed border-line bg-cream-surface px-6 py-12 text-center">
          <h2 className="font-display text-2xl">This class is empty</h2>
          <p className="mx-auto mt-2 max-w-sm text-ink-muted">Add a word, phrase or whole sentence with its Turkish meaning, or paste many at once.</p>
          <Button className="mt-5" onClick={() => setCardForm({ open: true })}>Add a card</Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-xl2 border border-dashed border-line bg-cream-surface px-6 py-10 text-center">
          <p className="font-medium">No cards match “{deferredQuery.trim()}”</p>
          <p className="mt-1 text-sm text-ink-muted">Try fewer words, or search by number like #12.</p>
          <Button variant="secondary" className="mt-4" onClick={() => setQuery("")}>Clear search</Button>
        </div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl2 border border-line bg-cream-surface">
            {filtered.slice(0, visible).map((c) => (
              <li key={c.id} className="flex items-start gap-3 p-4 sm:p-5">
                <span className="mt-1 w-11 shrink-0 text-sm tabular-nums text-ink-muted" aria-label={`Card number ${c.number}`}>#{c.number}</span>
                <div className="min-w-0 flex-1">
                  <p lang="en" className="break-words text-lg">{c.englishText}</p>
                  <p lang="tr" className="mt-1 break-words text-ink-muted">{c.turkishMeaning}</p>
                </div>
                <div className="flex shrink-0">
                  <button onClick={() => setCardForm({ open: true, existing: c })} className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-blush/50" aria-label={`Edit card ${c.number}: ${c.englishText}`}><Pencil className="h-4 w-4" aria-hidden /></button>
                  <button onClick={() => setToDelete(c)} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#FF8A80] hover:bg-danger" aria-label={`Delete card ${c.number}: ${c.englishText}`}><Trash2 className="h-4 w-4" aria-hidden /></button>
                </div>
              </li>
            ))}
          </ul>
          {filtered.length > visible && (
            <div className="mt-4 text-center">
              <Button variant="secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show more ({filtered.length - visible} left)
              </Button>
            </div>
          )}
        </>
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
        body={<p>“{toDelete?.englishText}” and its study progress will be permanently deleted. Cards after it will move up one number.</p>} />
    </div>
  );
}
