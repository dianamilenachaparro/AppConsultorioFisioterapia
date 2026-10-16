import Link from "next/link";
import { puede, puedeAlguna, type Accion, type Rol } from "@/lib/permisos";

type Item = { href: string; texto: string; visible: (rol: Rol, atiende: boolean) => boolean };

const con = (...acciones: Accion[]) => (rol: Rol) => puedeAlguna(rol, acciones);

/** El menú solo oculta; la autorización real está en cada página y servicio. */
const ITEMS: Item[] = [
  { href: "/agenda", texto: "Agenda", visible: con("agenda:ver_todas") },
  {
    href: "/mi-dia",
    texto: "Mi día",
    visible: (rol, atiende) => puede(rol, "marcaciones:registrar") && (rol === "PROFESIONAL" || atiende),
  },
  {
    href: "/mi-agenda",
    texto: "Mi agenda",
    visible: (rol, atiende) => puede(rol, "agenda:ver_propia") && (rol === "PROFESIONAL" || atiende),
  },
  { href: "/citas", texto: "Citas", visible: con("citas:listar") },
  { href: "/pacientes", texto: "Pacientes", visible: con("pacientes:gestionar", "pacientes:consultar_propios") },
  { href: "/indicadores", texto: "Indicadores", visible: con("indicadores:ver_todos", "indicadores:ver_propios") },
  { href: "/insumos", texto: "Insumos", visible: con("inventario:vender", "inventario:gestionar") },
  { href: "/mis-movimientos", texto: "Mis movimientos", visible: con("movimientos:ver_propios_hoy") },
  { href: "/finanzas", texto: "Finanzas", visible: con("finanzas:ver") },
  { href: "/admin/usuarios", texto: "Administración", visible: con("admin:usuarios") },
];

export function itemsMenu(rol: Rol, atiende: boolean) {
  return ITEMS.filter((i) => i.visible(rol, atiende));
}

export function MenuEnlaces({ rol, atiende, className }: { rol: Rol; atiende: boolean; className?: string }) {
  return (
    <nav aria-label="Menú principal" className={className}>
      <ul className="flex flex-col gap-1 lg:flex-row lg:flex-wrap lg:gap-2">
        {itemsMenu(rol, atiende).map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              {i.texto}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
