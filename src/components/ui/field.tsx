import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

const control =
  "w-full rounded-xl border border-line bg-cream-surface px-4 py-3 text-base text-ink placeholder:text-ink-muted/70 aria-[invalid=true]:border-[#B42318]";

interface Common { label: string; error?: string | undefined; hint?: string }

export function Field({ label, error, hint, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={id} className={control} aria-invalid={!!error} aria-describedby={`${id}-m`} {...rest} />
      <p id={`${id}-m`} className={`mt-1.5 text-sm ${error ? "text-[#B42318]" : "text-ink-muted"}`}>{error ?? hint}</p>
    </div>
  );
}

export function TextArea({ label, error, hint, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <textarea id={id} className={`${control} min-h-24 resize-y`} aria-invalid={!!error} aria-describedby={`${id}-m`} {...rest} />
      <p id={`${id}-m`} className={`mt-1.5 text-sm ${error ? "text-[#B42318]" : "text-ink-muted"}`}>{error ?? hint}</p>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl bg-danger px-4 py-3 text-sm text-[#7A1C14]"><strong>Error: </strong>{message}</p>;
}
