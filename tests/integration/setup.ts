import "dotenv/config";
import { afterAll, beforeAll } from "vitest";

// La aplicación lee DATABASE_URL al importar src/server/db.ts: apuntarla a la base de pruebas
// antes de que cualquier archivo de prueba la importe.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

beforeAll(async () => {
  const { limpiarBaseDeDatos } = await import("./helpers");
  await limpiarBaseDeDatos();
});

afterAll(async () => {
  const { prisma } = await import("@/server/db");
  await prisma.$disconnect();
});
