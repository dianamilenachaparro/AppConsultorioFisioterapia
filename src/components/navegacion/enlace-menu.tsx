"use client";

import {
  CalendarCheckIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  CircleIcon,
  ClipboardListIcon,
  LandmarkIcon,
  PackageIcon,
  ReceiptTextIcon,
  Settings2Icon,
  SunIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ICONO: Record<string, LucideIcon> = {
  "/agenda": CalendarDaysIcon,
  "/mi-dia": SunIcon,
  "/mi-agenda": CalendarCheckIcon,
  "/citas": ClipboardListIcon,
  "/pacientes": UsersIcon,
  "/indicadores": ChartColumnIcon,
  "/insumos": PackageIcon,
  "/mis-movimientos": ReceiptTextIcon,
  "/finanzas": LandmarkIcon,
  "/admin/usuarios": Settings2Icon,
};

/** Activo si la ruta actual está dentro de la misma sección (primer segmento). */
function esActivo(ruta: string, href: string) {
  const seccion = href.split("/")[1];
  return ruta === href || ruta.split("/")[1] === seccion;
}

export function EnlaceMenu({ href, texto, enHoja = false }: { href: string; texto: string; enHoja?: boolean }) {
  const ruta = usePathname();
  const activo = esActivo(ruta, href);
  const Icono = ICONO[href] ?? CircleIcon;
  const enlace = (
    <Link
      href={href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-semibold outline-none transition-[color,background-color,box-shadow] duration-200 focus-visible:ring-3 focus-visible:ring-ring/40",
        activo
          ? "bg-primary text-primary-foreground shadow-activo"
          : "text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-card",
      )}
    >
      <Icono aria-hidden className="size-[1.125rem] shrink-0" strokeWidth={2.2} />
      {texto}
    </Link>
  );
  return enHoja ? <SheetClose asChild>{enlace}</SheetClose> : enlace;
}
