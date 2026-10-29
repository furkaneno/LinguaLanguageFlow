import { PATTERN_HEIGHT, PATTERN_TILE, PATTERN_WIDTH } from "./patternMarkup";

/**
 * Decorative animal illustrations behind the page. Only themes that ask for it show it
 * (the CSS variable --pattern-display is "none" for the plain themes), so they stay a flat colour.
 */
export function BackgroundPattern() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden [display:var(--pattern-display)]">
      <svg xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full text-ink opacity-[var(--pattern-opacity)]">
        <defs>
          <pattern id="lf-animals" width={PATTERN_WIDTH} height={PATTERN_HEIGHT} patternUnits="userSpaceOnUse" dangerouslySetInnerHTML={{ __html: PATTERN_TILE }} />
        </defs>
        <rect width="100%" height="100%" fill="url(#lf-animals)" />
      </svg>
    </div>
  );
}
