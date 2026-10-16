-- Extensiones requeridas (restricciones de exclusión con uuid y búsqueda por nombre).
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENO', 'RECEPCIONISTA', 'PROFESIONAL');

-- CreateEnum
CREATE TYPE "EstadoCita" AS ENUM ('PROGRAMADA', 'ASISTIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ZonaCorporal" AS ENUM ('CERVICAL', 'DORSAL', 'LUMBAR', 'HOMBRO', 'CODO', 'MUNECA_MANO', 'CADERA', 'RODILLA', 'TOBILLO_PIE', 'OTRA');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA');

-- CreateEnum
CREATE TYPE "TipoMovimientoFinanciero" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "SubtipoIngreso" AS ENUM ('TERAPIA', 'VENTA_INSUMOS');

-- CreateEnum
CREATE TYPE "TipoMovimientoInventario" AS ENUM ('AJUSTE_INICIAL', 'VENTA', 'REPOSICION');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cedula" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "atiende_pacientes" BOOLEAN NOT NULL DEFAULT false,
    "password_hash" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "intentos_fallidos" SMALLINT NOT NULL DEFAULT 0,
    "bloqueado_hasta" TIMESTAMPTZ(6),
    "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sesion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_actividad" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultorio" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "orden" SMALLINT NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consultorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paciente" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "documento" TEXT NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "direccion" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "barrio" TEXT NOT NULL,
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cita" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paciente_id" UUID NOT NULL,
    "profesional_id" UUID NOT NULL,
    "consultorio_id" UUID NOT NULL,
    "inicio" TIMESTAMPTZ(6) NOT NULL,
    "duracion_min" SMALLINT NOT NULL,
    "fin" TIMESTAMPTZ(6) NOT NULL,
    "motivo" TEXT NOT NULL,
    "zona_corporal" "ZonaCorporal" NOT NULL,
    "estado" "EstadoCita" NOT NULL DEFAULT 'PROGRAMADA',
    "retroactiva" BOOLEAN NOT NULL DEFAULT false,
    "observacion_cancelacion" TEXT,
    "cancelada_por" UUID,
    "cancelada_en" TIMESTAMPTZ(6),
    "creado_por" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_por" UUID,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registro_auditoria" (
    "id" BIGSERIAL NOT NULL,
    "usuario_id" UUID NOT NULL,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" TEXT NOT NULL,
    "antes" JSONB,
    "despues" JSONB,
    "motivo" TEXT,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_cedula_key" ON "usuario"("cedula");

-- CreateIndex
CREATE UNIQUE INDEX "sesion_token_hash_key" ON "sesion"("token_hash");

-- CreateIndex
CREATE INDEX "sesion_usuario_id_idx" ON "sesion"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "consultorio_nombre_key" ON "consultorio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_documento_key" ON "paciente"("documento");

-- CreateIndex
CREATE INDEX "paciente_nombre_trgm_idx" ON "paciente" USING GIN ("nombre_completo" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "cita_consultorio_id_inicio_idx" ON "cita"("consultorio_id", "inicio");

-- CreateIndex
CREATE INDEX "cita_profesional_id_inicio_idx" ON "cita"("profesional_id", "inicio");

-- CreateIndex
CREATE INDEX "cita_paciente_id_inicio_idx" ON "cita"("paciente_id", "inicio");

-- CreateIndex
CREATE INDEX "cita_estado_inicio_idx" ON "cita"("estado", "inicio");

-- CreateIndex
CREATE INDEX "registro_auditoria_entidad_entidad_id_idx" ON "registro_auditoria"("entidad", "entidad_id");

-- CreateIndex
CREATE INDEX "registro_auditoria_creado_en_idx" ON "registro_auditoria"("creado_en");

-- AddForeignKey
ALTER TABLE "sesion" ADD CONSTRAINT "sesion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_profesional_id_fkey" FOREIGN KEY ("profesional_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_consultorio_id_fkey" FOREIGN KEY ("consultorio_id") REFERENCES "consultorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_actualizado_por_fkey" FOREIGN KEY ("actualizado_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cita" ADD CONSTRAINT "cita_cancelada_por_fkey" FOREIGN KEY ("cancelada_por") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── SQL manual (no expresable en schema.prisma) ───────────────────────────

-- La recepcionista nunca es asignable a citas.
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_recepcionista_no_atiende"
  CHECK ("rol" <> 'RECEPCIONISTA' OR NOT "atiende_pacientes");

-- Cero citas superpuestas por consultorio, profesional y paciente (FR-015, FR-017, SC-001).
ALTER TABLE "cita" ADD CONSTRAINT "cita_sin_choque_consultorio"
  EXCLUDE USING gist ("consultorio_id" WITH =, tstzrange("inicio", "fin", '[)') WITH &&)
  WHERE ("estado" <> 'CANCELADA');
ALTER TABLE "cita" ADD CONSTRAINT "cita_sin_choque_profesional"
  EXCLUDE USING gist ("profesional_id" WITH =, tstzrange("inicio", "fin", '[)') WITH &&)
  WHERE ("estado" <> 'CANCELADA');
ALTER TABLE "cita" ADD CONSTRAINT "cita_sin_choque_paciente"
  EXCLUDE USING gist ("paciente_id" WITH =, tstzrange("inicio", "fin", '[)') WITH &&)
  WHERE ("estado" <> 'CANCELADA');

-- Duración en múltiplos de 30 min y fin coherente.
ALTER TABLE "cita" ADD CONSTRAINT "cita_duracion_valida"
  CHECK ("duracion_min" % 30 = 0 AND "duracion_min" BETWEEN 30 AND 570
         AND "fin" = "inicio" + make_interval(mins => "duracion_min"));

-- Horario 07:30–17:00 hora Bogotá, mismo día, inicio en :00 o :30 (FR-008, FR-016).
ALTER TABLE "cita" ADD CONSTRAINT "cita_en_horario"
  CHECK (("inicio" AT TIME ZONE 'America/Bogota')::time >= '07:30'
     AND ("fin" AT TIME ZONE 'America/Bogota')::time <= '17:00'
     AND ("fin" AT TIME ZONE 'America/Bogota')::time > '00:00'
     AND ("inicio" AT TIME ZONE 'America/Bogota')::date = ("fin" AT TIME ZONE 'America/Bogota')::date
     AND extract(minute FROM "inicio" AT TIME ZONE 'America/Bogota') IN (0, 30)
     AND date_trunc('minute', "inicio") = "inicio");

-- Una cita cancelada siempre tiene motivo, autor y fecha (FR-020).
ALTER TABLE "cita" ADD CONSTRAINT "cita_cancelacion_completa"
  CHECK ("estado" <> 'CANCELADA' OR ("observacion_cancelacion" IS NOT NULL
         AND "cancelada_por" IS NOT NULL AND "cancelada_en" IS NOT NULL));

-- Auditoría de solo inserción (FR-043, SC-006).
CREATE FUNCTION registro_auditoria_solo_insercion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'registro_auditoria es de solo inserción';
END;
$$;
CREATE TRIGGER registro_auditoria_inmutable
  BEFORE UPDATE OR DELETE ON "registro_auditoria"
  FOR EACH ROW EXECUTE FUNCTION registro_auditoria_solo_insercion();
