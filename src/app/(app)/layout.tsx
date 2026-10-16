import { redirect } from "next/navigation";
import { Encabezado } from "@/components/navegacion/encabezado";
import { sesionDeSolicitud } from "@/server/auth/paginas";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const sesion = await sesionDeSolicitud();
  if (!sesion) redirect("/login");
  return (
    <div className="flex min-h-full flex-1 flex-col bg-muted/30">
      <Encabezado sesion={sesion} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}
