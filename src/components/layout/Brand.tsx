import Link from "next/link";
import { APP_NAME } from "@/config/app";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="font-display text-xl tracking-tight sm:text-2xl">
      {APP_NAME}<span className="text-brand-light" aria-hidden>.</span>
    </Link>
  );
}
