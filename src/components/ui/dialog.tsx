"use client";
import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./button";

export function Dialog({ open, onClose, title, children, wide, locked = false }:
  { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; locked?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      // While locked (a long task is running) the dialog cannot be dismissed by Esc or by clicking outside.
      onCancel={(e) => { if (locked) e.preventDefault(); }}
      onClose={() => { if (locked) { ref.current?.showModal(); return; } onClose(); }}
      onClick={(e) => { if (!locked && e.target === ref.current) onClose(); }}
      className={`m-auto max-h-[92dvh] w-[calc(100%-1.5rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-xl2 border border-line bg-cream-surface p-0 text-ink shadow-xl backdrop:bg-black/60`}
    >
      {open && (
        <div className="p-5 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="font-display text-2xl">{title}</h2>
            <button onClick={onClose} disabled={locked} aria-label="Close" className="rounded-full p-2 hover:bg-blush/50 disabled:opacity-40"><X className="h-5 w-5" /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, confirmLabel, busy }:
  { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel: string; busy?: boolean }) {
  return (
    <Dialog open={open} onClose={onClose} locked={!!busy} title={title}>
      <div className="text-ink-muted">{body}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={!!busy}>{confirmLabel}</Button>
      </div>
    </Dialog>
  );
}
