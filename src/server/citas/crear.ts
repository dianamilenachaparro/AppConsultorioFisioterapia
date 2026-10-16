import "server-only";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { crearCitaSchema, type CrearCitaEntrada } from "@/lib/validacion/cita";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";
import { calcularHorario, exigirConsultorioActivo, exigirProfesionalAsignable, valoresCita } from "./comun";

/**
 * Crea una cita. La disponibilidad NO se verifica en la aplicación: la autoridad son
 * las restricciones EXCLUDE de la BD, que rechazan atómicamente cualquier choque
 * aunque dos personas confirmen al mismo tiempo (FR-015, SC-001).
 */
export async function crearCita(sesion: Sesion, entrada: CrearCitaEntrada, ahora = new Date()) {
  exigirPermiso(sesion, "citas:gestionar");
  const datos = crearCitaSchema.parse(entrada);
  const { inicio, fin } = calcularHorario(datos.fecha, datos.horaInicio, datos.duracionMin);

  try {
    return await prisma.$transaction(async (tx) => {
      await exigirConsultorioActivo(tx, datos.consultorioId);
      await exigirProfesionalAsignable(tx, datos.profesionalId);
      const existePaciente = await tx.paciente.count({ where: { id: datos.pacienteId } });
      if (!existePaciente) throw new ErrorDominio("NO_ENCONTRADO", "Paciente no encontrado");

      const cita = await tx.cita.create({
        data: {
          pacienteId: datos.pacienteId,
          profesionalId: datos.profesionalId,
          consultorioId: datos.consultorioId,
          inicio,
          fin,
          duracionMin: datos.duracionMin,
          motivo: datos.motivo,
          zonaCorporal: datos.zonaCorporal,
          retroactiva: inicio < ahora,
          creadoPorId: sesion.usuarioId,
        },
      });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "CITA_CREAR",
        entidad: "cita",
        entidadId: cita.id,
        despues: valoresCita(cita),
      });
      return { id: cita.id, retroactiva: cita.retroactiva };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}
