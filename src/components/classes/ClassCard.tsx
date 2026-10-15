import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import type { ClassDoc } from "@/types";

export function ClassCard({ c, onEdit, onDelete }: { c: ClassDoc; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="flex flex-col rounded-xl2 border border-line bg-cream-surface p-5 shadow-sm">
      <Link href={`/classes/${c.id}`} className="group flex-1 rounded-lg">
        <h2 className="font-display text-xl group-hover:text-emerald">{c.name}</h2>
        {c.description && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{c.description}</p>}
        <p className="mt-4 text-sm">
          <span className="font-medium">{c.cardCount}</span> {c.cardCount === 1 ? "card" : "cards"}
          <span className="text-ink-muted">
            {c.lastStudiedAt ? ` · Last studied ${c.lastStudiedAt.toLocaleDateString()}` : " · Not studied yet"}
          </span>
        </p>
        <span className="sr-only">Open {c.name}</span>
      </Link>
      <div className="mt-4 flex gap-1 border-t border-line pt-3">
        <button onClick={onEdit} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm hover:bg-blush/50">
          <Pencil className="h-4 w-4" aria-hidden /> Edit<span className="sr-only"> {c.name}</span>
        </button>
        <button onClick={onDelete} className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm text-[#B42318] hover:bg-danger">
          <Trash2 className="h-4 w-4" aria-hidden /> Delete<span className="sr-only"> {c.name}</span>
        </button>
      </div>
    </li>
  );
}
