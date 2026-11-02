"use client";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { authErrorMessage, changePassword } from "@/lib/firebase/auth";
import { changePasswordSchema, fieldErrors } from "@/lib/validation/schemas";

const EMPTY = { current: "", next: "", confirm: "" };

export function ChangePasswordForm() {
  const { user } = useAuth();
  const toast = useToast();
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs = fieldErrors(changePasswordSchema, v);
    setErrors(errs ?? {}); setFormError(null);
    if (errs) return;
    setBusy(true);
    try {
      await changePassword(v.current, v.next);
      setV(EMPTY);
      toast("Password updated");
    } catch (err) {
      setFormError(authErrorMessage(err, "password"));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {/* Lets password managers match the new password to this account. */}
      <input type="email" autoComplete="username" value={user?.email ?? ""} readOnly tabIndex={-1} aria-hidden className="sr-only" />
      <FormError message={formError} />
      <Field label="Current password" type="password" autoComplete="current-password" value={v.current} onChange={set("current")} error={errors.current} />
      <Field label="New password" type="password" autoComplete="new-password" value={v.next} onChange={set("next")} error={errors.next} hint="At least 8 characters." />
      <Field label="Confirm new password" type="password" autoComplete="new-password" value={v.confirm} onChange={set("confirm")} error={errors.confirm} />
      <Button type="submit" loading={busy}>Update password</Button>
    </form>
  );
}
