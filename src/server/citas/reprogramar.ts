import "server-only";
import { z } from "zod";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { fechaBogota, horaBogota } from "@/lib/tiempo";
import { reprogramarCitaSchema } from "@/lib/validacion/cita";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";
import { calcularHorario, exigirConsultorioActivo, exigirProfesionalAsignable, valoresCita } from "./comun";
import { bloquearCita } from "./estados";

/** Cambia fecha, hora, duración, consultorio o profesional de una cita PROGRAMADA (FR-021). */
export async function reprogramarCita(sesion: Sesion, entrada: z.input<typeof reprogramarCitaSchema>) {
  exigirPermiso(sesion, "citas:gestionar");
  const datos = reprogramarCitaSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const cita = await bloquearCita(tx, datos.id);
      if (cita.estado !== "PROGRAMADA") {
        throw new ErrorDominio("ESTADO_INVALIDO", "Solo se puede reprogramar una cita Programada");
      }
      const consultorioId = datos.consultorioId ?? cita.consultorioId;
      const profesionalId = datos.profesionalId ?? cita.profesionalId;
      const fecha = datos.fecha ?? fechaBogota(cita.inicio);
      const horaInicio = datos.horaInicio ?? horaBogota(cita.inicio);
      const duracionMin = datos.duracionMin ?? cita.duracionMin;
      const { inicio, fin } = calcularHorario(fecha, horaInicio, duracionMin);
      if (consultorioId !== cita.consultorioId) await exigirConsultorioActivo(tx, consultorioId);
      if (profesionalId !== cita.profesionalId) await exigirProfesionalAsignable(tx, profesionalId);

      const nueva = await tx.cita.update({
        where: { id: cita.id },
        data: { consultorioId, profesionalId, inicio, fin, duracionMin, actualizadoPorId: sesion.usuarioId },
      });
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "CITA_REPROGRAMAR",
        entidad: "cita",
        entidadId: cita.id,
        antes: valoresCita(cita),
        despues: valoresCita(nueva),
      });
      return { id: cita.id };
    });
  } catch (e) {
    throw traducirErrorBD(e) ?? e;
  }
}
