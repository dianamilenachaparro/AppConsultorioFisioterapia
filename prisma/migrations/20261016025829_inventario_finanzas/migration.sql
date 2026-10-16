-- CreateTable
CREATE TABLE "insumo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "costo" INTEGER NOT NULL,
    "precio_venta" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stock_minimo" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "insumo_id" UUID NOT NULL,
    "tipo" "TipoMovimientoInventario" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "valor_unitario" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "anulado_por" UUID,
    "anulado_en" TIMESTAMPTZ(6),
    "motivo_anulacion" TEXT,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categoria_egreso" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categoria_egreso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimiento_financiero" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" "TipoMovimientoFinanciero" NOT NULL,
    "subtipo_ingreso" "SubtipoIngreso",
    "categoria_egreso_id" UUID,
    "fecha" DATE NOT NULL,
    "valor" INTEGER NOT NULL,
    "medio_pago" "MedioPago" NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cita_id" UUID,
    "movimiento_inventario_id" UUID,
    "anulado" BOOLEAN NOT NULL DEFAULT false,
    "anulado_por" UUID,
    "anulado_en" TIMESTAMPTZ(6),
    "motivo_anulacion" TEXT,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_financiero_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movimiento_inventario_insumo_id_creado_en_idx" ON "movimiento_inventario"("insumo_id", "creado_en");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_egreso_clave_key" ON "categoria_egreso"("clave");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_financiero_movimiento_inventario_id_key" ON "movimiento_financiero"("movimiento_inventario_id");

-- CreateIndex
CREATE INDEX "movimiento_financiero_fecha_idx" ON "movimiento_financiero"("fecha");

-- CreateIndex
CREATE INDEX "movimiento_financiero_tipo_fecha_idx" ON "movimiento_financiero"("tipo", "fecha");

-- CreateIndex
CREATE INDEX "movimiento_financiero_medio_pago_fecha_idx" ON "movimiento_financiero"("medio_pago", "fecha");

-- CreateIndex
CREATE INDEX "movimiento_financiero_cita_id_idx" ON "movimiento_financiero"("cita_id");

-- CreateIndex
CREATE INDEX "movimiento_financiero_creado_por_creado_en_idx" ON "movimiento_financiero"("creado_por", "creado_en");

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_insumo_id_fkey" FOREIGN KEY ("insumo_id") REFERENCES "insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_categoria_egreso_id_fkey" FOREIGN KEY ("categoria_egreso_id") REFERENCES "categoria_egreso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_movimiento_inventario_id_fkey" FOREIGN KEY ("movimiento_inventario_id") REFERENCES "movimiento_inventario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_anulado_por_fkey" FOREIGN KEY ("anulado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── SQL manual (data-model.md → Insumo, MovimientoInventario, MovimientoFinanciero) ─

-- Stock nunca negativo (SC-007); el nombre lo traduce la app a STOCK_INSUFICIENTE.
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_stock_no_negativo" CHECK ("stock" >= 0);
ALTER TABLE "insumo" ADD CONSTRAINT "insumo_valores_no_negativos"
  CHECK ("costo" >= 0 AND "precio_venta" >= 0 AND "stock_minimo" >= 0);
-- Nombre único sin distinguir mayúsculas.
CREATE UNIQUE INDEX "insumo_nombre_lower_key" ON "insumo" (lower("nombre"));

ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_cantidad_positiva" CHECK ("cantidad" > 0);
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_valor_no_negativo" CHECK ("valor_unitario" >= 0);
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "movimiento_inventario_anulacion_completa"
  CHECK (NOT "anulado" OR ("anulado_por" IS NOT NULL AND "anulado_en" IS NOT NULL AND "motivo_anulacion" IS NOT NULL));

ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_valor_positivo" CHECK ("valor" > 0);
-- Coherencia tipo / subtipo / categoría / enlaces.
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_coherente"
  CHECK (("tipo" = 'INGRESO' AND "subtipo_ingreso" IS NOT NULL AND "categoria_egreso_id" IS NULL)
      OR ("tipo" = 'EGRESO' AND "subtipo_ingreso" IS NULL AND "categoria_egreso_id" IS NOT NULL))
  ;
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_terapia_con_cita"
  CHECK ("subtipo_ingreso" IS DISTINCT FROM 'TERAPIA' OR "cita_id" IS NOT NULL);
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_venta_con_inventario"
  CHECK ("subtipo_ingreso" IS DISTINCT FROM 'VENTA_INSUMOS' OR "movimiento_inventario_id" IS NOT NULL);
ALTER TABLE "movimiento_financiero" ADD CONSTRAINT "movimiento_financiero_anulacion_completa"
  CHECK (NOT "anulado" OR ("anulado_por" IS NOT NULL AND "anulado_en" IS NOT NULL AND "motivo_anulacion" IS NOT NULL));
-- Se permiten varios cobros (abonos) por cita: sin índice único por cita_id.
