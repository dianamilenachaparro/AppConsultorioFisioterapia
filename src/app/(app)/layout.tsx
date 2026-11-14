import { redirect } from "next/navigation";
import { BarraLateral, Encabezado } from "@/components/navegacion/encabezado";
import { sesionDeSolicitud } from "@/server/auth/paginas";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const sesion = await sesionDeSolicitud();
  if (!sesion) redirect("/login");
  return (
    <div className="flex min-h-full flex-1 bg-lienzo">
      <BarraLateral sesion={sesion} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Encabezado sesion={sesion} />
        <main className="contenido mx-auto w-full max-w-[100rem] flex-1 px-4 pt-2 pb-10 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
