"use client";
import { Check, Palette } from "lucide-react";
import { PALETTES, THEME_IDS, nextTheme } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

/** One-tap button for the header: switches to the next theme. */
export function ThemeQuickButton() {
  const { theme, setTheme } = useTheme();
  const next = nextTheme(theme);
  return (
    <button type="button" onClick={() => setTheme(next)} title="Change theme"
      aria-label={`Change theme. Current: ${PALETTES[theme].name}. Next: ${PALETTES[next].name}`}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-blush/50">
      <Palette className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** Full picker with previews, used on the Settings page. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid gap-3 sm:grid-cols-3">
      {THEME_IDS.map((id) => {
        const p = PALETTES[id];
        const selected = id === theme;
        return (
          <button key={id} type="button" role="radio" aria-checked={selected} onClick={() => setTheme(id)}
            className={`rounded-xl2 border-2 p-3 text-left transition-colors hover:bg-blush/50 ${selected ? "border-brand" : "border-line"}`}>
            <span aria-hidden className="relative block h-20 overflow-hidden rounded-lg border" style={{ background: p.bg, borderColor: p.line }}>
              <span className="absolute inset-x-3 top-3 h-7 rounded-md" style={{ background: p.surface }} />
              <span className="absolute left-5 top-[1.15rem] h-1.5 w-12 rounded-full" style={{ background: p.ink, opacity: 0.7 }} />
              <span className="absolute bottom-3 left-3 h-4 w-16 rounded-full" style={{ background: p.brand }} />
              <span className="absolute bottom-3 right-3 h-4 w-4 rounded-full" style={{ background: p.good }} />
            </span>
            <span className="mt-3 flex items-center justify-between gap-2 text-sm font-medium">
              {p.name}
              {selected && <><Check className="h-4 w-4 text-brand-light" aria-hidden /><span className="sr-only">(selected)</span></>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
