"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Brand } from "@/components/layout/Brand";
import { ConfigMissing, Splash } from "@/components/layout/Splash";
import { ToastProvider } from "@/components/ui/toast";

const nav = [{ href: "/dashboard", label: "My classes" }, { href: "/settings", label: "Settings" }];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, configError } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (!loading && !user && !configError) router.replace("/login"); }, [loading, user, configError, router]);
  if (configError) return <ConfigMissing message={configError} />;
  if (loading || !user) return <Splash />;
  return (
    <ToastProvider>
      <header className="border-b border-line bg-cream-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
          <Brand href="/dashboard" />
          <nav aria-label="Main" className="flex gap-1">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-medium ${path.startsWith(n.href) ? "bg-blush" : "hover:bg-blush/50"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-10">{children}</main>
    </ToastProvider>
  );
}
