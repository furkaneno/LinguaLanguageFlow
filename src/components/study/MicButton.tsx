import { Loader2, Mic, Square } from "lucide-react";

export function MicButton({ recording, evaluating, disabled, onClick }:
  { recording: boolean; evaluating: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled || evaluating} aria-pressed={recording}
      aria-label={recording ? "Stop recording" : evaluating ? "Checking your answer" : "Start recording"}
      className={`relative flex h-28 w-28 items-center justify-center rounded-full shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:h-32 sm:w-32 ${recording ? "bg-[#B42318] text-white" : "bg-brand text-on-brand hover:bg-brand-dark"}`}
    >
      {recording && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#B42318]/30" />}
      {evaluating ? <Loader2 className="relative h-10 w-10 animate-spin" aria-hidden />
        : recording ? <Square className="relative h-9 w-9 fill-current" aria-hidden />
        : <Mic className="relative h-11 w-11" aria-hidden />}
    </button>
  );
}
