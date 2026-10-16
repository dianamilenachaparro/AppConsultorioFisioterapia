import { describe, expect, it } from "vitest";
import {
  BLOQUES,
  esMismoDiaBogota,
  fechaBogota,
  horaBogota,
  hoyBogota,
  instanteBogota,
  rangoDia,
  rangoMes,
  rangoSemana,
} from "@/lib/tiempo";

describe("tiempo (America/Bogota)", () => {
  it("genera los 19 bloques de 07:30 a 16:30", () => {
    expect(BLOQUES).toHaveLength(19);
    expect(BLOQUES[0]).toBe("07:30");
    expect(BLOQUES.at(-1)).toBe("16:30");
  });

  it("calcula el día de Bogotá aunque en UTC ya sea el día siguiente", () => {
    expect(hoyBogota(new Date("2026-10-15T04:30:00Z"))).toBe("2026-10-14");
    expect(hoyBogota(new Date("2026-10-15T05:00:00Z"))).toBe("2026-10-15");
  });

  it("convierte fecha y hora de Bogotá a instante UTC (UTC−5)", () => {
    const i = instanteBogota("2026-10-14", "07:30");
    expect(i.toISOString()).toBe("2026-10-14T12:30:00.000Z");
    expect(fechaBogota(i)).toBe("2026-10-14");
    expect(horaBogota(i)).toBe("07:30");
  });

  it("la semana empieza el lunes a las 00:00 de Bogotá", () => {
    // 2026-10-14 es miércoles.
    const { desde, hasta } = rangoSemana("2026-10-14");
    expect(desde.toISOString()).toBe("2026-10-12T05:00:00.000Z");
    expect(hasta.toISOString()).toBe("2026-10-19T05:00:00.000Z");
  });

  it("rango de día y de mes son semiabiertos en hora de Bogotá", () => {
    expect(rangoDia("2026-10-14")).toEqual({
      desde: new Date("2026-10-14T05:00:00.000Z"),
      hasta: new Date("2026-10-15T05:00:00.000Z"),
    });
    expect(rangoMes("2026-10-14")).toEqual({
      desde: new Date("2026-10-01T05:00:00.000Z"),
      hasta: new Date("2026-11-01T05:00:00.000Z"),
    });
  });

  it("detecta el corte de medianoche en Bogotá", () => {
    const antes = new Date("2026-10-15T04:59:00Z"); // 23:59 del 14
    const despues = new Date("2026-10-15T05:00:00Z"); // 00:00 del 15
    expect(esMismoDiaBogota(new Date("2026-10-14T13:00:00Z"), antes)).toBe(true);
    expect(esMismoDiaBogota(new Date("2026-10-14T13:00:00Z"), despues)).toBe(false);
  });
});
