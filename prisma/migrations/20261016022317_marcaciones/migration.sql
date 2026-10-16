-- CreateTable
CREATE TABLE "marcacion" (
    "cita_id" UUID NOT NULL,
    "llegada_en" TIMESTAMPTZ(6),
    "llegada_por" UUID,
    "ingreso_en" TIMESTAMPTZ(6),
    "ingreso_por" UUID,
    "fin_en" TIMESTAMPTZ(6),
    "fin_por" UUID,

    CONSTRAINT "marcacion_pkey" PRIMARY KEY ("cita_id")
);

-- AddForeignKey
ALTER TABLE "marcacion" ADD CONSTRAINT "marcacion_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcacion" ADD CONSTRAINT "marcacion_llegada_por_fkey" FOREIGN KEY ("llegada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcacion" ADD CONSTRAINT "marcacion_ingreso_por_fkey" FOREIGN KEY ("ingreso_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marcacion" ADD CONSTRAINT "marcacion_fin_por_fkey" FOREIGN KEY ("fin_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── SQL manual (data-model.md → Marcacion) ─────────────────────────────────

-- Orden llegada → ingreso → fin, sin saltos ni retrocesos (FR-029, FR-030).
ALTER TABLE "marcacion" ADD CONSTRAINT "marcacion_orden"
  CHECK (("ingreso_en" IS NULL OR "llegada_en" IS NOT NULL)
     AND ("fin_en" IS NULL OR "ingreso_en" IS NOT NULL)
     AND ("ingreso_en" IS NULL OR "ingreso_en" >= "llegada_en")
     AND ("fin_en" IS NULL OR "fin_en" >= "ingreso_en"));
