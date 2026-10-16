/**
 * Registro de errores sin datos personales ni de salud (Ley 1581 de 2012).
 * Solo se registran el contexto, el nombre/código del error y las líneas "at …" de su pila.
 * Nunca el mensaje: los errores de Prisma y de validación copian en él los valores de la
 * consulta o de la entrada (nombres, documentos, notas clínicas).
 */
export function registrarError(contexto: string, error: unknown) {
  const e = error as { name?: string; code?: unknown; stack?: string } | undefined;
  const codigo = typeof e?.code === "string" || typeof e?.code === "number" ? String(e.code) : "";
  const pila = (e?.stack ?? "")
    .split("\n")
    .filter((l) => /^\s+at /.test(l))
    .slice(0, 6)
    .join("\n");
  console.error(`[${contexto}]`, e?.name ?? "Error", codigo, pila);
}
