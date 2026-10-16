import { execSync } from "node:child_process";
import "dotenv/config";

/** Recrea la base de pruebas desde las migraciones una vez por corrida. */
export default function setup() {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error("Define DATABASE_URL_TEST en .env para las pruebas de integración");
  if (url === process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_TEST no puede ser la misma base que DATABASE_URL");
  }
  execSync("pnpm prisma migrate reset --force", {
    stdio: "inherit",
    env: { ...process.env, DIRECT_URL: url, DATABASE_URL: url },
  });
}
