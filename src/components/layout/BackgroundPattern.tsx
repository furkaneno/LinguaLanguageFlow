import { PATTERN_TILE } from "./patternMarkup";

/** Decorative, fixed behind everything. Colours come from the active theme, so it follows theme changes. */
export function BackgroundPattern() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-brand opacity-[0.10] blur-3xl" />
      <div className="absolute -bottom-40 -left-32 h-[26rem] w-[26rem] rounded-full bg-blush-accent opacity-40 blur-3xl" />
      <svg xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full text-ink opacity-[var(--pattern-opacity)]">
        <defs>
          <pattern id="lf-english-pattern" width="420" height="420" patternUnits="userSpaceOnUse" dangerouslySetInnerHTML={{ __html: PATTERN_TILE }} />
        </defs>
        <rect width="100%" height="100%" fill="url(#lf-english-pattern)" />
      </svg>
    </div>
  );
}
