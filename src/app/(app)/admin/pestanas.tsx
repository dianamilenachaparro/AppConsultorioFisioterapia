"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PESTANAS = [
  { href: "/admin/usuarios", texto: "Usuarios" },
  { href: "/admin/consultorios", texto: "Consultorios" },
  { href: "/admin/auditoria", texto: "Auditoría" },
];

export function PestanasAdmin() {
  const ruta = usePathname();
  return (
    <nav aria-label="Administración" className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-card p-1 shadow-card">
      {PESTANAS.map((p) => {
        const activa = ruta.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              activa ? "bg-primary text-primary-foreground shadow-activo" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {p.texto}
          </Link>
        );
      })}
    </nav>
  );
}
