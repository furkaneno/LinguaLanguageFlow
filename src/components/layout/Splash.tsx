import { Loader2 } from "lucide-react";

export function Splash({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center gap-2 text-ink-muted">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {label}…
    </div>
  );
}

export function ConfigMissing({ message }: { message: string }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="font-display text-3xl">Firebase isn&apos;t configured yet</h1>
      <p className="mt-3 text-ink-muted">{message}</p>
      <p className="mt-3 text-ink-muted">Copy <code>.env.example</code> to <code>.env.local</code>, fill in the values from your Firebase web app, then restart the dev server.</p>
    </main>
  );
}
