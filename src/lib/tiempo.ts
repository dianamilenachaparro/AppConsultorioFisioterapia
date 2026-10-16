import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, startOfDay, startOfMonth, startOfWeek } from "date-fns";

/** Toda fecha visible y todo corte de día/semana/mes se calcula en esta zona (FR-042). */
export const ZONA = "America/Bogota";

export type Rango = { desde: Date; hasta: Date };

/** Los 19 bloques de 30 minutos de la agenda: 07:30 … 16:30 (FR-008). */
export const BLOQUES: readonly string[] = Array.from({ length: 19 }, (_, i) => {
  const minutos = 7 * 60 + 30 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
});

export const HORA_APERTURA = "07:30";
export const HORA_CIERRE = "17:00";

function aBogota(instante: Date) {
  return new TZDate(instante.getTime(), ZONA);
}

function dos(n: number) {
  return String(n).padStart(2, "0");
}

/** Fecha calendario (Bogotá) de un instante, como `YYYY-MM-DD`. */
export function fechaBogota(instante: Date): string {
  const d = aBogota(instante);
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

/** Hora (Bogotá) de un instante, como `HH:MM`. */
export function horaBogota(instante: Date): string {
  const d = aBogota(instante);
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

export function hoyBogota(ahora: Date = new Date()): string {
  return fechaBogota(ahora);
}

export function esMismoDiaBogota(a: Date, b: Date): boolean {
  return fechaBogota(a) === fechaBogota(b);
}

function partesFecha(fecha: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!m) throw new Error(`Fecha inválida: ${fecha}`);
  return { anio: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

/** Instante correspondiente a `fecha` + `hora` (HH:MM) en hora de Bogotá. */
export function instanteBogota(fecha: string, hora: string): Date {
  const { anio, mes, dia } = partesFecha(fecha);
  const [h, min] = hora.split(":").map(Number);
  return new Date(new TZDate(anio, mes - 1, dia, h, min, 0, 0, ZONA).getTime());
}

function inicioDia(fecha: string) {
  const { anio, mes, dia } = partesFecha(fecha);
  return new TZDate(anio, mes - 1, dia, 0, 0, 0, 0, ZONA);
}

function rango(desde: TZDate, hasta: TZDate): Rango {
  return { desde: new Date(desde.getTime()), hasta: new Date(hasta.getTime()) };
}

/** Día completo en Bogotá, semiabierto `[00:00, 24:00)`. */
export function rangoDia(fecha: string): Rango {
  const d = inicioDia(fecha);
  return rango(startOfDay(d), addDays(startOfDay(d), 1));
}

/** Semana de lunes a domingo (convención colombiana) que contiene `fecha`. */
export function rangoSemana(fecha: string): Rango {
  const lunes = startOfWeek(inicioDia(fecha), { weekStartsOn: 1 });
  return rango(lunes, addDays(lunes, 7));
}

export function rangoMes(fecha: string): Rango {
  const primero = startOfMonth(inicioDia(fecha));
  return rango(primero, addMonths(primero, 1));
}

/** Rango semiabierto que cubre de `desde` a `hasta` (ambas fechas incluidas). */
export function rangoFechas(desde: string, hasta: string): Rango {
  return { desde: rangoDia(desde).desde, hasta: rangoDia(hasta).hasta };
}

export function sumarDias(fecha: string, dias: number): string {
  return fechaBogota(addDays(inicioDia(fecha), dias));
}

const formatoFechaHora = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  dateStyle: "medium",
  timeStyle: "short",
});
const formatoFecha = new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, dateStyle: "medium" });
const formatoFechaLarga = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const formatoHora = new Intl.DateTimeFormat("es-CO", {
  timeZone: ZONA,
  hour: "numeric",
  minute: "2-digit",
});

export function formatearFechaHora(instante: Date) {
  return formatoFechaHora.format(instante);
}

/** Acepta un instante o una fecha calendario `YYYY-MM-DD`. */
export function formatearFecha(valor: Date | string) {
  return formatoFecha.format(typeof valor === "string" ? instanteBogota(valor, "12:00") : valor);
}

export function formatearFechaLarga(fecha: string) {
  return formatoFechaLarga.format(instanteBogota(fecha, "12:00"));
}

export function formatearHora(instante: Date) {
  return formatoHora.format(instante);
}

/** Convierte una columna `@db.Date` (medianoche UTC) a `YYYY-MM-DD` sin desfase de zona. */
export function fechaDeColumnaDate(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

/** Convierte `YYYY-MM-DD` al valor que Prisma espera en una columna `@db.Date`. */
export function columnaDateDeFecha(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}
