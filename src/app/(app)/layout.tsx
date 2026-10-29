"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Brand } from "@/components/layout/Brand";
import { ConfigMissing, Splash } from "@/components/layout/Splash";
import { ThemeQuickButton } from "@/components/theme/ThemeSwitcher";
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
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
          <Brand href="/dashboard" />
          <div className="flex items-center gap-1">
          <nav aria-label="Main" className="flex gap-1">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}
                className={`rounded-full px-3 py-2 text-sm font-medium sm:px-4 ${path.startsWith(n.href) ? "bg-blush" : "hover:bg-blush/50"}`}>
                {n.label}
              </Link>
            ))}
          </nav>
          <ThemeQuickButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-10">{children}</main>
    </ToastProvider>
  );
}
