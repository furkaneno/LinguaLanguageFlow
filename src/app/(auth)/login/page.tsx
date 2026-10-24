"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { authErrorMessage, loginUser } from "@/lib/firebase/auth";
import { fieldErrors, loginSchema } from "@/lib/validation/schemas";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs = fieldErrors(loginSchema, { email, password });
    setErrors(errs ?? {}); setFormError(null);
    if (errs) return;
    setBusy(true);
    try { await loginUser(email.trim(), password); } // layout redirects once auth state updates
    catch (err) { setFormError(authErrorMessage(err)); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h1 className="font-display text-3xl">Welcome back</h1>
      <FormError message={formError} />
      <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
      <Button type="submit" loading={busy} className="w-full">Sign in</Button>
      <p className="text-center text-sm text-ink-muted">
        <Link href="/forgot-password" className="underline">Forgot your password?</Link>
      </p>
      <p className="text-center text-sm text-ink-muted">New here? <Link href="/register" className="font-medium text-brand-light underline">Create an account</Link></p>
    </form>
  );
}
