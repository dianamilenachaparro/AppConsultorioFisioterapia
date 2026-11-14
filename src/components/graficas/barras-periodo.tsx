"use client";

import { useState } from "react";
import { Bar, BarChart, ResponsiveContainer, XAxis } from "recharts";

export type BarraPeriodo = {
  /** Texto corto del eje (día o mes). */
  etiqueta: string;
  /** Texto largo para el encabezado ("12 nov", "nov 2026"). */
  detalle: string;
  valor: number;
  /** Valor ya formateado completo y compacto (para el globo). */
  texto: string;
  corto: string;
};

/**
 * Barras grises redondeadas; la seleccionada (por defecto la mayor) se pinta en azul con un globo
 * oscuro encima, y su valor se repite grande en el encabezado. Pasar el cursor o tocar cambia la selección.
 */
export function BarrasPeriodo({ titulo, datos }: { titulo: string; datos: BarraPeriodo[] }) {
  const mayor = datos.reduce((m, d, i) => (d.valor > datos[m].valor ? i : m), 0);
  const [activo, setActivo] = useState(mayor);
  const actual = datos[activo] ?? datos[mayor];
  const elegir = (estado: { activeTooltipIndex?: number | string | null }) => {
    const i = Number(estado.activeTooltipIndex);
    if (Number.isInteger(i) && datos[i]) setActivo(i);
  };

  if (!actual || datos.every((d) => d.valor === 0)) {
    return (
      <div className="flex h-full min-h-48 flex-col gap-1">
        <h2 className="font-semibold">{titulo}</h2>
        <p className="m-auto text-sm text-muted-foreground">No hay movimientos en este periodo.</p>
      </div>
    );
  }

  return (
    <figure className="flex min-w-0 flex-col gap-4">
      <figcaption className="flex flex-col gap-1">
        <span className="font-semibold">{titulo}</span>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="cifra text-3xl">{actual.texto}</span>
          <span className="text-sm text-muted-foreground">{actual.detalle}</span>
        </span>
      </figcaption>
      <div
        className="h-56 w-full min-w-0 sm:h-64"
        role="img"
        aria-label={`Gráfica de barras: ${titulo.toLowerCase()}. La tabla siguiente tiene los mismos datos.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={datos}
            margin={{ top: 44, right: 4, bottom: 0, left: 4 }}
            barCategoryGap="22%"
            onMouseMove={elegir}
            onClick={elegir}
            accessibilityLayer={false}
          >
            <XAxis
              dataKey="etiqueta"
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={6}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Bar
              dataKey="valor"
              maxBarSize={44}
              isAnimationActive={false}
              shape={(props: { x?: number; y?: number; width?: number; height?: number; index?: number }) => {
                const { x = 0, y = 0, width = 0, height = 0, index = -1 } = props;
                const esActivo = index === activo;
                // Los días en cero muestran una base corta para que se lea el ritmo del periodo.
                const alto = Math.max(height, 8);
                const arriba = y + height - alto;
                const cx = x + width / 2;
                const texto = datos[index]?.corto ?? "";
                const ancho = Math.max(56, texto.length * 7.4 + 22);
                return (
                  <g className="cursor-pointer">
                    <rect
                      x={x}
                      y={arriba}
                      width={width}
                      height={alto}
                      rx={Math.min(10, width / 2)}
                      fill={esActivo ? "var(--primary)" : "var(--chart-2)"}
                      className="transition-[fill] duration-200"
                    />
                    {esActivo && (
                      <g pointerEvents="none">
                        <rect x={cx - ancho / 2} y={arriba - 42} width={ancho} height={30} rx={10} fill="var(--foreground)" />
                        <path d={`M${cx - 6} ${arriba - 12} L${cx} ${arriba - 6} L${cx + 6} ${arriba - 12} Z`} fill="var(--foreground)" />
                        <text x={cx} y={arriba - 22.5} textAnchor="middle" fill="var(--background)" fontSize={12.5} fontWeight={600}>
                          {texto}
                        </text>
                      </g>
                    )}
                  </g>
                );
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Ver los datos como tabla</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">{titulo}</caption>
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-1.5 font-medium">Periodo</th>
              <th scope="col" className="py-1.5 text-right font-medium">Valor</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d, i) => (
              <tr key={d.etiqueta + i} className="border-t">
                <td className="py-1.5">{d.detalle}</td>
                <td className="py-1.5 text-right tabular-nums">{d.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
