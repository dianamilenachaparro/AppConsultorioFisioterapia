import { beforeAll, describe, expect, it } from "vitest";
import { asegurarCategoriasEgreso } from "@/lib/categorias-egreso";
import { puedeAlguna, type Accion, type Rol } from "@/lib/permisos";
import { hoyBogota, instanteBogota } from "@/lib/tiempo";
import { obtenerHistorial } from "@/server/atenciones/historial";
import { agregarNotaAclaratoria, editarAtencion, registrarAtencion } from "@/server/atenciones/servicio";
import { consultarAuditoria } from "@/server/auditoria/consulta";
import type { Sesion } from "@/server/auth/sesion";
import { crearCita } from "@/server/citas/crear";
import { cancelarCita, marcarAsistida, revertirEstadoCita } from "@/server/citas/estados";
import { obtenerGrilla } from "@/server/citas/grilla";
import { listarCitas, obtenerCita, obtenerMiAgenda } from "@/server/citas/listar";
import { reprogramarCita } from "@/server/citas/reprogramar";
import { cambiarEstadoConsultorio, crearConsultorio, editarConsultorio } from "@/server/consultorios/servicio";
import { prisma } from "@/server/db";
import { obtenerCobrosCita, registrarCobroTerapia } from "@/server/finanzas/cobros";
import { consultarFinanzas } from "@/server/finanzas/consulta";
import { registrarEgreso } from "@/server/finanzas/egresos";
import { listarMisMovimientosHoy } from "@/server/finanzas/mis-movimientos";
import { exportarFinanzasAGoogle } from "@/server/google/exportar";
import { obtenerIndicadores } from "@/server/indicadores/consulta";
import { crearInsumo, editarInsumo, listarInsumos, registrarReposicion, registrarVenta } from "@/server/inventario/servicio";
import { corregirMarcacion, marcarLlegada } from "@/server/marcaciones/servicio";
import { buscarPacientes, crearPaciente, editarPaciente, obtenerPaciente } from "@/server/pacientes/servicio";
import { cambiarEstadoUsuario, crearUsuario, editarUsuario, restablecerPassword } from "@/server/usuarios/servicio";
import { crearCitaPrueba, crearPacientePrueba, escenarioBase, limpiarBaseDeDatos, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;
let citaAsistida: string;
let citaOtroProfesional: string;
let pacienteAjeno: string;
let insumo: string;
let atencion: string;
let categoria: string;
const sesiones = {} as Record<Rol, Sesion>;
const HOY = hoyBogota();

beforeAll(async () => {
  await limpiarBaseDeDatos();
  await asegurarCategoriasEgreso(prisma);
  e = await escenarioBase();
  sesiones.DUENO = sesionDe(e.dueno);
  sesiones.RECEPCIONISTA = sesionDe(e.recepcionista);
  sesiones.PROFESIONAL = sesionDe(e.profesional);
  const base = { pacienteId: e.paciente.id, consultorioId: e.consultorio.id, creadoPorId: e.recepcionista.id, fecha: HOY };
  citaAsistida = (await crearCitaPrueba({ ...base, profesionalId: e.profesional.id, hora: "08:00", estado: "ASISTIDA" })).id;
  const otro = await crearPacientePrueba(e.recepcionista.id);
  pacienteAjeno = otro.id;
  citaOtroProfesional = (
    await crearCitaPrueba({ ...base, pacienteId: otro.id, profesionalId: e.profesional2.id, hora: "10:00", estado: "ASISTIDA" })
  ).id;
  insumo = (await crearInsumo(sesiones.DUENO, { nombre: "Gel", costo: 1, precioVenta: 2, stockInicial: 10, stockMinimo: 1 })).id;
  atencion = (
    await registrarAtencion(sesiones.PROFESIONAL, {
      citaId: citaAsistida,
      zonaCorporal: "LUMBAR",
      motivo: "Dolor",
      tecnica: "Manual",
      dolor: 5,
      notasEvolucion: "Bien",
    })
  ).id;
  categoria = (await prisma.categoriaEgreso.findFirstOrThrow()).id;
});

type Caso = [nombre: string, acciones: Accion[], llamar: (s: Sesion) => Promise<unknown>];

const campos = { zonaCorporal: "LUMBAR" as const, motivo: "Dolor", tecnica: "Manual", dolor: 4, notasEvolucion: "Bien" };

// Todas las acciones de contracts/server-actions.md con el permiso que exigen.
const CASOS: Caso[] = [
  ["crearUsuario", ["admin:usuarios"], (s) => crearUsuario(s, { cedula: "55555555", nombreCompleto: "Nuevo", rol: "PROFESIONAL", passwordInicial: "clave12345" })],
  ["editarUsuario", ["admin:usuarios"], (s) => editarUsuario(s, { id: e.profesional2.id, nombreCompleto: "Otro nombre" })],
  ["cambiarEstadoUsuario", ["admin:usuarios"], (s) => cambiarEstadoUsuario(s, { id: e.profesional2.id, activo: false, confirmar: true })],
  ["restablecerPassword", ["admin:usuarios"], (s) => restablecerPassword(s, { id: e.profesional2.id, passwordNueva: "otra-clave-1" })],
  ["crearConsultorio", ["admin:consultorios"], (s) => crearConsultorio(s, { nombre: "Consultorio Matriz" })],
  ["editarConsultorio", ["admin:consultorios"], (s) => editarConsultorio(s, { id: e.consultorio2.id, nombre: "Renombrado" })],
  ["cambiarEstadoConsultorio", ["admin:consultorios"], (s) => cambiarEstadoConsultorio(s, { id: e.consultorio2.id, activo: false, confirmar: true })],
  ["consultarAuditoria", ["admin:auditoria"], (s) => consultarAuditoria(s, { desde: HOY, hasta: HOY })],
  ["crearPaciente", ["pacientes:gestionar"], (s) => crearPaciente(s, { documento: "MATRIZ1", nombreCompleto: "Paciente Matriz", telefono: "3000000000", fechaNacimiento: "1990-01-01", direccion: "Calle 1", departamento: "Antioquia", ciudad: "Medellín", barrio: "Centro" })],
  ["editarPaciente", ["pacientes:gestionar"], (s) => editarPaciente(s, { id: e.paciente.id, telefono: "3111111111" })],
  ["crearCita", ["citas:gestionar"], (s) => crearCita(s, { pacienteId: e.paciente.id, consultorioId: e.consultorio2.id, profesionalId: e.profesional2.id, fecha: HOY, horaInicio: "15:00", duracionMin: 30, motivo: "Control", zonaCorporal: "LUMBAR" })],
  ["reprogramarCita", ["citas:gestionar"], (s) => reprogramarCita(s, { id: citaAsistida, horaInicio: "11:00" })],
  ["marcarAsistida", ["citas:gestionar"], (s) => marcarAsistida(s, { id: citaAsistida })],
  ["cancelarCita", ["citas:gestionar"], (s) => cancelarCita(s, { id: citaAsistida, observacion: "Prueba de permisos" })],
  ["revertirEstadoCita", ["citas:revertir_estado"], (s) => revertirEstadoCita(s, { id: citaAsistida, motivo: "Prueba de permisos" })],
  ["obtenerGrilla", ["agenda:ver_todas"], (s) => obtenerGrilla(s, { consultorioId: e.consultorio.id, fecha: HOY })],
  ["obtenerMiAgenda", ["agenda:ver_propia"], (s) => obtenerMiAgenda(s, { fecha: HOY })],
  ["listarCitas", ["citas:listar"], (s) => listarCitas(s, { desde: HOY, hasta: HOY })],
  ["marcarLlegada", ["marcaciones:registrar"], (s) => marcarLlegada(s, { citaId: citaAsistida })],
  ["corregirMarcacion", ["marcaciones:corregir"], (s) => corregirMarcacion(s, { citaId: citaAsistida, llegadaEn: instanteBogota(HOY, "07:50"), motivo: "Prueba de permisos" })],
  ["obtenerIndicadores", ["indicadores:ver_todos", "indicadores:ver_propios"], (s) => obtenerIndicadores(s, { periodo: "DIA", fecha: HOY })],
  ["registrarAtencion", ["atenciones:registrar"], (s) => registrarAtencion(s, { citaId: citaOtroProfesional, ...campos })],
  ["editarAtencion", ["atenciones:registrar"], (s) => editarAtencion(s, { id: atencion, ...campos })],
  ["agregarNotaAclaratoria", ["atenciones:registrar"], (s) => agregarNotaAclaratoria(s, { atencionId: atencion, texto: "Nota de prueba" })],
  ["obtenerHistorial", ["historial:ver_todos", "historial:ver_propios"], (s) => obtenerHistorial(s, { pacienteId: e.paciente.id })],
  ["listarInsumos", ["inventario:gestionar", "inventario:vender"], (s) => listarInsumos(s)],
  ["crearInsumo", ["inventario:gestionar"], (s) => crearInsumo(s, { nombre: "Insumo Matriz", costo: 1, precioVenta: 1, stockInicial: 1, stockMinimo: 0 })],
  ["editarInsumo", ["inventario:gestionar"], (s) => editarInsumo(s, { id: insumo, precioVenta: 3 })],
  ["registrarVenta", ["inventario:vender"], (s) => registrarVenta(s, { insumoId: insumo, cantidad: 1, medioPago: "EFECTIVO" })],
  ["registrarReposicion", ["inventario:gestionar"], (s) => registrarReposicion(s, { insumoId: insumo, cantidad: 1, costoUnitario: 1, medioPago: "EFECTIVO" })],
  ["obtenerCobrosCita", ["cobro:registrar"], (s) => obtenerCobrosCita(s, { citaId: citaAsistida })],
  ["registrarCobroTerapia", ["cobro:registrar"], (s) => registrarCobroTerapia(s, { citaId: citaAsistida, valor: 1_000, medioPago: "EFECTIVO" })],
  ["registrarEgreso", ["finanzas:egresos"], (s) => registrarEgreso(s, { categoriaId: categoria, fecha: HOY, valor: 1_000, medioPago: "EFECTIVO", descripcion: "Prueba" })],
  ["consultarFinanzas", ["finanzas:ver"], (s) => consultarFinanzas(s, { desde: HOY, hasta: HOY })],
  ["exportarFinanzasAGoogle", ["finanzas:exportar"], (s) => exportarFinanzasAGoogle(s, { desde: HOY, hasta: HOY })],
  ["listarMisMovimientosHoy", ["movimientos:ver_propios_hoy"], (s) => listarMisMovimientosHoy(s)],
];

/** Conteo de filas de cada tabla: debe quedar idéntico tras una llamada rechazada. */
async function fotografia() {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY 1`;
  const conteos: Record<string, number> = {};
  for (const { tablename } of tablas) {
    const [{ n }] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "${tablename}"`);
    conteos[tablename] = Number(n);
  }
  return conteos;
}

