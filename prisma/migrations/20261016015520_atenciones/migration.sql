-- CreateTable
CREATE TABLE "atencion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cita_id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "profesional_id" UUID NOT NULL,
    "fecha" TIMESTAMPTZ(6) NOT NULL,
    "zona_corporal" "ZonaCorporal" NOT NULL,
    "motivo" TEXT NOT NULL,
    "tecnica" TEXT NOT NULL,
    "dolor" SMALLINT NOT NULL,
    "notas_evolucion" TEXT NOT NULL,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_por" UUID,
    "actualizado_en" TIMESTAMPTZ(6),

    CONSTRAINT "atencion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nota_aclaratoria" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "atencion_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nota_aclaratoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "atencion_cita_id_key" ON "atencion"("cita_id");

-- CreateIndex
CREATE INDEX "atencion_paciente_id_fecha_idx" ON "atencion"("paciente_id", "fecha");

-- CreateIndex
CREATE INDEX "nota_aclaratoria_atencion_id_idx" ON "nota_aclaratoria"("atencion_id");

-- AddForeignKey
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_aclaratoria" ADD CONSTRAINT "nota_aclaratoria_atencion_id_fkey" FOREIGN KEY ("atencion_id") REFERENCES "atencion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nota_aclaratoria" ADD CONSTRAINT "nota_aclaratoria_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── SQL manual (data-model.md → Atencion / NotaAclaratoria) ────────────────

-- Escala de dolor 0–10 (FR-024).
ALTER TABLE "atencion" ADD CONSTRAINT "atencion_dolor_rango" CHECK ("dolor" BETWEEN 0 AND 10);

-- Ventana de edición: solo el mismo día de creación, hora Bogotá (FR-025a).
-- El texto "fuera_de_ventana" lo traduce la app a FUERA_DE_VENTANA.
CREATE FUNCTION atencion_ventana_edicion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (now() AT TIME ZONE 'America/Bogota')::date <> (OLD."creado_en" AT TIME ZONE 'America/Bogota')::date THEN
    RAISE EXCEPTION 'fuera_de_ventana: la atención solo se puede editar el día de su registro';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER atencion_editable_mismo_dia
  BEFORE UPDATE ON "atencion"
  FOR EACH ROW EXECUTE FUNCTION atencion_ventana_edicion();

CREATE FUNCTION atencion_no_borrable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'una atención no se puede borrar';
END;
$$;
CREATE TRIGGER atencion_sin_borrado
  BEFORE DELETE ON "atencion"
  FOR EACH ROW EXECUTE FUNCTION atencion_no_borrable();

-- Notas aclaratorias de solo inserción (FR-025b).
CREATE FUNCTION nota_aclaratoria_solo_insercion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'nota_aclaratoria es de solo inserción';
END;
$$;
CREATE TRIGGER nota_aclaratoria_inmutable
  BEFORE UPDATE OR DELETE ON "nota_aclaratoria"
  FOR EACH ROW EXECUTE FUNCTION nota_aclaratoria_solo_insercion();
