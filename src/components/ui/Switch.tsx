/** An iOS-style on/off switch. Colours come from the theme: the second (accent) colour fills the track when on. */
export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (on: boolean) => void; label: string; id?: string }) {
  return (
    <button
      type="button" role="switch" id={id} aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={`relative h-8 w-[3.25rem] shrink-0 rounded-full border-2 transition-colors duration-200 ${checked ? "border-brand bg-brand" : "border-line bg-blush"}`}
    >
      <span aria-hidden className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}
