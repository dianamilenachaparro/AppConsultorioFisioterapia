import "server-only";
import { prisma } from "@/server/db";

/** Usuarios que se pueden asignar a citas: activos y que atienden pacientes. */
export function listarProfesionalesAsignables() {
  return prisma.usuario.findMany({
    where: { activo: true, atiendePacientes: true },
    select: { id: true, nombreCompleto: true },
    orderBy: { nombreCompleto: "asc" },
  });
}
