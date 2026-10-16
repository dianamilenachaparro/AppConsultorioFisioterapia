/**
 * Registro de errores sin datos personales ni de salud (Ley 1581 de 2012).
 * Solo se registran el contexto, el nombre/código del error y su pila; nunca
 * los datos de entrada ni los valores de las filas.
 */
export function registrarError(contexto: string, error: unknown) {
  const e = error as { name?: string; code?: string; stack?: string } | undefined;
  console.error(`[${contexto}]`, e?.name ?? "Error", e?.code ?? "", e?.stack?.split("\n").slice(0, 6).join("\n") ?? "");
}
