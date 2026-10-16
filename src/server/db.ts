import "server-only";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

function crearCliente(url: string) {
  // Neon en producción (WebSocket, admite transacciones); pg nativo en local y pruebas.
  // La sesión pg va fija en UTC: el adaptador envía las fechas sin zona y, si el servidor
  // usa otra zona (p. ej. PostgreSQL instalado en un PC en Bogotá), quedarían corridas.
  const adapter = url.includes("neon.tech")
    ? new PrismaNeon({ connectionString: url })
    : new PrismaPg({ connectionString: url, options: "-c timezone=UTC" });
  return new PrismaClient({ adapter });
}

export type Db = ReturnType<typeof crearCliente>;
/** Cliente dentro de `prisma.$transaction(async (tx) => …)`. */
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];

const globalParaPrisma = globalThis as unknown as { prisma?: Db };

function urlBaseDatos() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL");
  return url;
}

export const prisma: Db = globalParaPrisma.prisma ?? crearCliente(urlBaseDatos());

if (process.env.NODE_ENV !== "production") globalParaPrisma.prisma = prisma;
