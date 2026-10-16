import { paginaProtegida } from "@/server/auth/paginas";
import { listarConsultorios } from "@/server/consultorios/servicio";
import { FilaConsultorio, NuevoConsultorio } from "./fila-consultorio";

export default async function Consultorios() {
  const sesion = await paginaProtegida("admin:consultorios");
  const consultorios = await listarConsultorios(sesion);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Consultorios</h1>
        <p className="text-sm text-muted-foreground">
          El número define el orden en la agenda. Un consultorio inactivo no se ofrece para nuevas citas; sus citas siguen visibles.
        </p>
      </div>
      <ul className="flex flex-col divide-y rounded-lg border bg-background">
        {consultorios.map((c) => (
          <FilaConsultorio key={`${c.id}-${c.nombre}-${c.orden}-${c.activo}`} c={c} />
        ))}
      </ul>
      <NuevoConsultorio />
    </div>
  );
}
