import "server-only";
import { prisma } from "@/server/db";

export function listarConsultoriosActivos() {
  return prisma.consultorio.findMany({
    where: { activo: true },
    select: { id: true, nombre: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
  });
}
