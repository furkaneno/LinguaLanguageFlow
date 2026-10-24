import Link from "next/link";
import { APP_NAME } from "@/config/app";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="font-display text-2xl tracking-tight">
      {APP_NAME}<span className="text-brand-light" aria-hidden>.</span>
    </Link>
  );
}
