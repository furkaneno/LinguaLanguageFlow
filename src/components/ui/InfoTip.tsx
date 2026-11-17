"use client";
import { useEffect, useId, useState } from "react";

/** A small circled "i". The text shows on mouse hover and keyboard focus, and on tap (it closes itself after a few seconds). */
export function InfoTip({ text, label = "What is this?" }: { text: string; label?: string }) {
  const id = useId();
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [tapped, setTapped] = useState(false);
  const show = hover || focus || tapped;

  useEffect(() => {
    if (!tapped) return;
    const t = setTimeout(() => setTapped(false), 4500); // touch screens have no "leave" event
    return () => clearTimeout(t);
  }, [tapped]);

  return (
    <span className="relative inline-flex" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button" aria-label={label} aria-describedby={show ? id : undefined}
        onClick={() => setTapped((v) => !v)} onFocus={() => setFocus(true)} onBlur={() => { setFocus(false); setTapped(false); }}
        onKeyDown={(e) => { if (e.key === "Escape") { setTapped(false); setHover(false); setFocus(false); } }}
        className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-brand text-[11px] font-bold leading-none text-brand-light transition-colors hover:bg-brand hover:text-on-brand"
      >
        i
      </button>
      {show && (
        <span id={id} role="tooltip" className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border-2 border-brand bg-cream-surface p-3 text-left text-xs font-normal leading-snug text-ink shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}
