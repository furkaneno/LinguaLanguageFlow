"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { useAuth } from "@/components/auth/AuthProvider";
import { ThemePicker } from "@/components/theme/ThemeSwitcher";
import { Button } from "@/components/ui/button";
import { logoutUser } from "@/lib/firebase/auth";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function signOut() {
    setBusy(true);
    try { await logoutUser(); router.replace("/login"); } finally { setBusy(false); }
  }

  const accountDeleted = () => router.replace("/login");

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-4xl tracking-tight">Settings</h1>
      <section className="mt-8 rounded-xl2 border border-line bg-cream-surface p-6">
        <h2 className="text-sm font-medium text-ink-muted">Signed in as</h2>
        <p className="mt-1 break-all text-lg">{user?.email}</p>
        <Button variant="secondary" className="mt-6" onClick={signOut} loading={busy}>Sign out</Button>
      </section>
      <section className="mt-6 rounded-xl2 border border-line bg-cream-surface p-6">
        <h2 className="text-sm font-medium text-ink-muted">Colour theme</h2>
        <p className="mt-1 text-sm text-ink-muted">Saved to your account, so it follows you to other devices.</p>
        <div className="mt-4"><ThemePicker /></div>
      </section>
      <section className="mt-6 rounded-xl2 border border-line bg-cream-surface p-6">
        <h2 className="text-sm font-medium text-ink-muted">Change password</h2>
        <p className="mb-4 mt-1 text-sm text-ink-muted">You&apos;ll need your current password to set a new one.</p>
        <ChangePasswordForm />
      </section>
      <section className="mt-6 rounded-xl2 border border-[#B42318]/50 bg-cream-surface p-6">
        <h2 className="text-sm font-medium text-err">Delete account</h2>
        <p className="mt-1 text-sm text-ink-muted">Permanently removes your account, classes, cards and study history.</p>
        <Button variant="danger" className="mt-4" onClick={() => setDeleteOpen(true)}>Delete account…</Button>
      </section>
      <DeleteAccountDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={accountDeleted} />
    </div>
  );
}
