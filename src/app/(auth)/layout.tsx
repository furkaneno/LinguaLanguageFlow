"use client";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Brand } from "@/components/layout/Brand";
import { ConfigMissing, Splash } from "@/components/layout/Splash";

export default function AuthLayout({ children }: { children: ReactNode }) {
  const { user, loading, configError } = useAuth();
  const router = useRouter();
  useEffect(() => { if (user) router.replace("/dashboard"); }, [user, router]);
  if (configError) return <ConfigMissing message={configError} />;
  if (loading || user) return <Splash />;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8"><Brand /></div>
      <div className="rounded-xl2 border border-line bg-cream-surface p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}
