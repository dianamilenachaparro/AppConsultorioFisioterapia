import { beforeEach, describe, expect, it } from "vitest";
import { instanteBogota } from "@/lib/tiempo";
import { prisma } from "@/server/db";
import { obtenerIndicadores } from "@/server/indicadores/consulta";
import { crearCitaPrueba, crearPacientePrueba, escenarioBase, limpiarBaseDeDatos, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  e = await escenarioBase();
});

// Miércoles 14 de octubre de 2026: su semana va del lunes 12 al domingo 18.
const MIERCOLES = "2026-10-14";

async function citaConTiempos(opciones: {
  fecha?: string;
  hora: string;
  llegada?: string;
  ingreso?: string;
  fin?: string;
  profesionalId?: string;
  consultorioId?: string;
  estado?: "PROGRAMADA" | "ASISTIDA" | "CANCELADA";
}) {
  const fecha = opciones.fecha ?? MIERCOLES;
  const paciente = await crearPacientePrueba(e.recepcionista.id);
  const cita = await crearCitaPrueba({
    pacienteId: paciente.id,
    profesionalId: opciones.profesionalId ?? e.profesional.id,
    consultorioId: opciones.consultorioId ?? e.consultorio.id,
    creadoPorId: e.recepcionista.id,
    fecha,
    hora: opciones.hora,
    estado: opciones.estado ?? (opciones.ingreso ? "ASISTIDA" : "PROGRAMADA"),
  });
  if (opciones.llegada) {
    const t = (h?: string) => (h ? instanteBogota(fecha, h) : null);
    await prisma.marcacion.create({
      data: { citaId: cita.id, llegadaEn: t(opciones.llegada), ingresoEn: t(opciones.ingreso), finEn: t(opciones.fin) },
    });
  }
  return cita;
}

describe("indicadores (US5)", () => {
  it("ejemplo US5-3 desde la BD", async () => {
    await citaConTiempos({ hora: "08:00", llegada: "07:55", ingreso: "08:10", fin: "08:40" });
    const r = await obtenerIndicadores(sesionDe(e.dueno), { periodo: "DIA", fecha: MIERCOLES });
    expect(r).toMatchObject({
      esperaPromedioMin: 15,
      duracionRealPromedioMin: 30,
      retrasoPromedioMin: 10,
      porcentajeATiempo: 0,
      conteos: { programadas: 0, asistidas: 1, canceladas: 0 },
    });
  });

  it("las citas sin llegada no entran en la espera", async () => {
    await citaConTiempos({ hora: "08:00", llegada: "07:50", ingreso: "08:00", fin: "08:30" });
    await citaConTiempos({ hora: "09:00" });
    const r = await obtenerIndicadores(sesionDe(e.dueno), { periodo: "DIA", fecha: MIERCOLES });
    expect(r.muestras.espera).toBe(1);
    expect(r.esperaPromedioMin).toBe(10);
    expect(r.conteos.programadas).toBe(1);
  });

  it("SEMANA + consultorio considera solo esas citas", async () => {
    await citaConTiempos({ fecha: "2026-10-12", hora: "08:00", llegada: "07:50", ingreso: "08:00", fin: "08:30" });
    await citaConTiempos({ fecha: "2026-10-18", hora: "08:00", llegada: "07:40", ingreso: "08:00", fin: "08:30" });
    // Otro consultorio y otra semana: fuera del filtro.
    await citaConTiempos({ hora: "10:00", llegada: "09:00", ingreso: "10:00", fin: "10:30", consultorioId: e.consultorio2.id });
    await citaConTiempos({ fecha: "2026-10-19", hora: "08:00", llegada: "07:00", ingreso: "08:00", fin: "08:30" });
    const r = await obtenerIndicadores(sesionDe(e.dueno), {
      periodo: "SEMANA",
      fecha: MIERCOLES,
      consultorioId: e.consultorio.id,
    });
    expect(r.muestras.espera).toBe(2);
    expect(r.esperaPromedioMin).toBe(15);
  });

  it("el Profesional recibe solo sus indicadores aunque pida los de otro", async () => {
    await citaConTiempos({ hora: "08:00", llegada: "07:50", ingreso: "08:00", fin: "08:30" });
    await citaConTiempos({ hora: "09:00", llegada: "08:00", ingreso: "09:00", fin: "09:30", profesionalId: e.profesional2.id });
    const r = await obtenerIndicadores(sesionDe(e.profesional), {
      periodo: "DIA",
      fecha: MIERCOLES,
      profesionalId: e.profesional2.id,
    });
    expect(r.muestras.espera).toBe(1);
    expect(r.esperaPromedioMin).toBe(10);
  });

  it("la Recepcionista no ve indicadores", async () => {
    await expect(
      obtenerIndicadores(sesionDe(e.recepcionista), { periodo: "DIA", fecha: MIERCOLES }),
    ).rejects.toMatchObject({ codigo: "SIN_PERMISO" });
  });
});
