-- CreateTable
CREATE TABLE "conexion_google" (
    "usuario_id" UUID NOT NULL,
    "email_google" TEXT NOT NULL,
    "refresh_token_cifrado" TEXT NOT NULL,
    "conectado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conexion_google_pkey" PRIMARY KEY ("usuario_id")
);

-- AddForeignKey
ALTER TABLE "conexion_google" ADD CONSTRAINT "conexion_google_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
