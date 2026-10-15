"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { authErrorMessage, registerUser } from "@/lib/firebase/auth";
import { fieldErrors, registerSchema } from "@/lib/validation/schemas";

export default function RegisterPage() {
  const [v, setV] = useState({ email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs = fieldErrors(registerSchema, v);
    setErrors(errs ?? {}); setFormError(null);
    if (errs) return;
    setBusy(true);
    try { await registerUser(v.email.trim(), v.password); }
    catch (err) { setFormError(authErrorMessage(err)); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h1 className="font-display text-3xl">Create your account</h1>
      <FormError message={formError} />
      <Field label="Email" type="email" autoComplete="email" value={v.email} onChange={set("email")} error={errors.email} />
      <Field label="Password" type="password" autoComplete="new-password" value={v.password} onChange={set("password")} error={errors.password} hint="At least 8 characters." />
      <Field label="Confirm password" type="password" autoComplete="new-password" value={v.confirm} onChange={set("confirm")} error={errors.confirm} />
      <Button type="submit" loading={busy} className="w-full">Create account</Button>
      <p className="text-center text-sm text-ink-muted">Already have an account? <Link href="/login" className="font-medium text-emerald underline">Sign in</Link></p>
    </form>
  );
}
