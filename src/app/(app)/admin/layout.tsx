import { paginaProtegida } from "@/server/auth/paginas";
import { PestanasAdmin } from "./pestanas";

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  await paginaProtegida(["admin:usuarios", "admin:consultorios", "admin:auditoria"]);
  return (
    <div className="flex flex-col gap-4">
      <PestanasAdmin />
      {children}
    </div>
  );
}
