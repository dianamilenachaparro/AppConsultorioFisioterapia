import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ErrorDominio, traducirErrorBD } from "@/lib/resultado";
import { columnaDateDeFecha, fechaDeColumnaDate } from "@/lib/tiempo";
import { normalizarDocumento } from "@/lib/validacion/comunes";
import { editarPacienteSchema, pacienteSchema, type PacienteEntrada } from "@/lib/validacion/paciente";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";

export type PacienteVista = {
  id: string;
  documento: string;
  nombreCompleto: string;
  telefono: string;
  fechaNacimiento: string;
  direccion: string;
  departamento: string;
  ciudad: string;
  barrio: string;
};

type FilaPaciente = Prisma.PacienteGetPayload<object>;

function aVista(p: FilaPaciente): PacienteVista {
  return {
    id: p.id,
    documento: p.documento,
    nombreCompleto: p.nombreCompleto,
    telefono: p.telefono,
    fechaNacimiento: fechaDeColumnaDate(p.fechaNacimiento),
    direccion: p.direccion,
    departamento: p.departamento,
    ciudad: p.ciudad,
    barrio: p.barrio,
  };
}

/** Datos para auditoría (sin el id). */
function valores(p: PacienteVista): Record<string, unknown> {
  return Object.fromEntries(Object.entries(p).filter(([k]) => k !== "id"));
}

/** Restricción del Profesional: solo pacientes con al menos una cita suya (cualquier estado). */
function filtroPropios(sesion: Sesion): Prisma.PacienteWhereInput {
  return sesion.rol === "PROFESIONAL" ? { citas: { some: { profesionalId: sesion.usuarioId } } } : {};
}

export async function buscarPacientePorDocumento(sesion: Sesion, documento: string) {
  exigirPermiso(sesion, "pacientes:gestionar");
  const doc = normalizarDocumento(documento);
  if (!doc) return null;
  const p = await prisma.paciente.findUnique({ where: { documento: doc } });
  return p ? aVista(p) : null;
}

export const TAMANO_PAGINA_PACIENTES = 20;

export async function buscarPacientes(sesion: Sesion, { q, pagina = 1 }: { q?: string; pagina?: number }) {
  exigirPermiso(sesion, ["pacientes:gestionar", "pacientes:consultar_propios"]);
  const texto = q?.trim();
  const where: Prisma.PacienteWhereInput = {
    AND: [
      filtroPropios(sesion),
      texto
        ? {
            OR: [
              { documento: { startsWith: normalizarDocumento(texto) } },
              { nombreCompleto: { contains: texto, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
  const [filas, total] = await Promise.all([
    prisma.paciente.findMany({
      where,
      orderBy: { nombreCompleto: "asc" },
      skip: (Math.max(1, pagina) - 1) * TAMANO_PAGINA_PACIENTES,
      take: TAMANO_PAGINA_PACIENTES,
    }),
    prisma.paciente.count({ where }),
  ]);
  return { filas: filas.map(aVista), total };
}

export async function obtenerPaciente(sesion: Sesion, id: string) {
  exigirPermiso(sesion, ["pacientes:gestionar", "pacientes:consultar_propios"]);
  const p = await prisma.paciente.findFirst({ where: { id, ...filtroPropios(sesion) } });
  if (!p) {
    if (sesion.rol === "PROFESIONAL" && (await prisma.paciente.count({ where: { id } }))) {
      throw new ErrorDominio("SIN_PERMISO");
    }
    throw new ErrorDominio("NO_ENCONTRADO", "Paciente no encontrado");
  }
  return aVista(p);
}

/**
 * Registra un paciente nuevo. Si el documento ya existe responde `DUPLICADO`
 * con el paciente existente en `data`, para cargarlo en el formulario.
 */
export async function crearPaciente(sesion: Sesion, entrada: PacienteEntrada) {
  exigirPermiso(sesion, "pacientes:gestionar");
  const datos = pacienteSchema.parse(entrada);
  try {
    return await prisma.$transaction(async (tx) => {
      const p = await tx.paciente.create({
        data: { ...datos, fechaNacimiento: columnaDateDeFecha(datos.fechaNacimiento), creadoPorId: sesion.usuarioId },
      });
      const vista = aVista(p);
      await auditar(tx, {
        usuarioId: sesion.usuarioId,
        accion: "PACIENTE_CREAR",
        entidad: "paciente",
        entidadId: p.id,
        despues: valores(vista),
      });
      return vista;
    });
  } catch (e) {
    const err = traducirErrorBD(e);
    if (err?.codigo === "DUPLICADO") {
      const existente = await prisma.paciente.findUnique({ where: { documento: datos.documento } });
      throw new ErrorDominio(
        "DUPLICADO",
        "Ya existe un paciente con ese documento; se cargaron sus datos.",
        existente ? aVista(existente) : undefined,
      );
    }
    throw e;
  }
}

/** Edita datos del paciente. El documento solo lo puede cambiar el Dueño. */
export async function editarPaciente(sesion: Sesion, entrada: unknown) {
  exigirPermiso(sesion, "pacientes:gestionar");
  const { id, ...cambios } = editarPacienteSchema.parse(entrada);
  if (cambios.documento !== undefined && sesion.rol !== "DUENO") {
    const actual = await prisma.paciente.findUnique({ where: { id }, select: { documento: true } });
    if (actual && actual.documento !== cambios.documento) {
      throw new ErrorDominio("SIN_PERMISO", "Solo el Dueño puede cambiar el documento del paciente");
    }
    delete cambios.documento;
  }
  return prisma.$transaction(async (tx) => {
    const antes = await tx.paciente.findUnique({ where: { id } });
    if (!antes) throw new ErrorDominio("NO_ENCONTRADO", "Paciente no encontrado");
    const p = await tx.paciente.update({
      where: { id },
      data: {
        ...cambios,
        ...(cambios.fechaNacimiento ? { fechaNacimiento: columnaDateDeFecha(cambios.fechaNacimiento) } : {}),
      },
    });
    const vista = aVista(p);
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: "PACIENTE_EDITAR",
      entidad: "paciente",
      entidadId: id,
      antes: valores(aVista(antes)),
      despues: valores(vista),
    });
    return vista;
  });
}
