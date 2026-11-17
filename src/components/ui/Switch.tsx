/** An iOS-style on/off switch. Colours come from the theme: the second (accent) colour fills the track when on. */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (on: boolean) => void; label: string; id?: string }) {
  return (
    <button
      type="button" role="switch" id={id} aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-8 w-[3.25rem] shrink-0 rounded-full border-2 transition-colors duration-200 ${checked ? "border-brand bg-brand" : "border-line bg-blush"}`}
    >
      {/* iOS "on/off labels": a bar when on, a ring when off */}
      <span aria-hidden className={`absolute left-2.5 top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-on-brand transition-opacity duration-200 ${checked ? "opacity-100" : "opacity-0"}`} />
      <span aria-hidden className={`absolute right-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border-2 border-ink-muted transition-opacity duration-200 ${checked ? "opacity-0" : "opacity-100"}`} />
      <span aria-hidden className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}
