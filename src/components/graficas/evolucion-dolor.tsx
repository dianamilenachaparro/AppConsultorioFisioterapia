"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NOMBRE_ZONA, ZONAS } from "@/lib/validacion/cita";

type Zona = (typeof ZONAS)[number];
export type SerieDolor = Partial<Record<Zona, { t: number; dolor: number }[]>>;

const formatoFecha = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" });
const formatoFechaLarga = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "medium" });

/**
 * Evolución del dolor (0–10) por zona corporal (FR-027). El color de cada zona sale de su
 * posición fija en ZONAS, no del orden de aparición, para que sea el mismo en todos los pacientes
 * mientras haya 8 zonas o menos; la 9.ª y 10.ª repiten color con línea punteada.
 */
export function EvolucionDolor({ serie }: { serie: SerieDolor }) {
  const zonas = ZONAS.filter((z) => serie[z]?.length);
  if (zonas.length === 0) {
    return <p className="text-sm text-muted-foreground">Aún no hay atenciones registradas.</p>;
  }
  const estilo = (z: Zona) => {
    const i = ZONAS.indexOf(z);
    return { color: `var(--serie-${(i % 8) + 1})`, punteada: i >= 8 };
  };
  const filasTabla = zonas
    .flatMap((z) => serie[z]!.map((p) => ({ ...p, zona: z })))
    .sort((a, b) => b.t - a.t);
  // Marcas del eje X en las fechas reales de atención (máximo 6, repartidas).
  const fechas = [...new Set(filasTabla.map((f) => f.t))].sort((a, b) => a - b);
  const paso = Math.max(1, Math.ceil(fechas.length / 6));
  const marcas = fechas.filter((_, i) => i % paso === 0 || i === fechas.length - 1);

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div className="h-64 w-full min-w-0" role="img" aria-label="Gráfica de evolución del dolor por zona; la tabla siguiente tiene los mismos datos">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={marcas}
              interval="preserveStartEnd"
              padding={{ left: 16, right: 16 }}
              tickFormatter={(t: number) => formatoFecha.format(t)}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              stroke="var(--border)"
              allowDuplicatedCategory={false}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              stroke="var(--border)"
            />
            <Tooltip
              labelFormatter={(t) => formatoFechaLarga.format(Number(t))}
              formatter={(valor, nombre) => [`${valor} / 10`, nombre]}
              contentStyle={{
                background: "var(--popover)",
                color: "var(--popover-foreground)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 13,
              }}
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
            />
            {zonas.length > 1 && (
              <Legend
                iconType="plainline"
                wrapperStyle={{ fontSize: 13, color: "var(--foreground)" }}
                formatter={(nombre) => <span style={{ color: "var(--foreground)" }}>{nombre}</span>}
              />
            )}
            {zonas.map((z) => {
              const { color, punteada } = estilo(z);
              return (
                <Line
                  key={z}
                  data={serie[z]}
                  dataKey="dolor"
                  name={NOMBRE_ZONA[z]}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={punteada ? "6 4" : undefined}
                  dot={{ r: 4, fill: color, stroke: "var(--background)", strokeWidth: 2 }}
                  activeDot={{ r: 6, stroke: "var(--background)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Ver los datos como tabla</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Dolor registrado por fecha y zona</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-1 font-medium">Fecha</th>
              <th scope="col" className="py-1 font-medium">Zona</th>
              <th scope="col" className="py-1 text-right font-medium">Dolor</th>
            </tr>
          </thead>
          <tbody>
            {filasTabla.map((f, i) => (
              <tr key={i} className="border-t">
                <td className="py-1">{formatoFechaLarga.format(f.t)}</td>
                <td className="py-1">{NOMBRE_ZONA[f.zona]}</td>
                <td className="py-1 text-right tabular-nums">{f.dolor} / 10</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
