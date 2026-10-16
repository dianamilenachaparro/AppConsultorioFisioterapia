import { hash } from "@node-rs/argon2";
import type { Rol } from "@/lib/permisos";
import { instanteBogota, sumarDias, hoyBogota } from "@/lib/tiempo";
import type { Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";

let contador = 0;
const siguiente = () => ++contador;

/** Vacía todas las tablas (TRUNCATE no dispara los triggers por fila de auditoría). */
export async function limpiarBaseDeDatos() {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tablas.length === 0) return;
  const lista = tablas.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
}

// Hash rápido solo para pruebas (los parámetros reales están en src/server/auth/hash.ts).
const hashPrueba = hash("clave-prueba-123", { memoryCost: 1024, timeCost: 1, parallelism: 1 });
export const PASSWORD_PRUEBA = "clave-prueba-123";

export async function crearUsuarioPrueba(opciones: {
  rol: Rol;
  atiendePacientes?: boolean;
  activo?: boolean;
  cedula?: string;
  nombre?: string;
}) {
  const n = siguiente();
  return prisma.usuario.create({
    data: {
      cedula: opciones.cedula ?? String(10_000_000 + n),
      nombreCompleto: opciones.nombre ?? `Usuario Prueba ${n}`,
      rol: opciones.rol,
      atiendePacientes: opciones.atiendePacientes ?? opciones.rol === "PROFESIONAL",
      activo: opciones.activo ?? true,
      debeCambiarPassword: false,
      passwordHash: await hashPrueba,
    },
  });
}

export async function crearConsultorioPrueba(opciones: { activo?: boolean } = {}) {
  const n = siguiente();
  return prisma.consultorio.create({
    data: { nombre: `Consultorio Prueba ${n}`, orden: n, activo: opciones.activo ?? true },
  });
}

export async function crearPacientePrueba(creadoPorId: string, opciones: { documento?: string } = {}) {
  const n = siguiente();
  return prisma.paciente.create({
    data: {
      documento: opciones.documento ?? `DOC${100000 + n}`,
      nombreCompleto: `Paciente Prueba ${n}`,
      telefono: "3001234567",
      fechaNacimiento: new Date("1990-05-10T00:00:00Z"),
      direccion: "Calle 1 # 2-3",
      departamento: "Antioquia",
      ciudad: "Medellín",
      barrio: "Centro",
      creadoPorId,
    },
  });
}

export const MANANA = () => sumarDias(hoyBogota(), 1);

/** Inserta una cita directamente (sin pasar por el servicio). */
export async function crearCitaPrueba(datos: {
  pacienteId: string;
  profesionalId: string;
  consultorioId: string;
  creadoPorId: string;
  fecha?: string;
  hora?: string;
  duracionMin?: number;
  estado?: "PROGRAMADA" | "ASISTIDA" | "CANCELADA";
}) {
  const inicio = instanteBogota(datos.fecha ?? MANANA(), datos.hora ?? "09:00");
  const duracionMin = datos.duracionMin ?? 30;
  const cancelada = datos.estado === "CANCELADA";
  return prisma.cita.create({
    data: {
      pacienteId: datos.pacienteId,
      profesionalId: datos.profesionalId,
      consultorioId: datos.consultorioId,
      creadoPorId: datos.creadoPorId,
      inicio,
      duracionMin,
      fin: new Date(inicio.getTime() + duracionMin * 60_000),
      motivo: "Dolor lumbar",
      zonaCorporal: "LUMBAR",
      estado: datos.estado ?? "PROGRAMADA",
      ...(cancelada
        ? { observacionCancelacion: "Cancelada en prueba", canceladaPorId: datos.creadoPorId, canceladaEn: new Date() }
        : {}),
    },
  });
}

export function sesionDe(usuario: {
  id: string;
  rol: Rol;
  nombreCompleto: string;
  atiendePacientes: boolean;
}): Sesion {
  return {
    id: `sesion-${usuario.id}`,
    usuarioId: usuario.id,
    rol: usuario.rol,
    nombre: usuario.nombreCompleto,
    atiendePacientes: usuario.atiendePacientes,
    debeCambiarPassword: false,
  };
}

/** Escenario típico: Dueño, Recepcionista, dos Profesionales, dos consultorios y un paciente. */
export async function escenarioBase() {
  const dueno = await crearUsuarioPrueba({ rol: "DUENO" });
  const recepcionista = await crearUsuarioPrueba({ rol: "RECEPCIONISTA" });
  const profesional = await crearUsuarioPrueba({ rol: "PROFESIONAL" });
  const profesional2 = await crearUsuarioPrueba({ rol: "PROFESIONAL" });
  const consultorio = await crearConsultorioPrueba();
  const consultorio2 = await crearConsultorioPrueba();
  const paciente = await crearPacientePrueba(recepcionista.id);
  return { dueno, recepcionista, profesional, profesional2, consultorio, consultorio2, paciente };
}
