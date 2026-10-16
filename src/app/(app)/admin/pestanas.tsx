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
    <nav aria-label="Administración" className="flex gap-1 overflow-x-auto border-b">
      {PESTANAS.map((p) => {
        const activa = ruta.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap",
              activa ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {p.texto}
          </Link>
        );
      })}
    </nav>
  );
}
