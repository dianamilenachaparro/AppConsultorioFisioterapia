/** Categorías fijas de egreso (data-model.md → CategoriaEgreso). `COMPRA_INSUMOS` la usa el sistema en reposiciones. */
export const CATEGORIAS_EGRESO = [
  { clave: "ARRIENDO", nombre: "Arriendo" },
  { clave: "SERVICIOS_PUBLICOS", nombre: "Servicios públicos" },
  { clave: "COMPRA_INSUMOS", nombre: "Compra de insumos" },
  { clave: "NOMINA", nombre: "Nómina" },
  { clave: "MANTENIMIENTO", nombre: "Mantenimiento" },
  { clave: "OTROS", nombre: "Otros" },
] as const;

type ClienteCategorias = {
  categoriaEgreso: {
    upsert(args: {
      where: { clave: string };
      update: object;
      create: { clave: string; nombre: string };
    }): Promise<unknown>;
  };
};

/** Crea las que falten sin tocar las existentes (idempotente). */
export async function asegurarCategoriasEgreso(db: ClienteCategorias) {
  for (const c of CATEGORIAS_EGRESO) {
    await db.categoriaEgreso.upsert({ where: { clave: c.clave }, update: {}, create: c });
  }
}
