"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { authErrorMessage, requestPasswordReset } from "@/lib/firebase/auth";
import { fieldErrors, resetSchema } from "@/lib/validation/schemas";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs = fieldErrors(resetSchema, { email });
    setError(errs?.email); setFormError(null);
    if (errs) return;
    setBusy(true);
    try { await requestPasswordReset(email.trim()); setSent(true); }
    catch (err) { setFormError(authErrorMessage(err)); }
    finally { setBusy(false); }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-3xl">Check your email</h1>
        <p role="status" className="rounded-xl bg-success px-4 py-3 text-sm">If an account exists for {email.trim()}, a reset link is on its way.</p>
        <Link href="/login" className="text-sm font-medium text-emerald underline">Back to sign in</Link>
      </div>
    );
  }
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h1 className="font-display text-3xl">Reset your password</h1>
      <FormError message={formError} />
      <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
      <Button type="submit" loading={busy} className="w-full">Send reset link</Button>
      <p className="text-center text-sm"><Link href="/login" className="text-ink-muted underline">Back to sign in</Link></p>
    </form>
  );
}
