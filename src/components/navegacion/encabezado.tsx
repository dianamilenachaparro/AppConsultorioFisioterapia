import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NOMBRE_ROL } from "@/lib/permisos";
import type { Sesion } from "@/server/auth/sesion";
import { MenuEnlaces } from "./menu";

export function Encabezado({ sesion }: { sesion: Sesion }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menú">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle>Consultorio</SheetTitle>
            </SheetHeader>
            <MenuEnlaces rol={sesion.rol} atiende={sesion.atiendePacientes} className="px-2" />
          </SheetContent>
        </Sheet>
        <Link href="/" className="font-semibold">
          Consultorio
        </Link>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <div className="min-w-0 text-right leading-tight">
            <p className="truncate text-sm font-medium">{sesion.nombre}</p>
            <p className="text-xs text-muted-foreground">{NOMBRE_ROL[sesion.rol]}</p>
          </div>
          <form action="/api/sesion/cerrar" method="post">
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </div>
      <div className="mx-auto hidden max-w-6xl px-2 pb-2 lg:block">
        <MenuEnlaces rol={sesion.rol} atiende={sesion.atiendePacientes} />
      </div>
    </header>
  );
}
