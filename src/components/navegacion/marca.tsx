import Link from "next/link";
import { cn } from "@/lib/utils";

/** Símbolo del consultorio: tres vértebras desplazadas sobre el azul primario. */
export function SimboloMarca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-9 shrink-0", className)}>
      <rect width="32" height="32" rx="10" fill="var(--primary)" />
      <rect x="9" y="7.5" width="13" height="4.5" rx="2.25" fill="white" />
      <rect x="11" y="13.75" width="13" height="4.5" rx="2.25" fill="white" opacity="0.85" />
      <rect x="9" y="20" width="13" height="4.5" rx="2.25" fill="white" />
    </svg>
  );
}

export function Marca({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2.5 rounded-sm text-lg font-bold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/40", className)}
    >
      <SimboloMarca />
      Consultorio
    </Link>
  );
}
