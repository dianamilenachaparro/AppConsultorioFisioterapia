import { describe, expect, it } from "vitest";
import { instanteBogota } from "@/lib/tiempo";
import { calcularIndicadores, promedio, type FilaIndicador } from "@/server/indicadores/calculo";

const DIA = "2026-10-15";
const h = (hora: string) => instanteBogota(DIA, hora);

function fila(inicio: string, llegada?: string, ingreso?: string, fin?: string, estado: FilaIndicador["estado"] = "ASISTIDA"): FilaIndicador {
  return {
    inicio: h(inicio),
    estado,
    llegadaEn: llegada ? h(llegada) : null,
    ingresoEn: ingreso ? h(ingreso) : null,
    finEn: fin ? h(fin) : null,
  };
}

describe("cálculo de indicadores (FR-031)", () => {
  it("ejemplo US5-3: 08:00 / 07:55 / 08:10 / 08:40", () => {
    const r = calcularIndicadores([fila("08:00", "07:55", "08:10", "08:40")]);
    expect(r).toMatchObject({
      esperaPromedioMin: 15,
      duracionRealPromedioMin: 30,
      retrasoPromedioMin: 10,
      porcentajeATiempo: 0,
      muestras: { espera: 1, duracion: 1, puntualidad: 1 },
    });
  });

  it("a tiempo = ingreso hasta 5 minutos después de la hora programada", () => {
    const r = calcularIndicadores([
      fila("08:00", "07:50", "08:05", "08:30"),
      fila("09:00", "08:50", "09:06", "09:30"),
      fila("10:00", "09:50", "09:58", "10:30"),
    ]);
    expect(r.porcentajeATiempo).toBe(66.7);
    expect(r.retrasoPromedioMin).toBe(3);
  });

  it("excluye de cada indicador las citas sin las marcas que necesita", () => {
    const r = calcularIndicadores([
      fila("08:00", undefined, undefined, undefined, "PROGRAMADA"),
      fila("09:00", "08:55"),
      fila("10:00", "09:50", "10:00"),
      fila("11:00", "10:40", "11:00", "11:45"),
    ]);
    expect(r.muestras).toEqual({ espera: 2, duracion: 1, puntualidad: 2 });
    expect(r.esperaPromedioMin).toBe(15);
    expect(r.duracionRealPromedioMin).toBe(45);
  });

  it("las canceladas solo cuentan en los conteos", () => {
    const r = calcularIndicadores([
      fila("08:00", "07:00", "09:00", "10:00", "CANCELADA"),
      fila("09:00", undefined, undefined, undefined, "PROGRAMADA"),
      fila("10:00", "09:55", "10:00", "10:30"),
    ]);
    expect(r.conteos).toEqual({ programadas: 1, asistidas: 1, canceladas: 1 });
    expect(r.esperaPromedioMin).toBe(5);
  });

  it("sin muestras devuelve null, no 0", () => {
    const r = calcularIndicadores([]);
    expect(r.esperaPromedioMin).toBeNull();
    expect(r.porcentajeATiempo).toBeNull();
  });

  it("redondea los promedios a 1 decimal", () => {
    expect(promedio([1, 2, 2])).toBe(1.7);
  });
});
