/** Small, quiet author credit shown under the first screens. */
export function DevCredit({ className = "" }: { className?: string }) {
  return (
    <footer className={`flex flex-col items-center gap-3 pt-10 text-center ${className}`}>
      <span aria-hidden className="h-px w-16 bg-gradient-to-r from-transparent via-line to-transparent" />
      <p className="text-sm text-ink-muted">
        developed by <span className="font-medium tracking-wide text-ink">@FurkanUzunabdullah</span>
      </p>
    </footer>
  );
}
