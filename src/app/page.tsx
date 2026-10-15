import { Brand } from "@/components/layout/Brand";
import { LinkButton } from "@/components/ui/button";
import { APP_TAGLINE } from "@/config/app";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <Brand />
        <LinkButton href="/login" variant="ghost">Sign in</LinkButton>
      </header>
      <section className="flex flex-1 flex-col justify-center py-16">
        <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">{APP_TAGLINE}</h1>
        <p className="mt-6 max-w-xl text-lg text-ink-muted">
          Save English words and sentences with their Turkish meanings. Read each one aloud, then say what it means. You move on when both are right.
        </p>
        <div className="mt-8"><LinkButton href="/register">Create your account</LinkButton></div>
      </section>
    </main>
  );
}
