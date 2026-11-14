import { LogOutIcon, MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NOMBRE_ROL } from "@/lib/permisos";
import { iniciales } from "@/lib/utils";
import type { Sesion } from "@/server/auth/sesion";
import { Marca, SimboloMarca } from "./marca";
import { MenuEnlaces } from "./menu";

function CerrarSesion() {
  return (
    <form action="/api/sesion/cerrar" method="post">
      <Button type="submit" variant="ghost" className="h-11 w-full justify-start gap-3 px-4 text-muted-foreground">
        <LogOutIcon aria-hidden className="size-[1.125rem]" strokeWidth={2.2} />
        Cerrar sesión
      </Button>
    </form>
  );
}

/** Barra lateral de escritorio; en celular el mismo menú vive en la hoja del encabezado. */
export function BarraLateral({ sesion }: { sesion: Sesion }) {
  return (
    <aside className="sticky top-0 hidden h-svh w-[232px] shrink-0 flex-col gap-10 px-5 pt-8 pb-6 lg:flex">
      <Marca className="px-2" />
      <MenuEnlaces rol={sesion.rol} atiende={sesion.atiendePacientes} className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1" />
      <CerrarSesion />
    </aside>
  );
}

export function Encabezado({ sesion }: { sesion: Sesion }) {
  return (
    <header className="flex items-center gap-3 px-4 pt-4 pb-2 sm:px-6 lg:px-8 lg:pt-7 lg:pb-3">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Abrir menú">
            <MenuIcon />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 gap-6 bg-lienzo p-4">
          <SheetHeader className="p-2">
            <SheetTitle className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
              <SimboloMarca />
              Consultorio
            </SheetTitle>
          </SheetHeader>
          <MenuEnlaces rol={sesion.rol} atiende={sesion.atiendePacientes} enHoja className="min-h-0 flex-1 overflow-y-auto" />
          <CerrarSesion />
        </SheetContent>
      </Sheet>
      <Marca className="text-base lg:hidden [&_svg]:size-8" />
      <div className="ml-auto flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-sm font-bold text-primary shadow-card"
        >
          {iniciales(sesion.nombre)}
        </span>
        <div className="min-w-0 leading-tight max-sm:sr-only">
          <p className="truncate text-sm font-bold">{sesion.nombre}</p>
          <p className="text-xs text-muted-foreground">{NOMBRE_ROL[sesion.rol]}</p>
        </div>
      </div>
    </header>
  );
}