const ROLES: Rol[] = ["DUENO", "RECEPCIONISTA", "PROFESIONAL"];
const prohibidos = CASOS.flatMap(([nombre, acciones, llamar]) =>
  ROLES.filter((rol) => !puedeAlguna(rol, acciones)).map((rol) => [`${rol} → ${nombre}`, rol, llamar] as const),
);

describe("matriz de permisos (SC-005)", () => {
  it("cubre todas las combinaciones prohibidas", () => {
    expect(prohibidos.length).toBeGreaterThan(40);
  });

  it.each(prohibidos)("%s → SIN_PERMISO sin cambios en la BD", async (_nombre, rol, llamar) => {
    const antes = await fotografia();
    await expect(llamar(sesiones[rol])).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    expect(await fotografia()).toEqual(antes);
  });
});

describe("el Profesional solo accede a lo propio", () => {
  const P = () => sesiones.PROFESIONAL;

  it("citas: lista solo las suyas y no abre las de otro", async () => {
    const r = await listarCitas(P(), { desde: HOY, hasta: HOY, profesionalId: e.profesional2.id });
    expect(r.filas.every((c) => c.profesional.id === e.profesional.id)).toBe(true);
    await expect(obtenerCita(P(), citaOtroProfesional)).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });

  it("pacientes: solo los que tienen cita con él", async () => {
    const r = await buscarPacientes(P(), {});
    expect(r.filas.map((p) => p.id)).toEqual([e.paciente.id]);
    await expect(obtenerPaciente(P(), pacienteAjeno)).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });

  it("historial, cobros y marcaciones de citas ajenas se rechazan", async () => {
    await expect(obtenerHistorial(P(), { pacienteId: pacienteAjeno })).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    await expect(obtenerCobrosCita(P(), { citaId: citaOtroProfesional })).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    await expect(
      registrarCobroTerapia(P(), { citaId: citaOtroProfesional, valor: 1_000, medioPago: "EFECTIVO" }),
    ).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    await expect(marcarLlegada(P(), { citaId: citaOtroProfesional })).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
    await expect(registrarAtencion(P(), { citaId: citaOtroProfesional, ...campos })).rejects.toMatchObject({
      codigo: "SIN_PERMISO",
    });
  });

  it("indicadores: forzados a sí mismo aunque pida otro profesional", async () => {
    await prisma.marcacion.create({
      data: { citaId: citaOtroProfesional, llegadaEn: instanteBogota(HOY, "09:00"), ingresoEn: instanteBogota(HOY, "10:00") },
    });
    const r = await obtenerIndicadores(P(), { periodo: "DIA", fecha: HOY, profesionalId: e.profesional2.id });
    expect(r.muestras.espera).toBe(0);
    expect(r.conteos.asistidas).toBe(1);
  });
});
