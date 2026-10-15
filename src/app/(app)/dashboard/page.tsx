"use client";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useUid } from "@/components/auth/AuthProvider";
import { ClassCard } from "@/components/classes/ClassCard";
import { ClassFormDialog } from "@/components/classes/ClassFormDialog";
import { Splash } from "@/components/layout/Splash";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { deleteClass, firestoreErrorMessage, listClasses } from "@/lib/firebase/repo";
import type { ClassDoc } from "@/types";

export default function DashboardPage() {
  const uid = useUid();
  const toast = useToast();
  const [classes, setClasses] = useState<ClassDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ open: boolean; existing?: ClassDoc }>({ open: false });
  const [toDelete, setToDelete] = useState<ClassDoc | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setClasses(await listClasses(uid)); setError(null); }
    catch (e) { setError(firestoreErrorMessage(e)); setClasses((c) => c ?? []); }
  }, [uid]);
  useEffect(() => { void load(); }, [load]);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(`Deleting${toDelete.cardCount ? ` ${toDelete.cardCount} cards` : ""}`);
    try {
      await deleteClass(uid, toDelete.id, (n) => setDeleting(`Deleted ${n} of ${toDelete.cardCount} cards`));
      toast("Class deleted");
      setToDelete(null);
      await load();
    } catch (e) { toast(firestoreErrorMessage(e), "error"); }
    finally { setDeleting(null); }
  }

  if (!classes) return <Splash label="Loading your classes" />;
  const total = classes.reduce((n, c) => n + c.cardCount, 0);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight">My classes</h1>
          {classes.length > 0 && <p className="mt-1 text-ink-muted">{classes.length} {classes.length === 1 ? "class" : "classes"} · {total} {total === 1 ? "card" : "cards"} in total</p>}
        </div>
        {classes.length > 0 && <Button onClick={() => setForm({ open: true })}><Plus className="h-4 w-4" aria-hidden /> Create class</Button>}
      </div>

      <div className="mt-6"><FormError message={error} /></div>

      {classes.length === 0 && !error ? (
        <div className="mt-10 rounded-xl2 border border-dashed border-line bg-cream-surface px-6 py-14 text-center">
          <h2 className="font-display text-2xl">Start with a class</h2>
          <p className="mx-auto mt-2 max-w-sm text-ink-muted">A class is a set of cards you want to learn together, like “Daily English” or “Phrasal verbs”.</p>
          <Button className="mt-6" onClick={() => setForm({ open: true })}>Create your first class</Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <ClassCard key={c.id} c={c} onEdit={() => setForm({ open: true, existing: c })} onDelete={() => setToDelete(c)} />
          ))}
        </ul>
      )}

      <ClassFormDialog open={form.open} onClose={() => setForm({ open: false })} uid={uid}
        {...(form.existing ? { existing: form.existing } : {})}
        onSaved={(m) => { toast(m); void load(); }} />
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} onConfirm={confirmDelete}
        busy={!!deleting} title="Delete this class?" confirmLabel="Delete class"
        body={<>
          <p><strong className="text-ink">{toDelete?.name}</strong> and all {toDelete?.cardCount ?? 0} of its cards will be permanently deleted, along with their study progress. This can&apos;t be undone.</p>
          {deleting && <p role="status" className="mt-3 text-sm">{deleting}…</p>}
        </>} />
    </div>
  );
}
