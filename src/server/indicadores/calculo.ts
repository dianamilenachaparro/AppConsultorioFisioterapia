/** Cálculo puro de los indicadores de tiempos (FR-031). Sin acceso a datos, para probarlo aislado. */

export type FilaIndicador = {
  inicio: Date;
  estado: "PROGRAMADA" | "ASISTIDA" | "CANCELADA";
  llegadaEn: Date | null;
  ingresoEn: Date | null;
  finEn: Date | null;
};

/** Se considera "a tiempo" un ingreso hasta 5 minutos después de la hora programada. */
export const TOLERANCIA_A_TIEMPO_MIN = 5;

const minutos = (desde: Date, hasta: Date) => (hasta.getTime() - desde.getTime()) / 60_000;

/** Promedio redondeado a 1 decimal, o `null` sin muestras. */
export function promedio(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
}

export function esperaMin(f: FilaIndicador) {
  return f.llegadaEn && f.ingresoEn ? minutos(f.llegadaEn, f.ingresoEn) : null;
}

export function duracionMin(f: FilaIndicador) {
  return f.ingresoEn && f.finEn ? minutos(f.ingresoEn, f.finEn) : null;
}

/** Positivo si empezó tarde, negativo si empezó antes de la hora programada. */
export function retrasoMin(f: FilaIndicador) {
  return f.ingresoEn ? minutos(f.inicio, f.ingresoEn) : null;
}

/**
 * Las canceladas solo cuentan en los conteos. Cada indicador usa las citas que tienen
 * las marcas que necesita; `muestras` dice cuántas fueron.
 */
export function calcularIndicadores(filas: FilaIndicador[]) {
  const conteos = { programadas: 0, asistidas: 0, canceladas: 0 };
  const esperas: number[] = [];
  const duraciones: number[] = [];
  const retrasos: number[] = [];
  for (const f of filas) {
    if (f.estado === "PROGRAMADA") conteos.programadas++;
    else if (f.estado === "ASISTIDA") conteos.asistidas++;
    else {
      conteos.canceladas++;
      continue;
    }
    const e = esperaMin(f);
    const d = duracionMin(f);
    const r = retrasoMin(f);
    if (e !== null) esperas.push(e);
    if (d !== null) duraciones.push(d);
    if (r !== null) retrasos.push(r);
  }
  const aTiempo = retrasos.filter((r) => r <= TOLERANCIA_A_TIEMPO_MIN).length;
  return {
    esperaPromedioMin: promedio(esperas),
    duracionRealPromedioMin: promedio(duraciones),
    retrasoPromedioMin: promedio(retrasos),
    porcentajeATiempo: retrasos.length ? Math.round((aTiempo / retrasos.length) * 1000) / 10 : null,
    conteos,
    muestras: { espera: esperas.length, duracion: duraciones.length, puntualidad: retrasos.length },
  };
}

export type Indicadores = ReturnType<typeof calcularIndicadores>;
