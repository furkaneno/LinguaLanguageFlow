"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { logoutUser } from "@/lib/firebase/auth";

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function signOut() {
    setBusy(true);
    try { await logoutUser(); router.replace("/login"); } finally { setBusy(false); }
  }
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-4xl tracking-tight">Settings</h1>
      <section className="mt-8 rounded-xl2 border border-line bg-cream-surface p-6">
        <h2 className="text-sm font-medium text-ink-muted">Signed in as</h2>
        <p className="mt-1 break-all text-lg">{user?.email}</p>
        <Button variant="secondary" className="mt-6" onClick={signOut} loading={busy}>Sign out</Button>
      </section>
    </div>
  );
}
