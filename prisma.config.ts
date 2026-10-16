import "dotenv/config";
import { defineConfig } from "prisma/config";

// La CLI (migraciones) usa la conexión directa; la aplicación usa DATABASE_URL
// a través del driver adapter (src/server/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
