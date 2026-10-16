/**
 * Semilla base (idempotente): consultorios iniciales, categorías de egreso y Dueño inicial.
 * La contraseña del Dueño se pide por consola; nunca hay contraseñas por defecto en el código.
 */
import "dotenv/config";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { asegurarCategoriasEgreso } from "../src/lib/categorias-egreso";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!, options: "-c timezone=UTC" }),
});

async function consultorios() {
  for (const [i, nombre] of ["Consultorio 1", "Consultorio 2", "Consultorio 3"].entries()) {
    await prisma.consultorio.upsert({
      where: { nombre },
      update: {},
      create: { nombre, orden: i + 1 },
    });
  }
}

async function duenoInicial() {
  const existe = await prisma.usuario.findFirst({ where: { rol: "DUENO", activo: true } });
  if (existe) {
    console.log("Ya existe un Dueño activo; no se crea otro.");
    return;
  }
  const rl = createInterface({ input, output });
  try {
    const cedula = (await rl.question("Cédula del Dueño (5–15 dígitos): ")).trim();
    if (!/^\d{5,15}$/.test(cedula)) throw new Error("Cédula inválida");
    const nombre = (await rl.question("Nombre completo: ")).trim();
    if (nombre.length < 3) throw new Error("Nombre inválido");
    const password = await rl.question("Contraseña (mín. 8 caracteres): ");
    if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres");
    await prisma.usuario.create({
      data: {
        cedula,
        nombreCompleto: nombre,
        rol: "DUENO",
        atiendePacientes: false,
        debeCambiarPassword: false,
        passwordHash: await hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 }),
      },
    });
    console.log("Dueño inicial creado.");
  } finally {
    rl.close();
  }
}

async function main() {
  await consultorios();
  await asegurarCategoriasEgreso(prisma);
  await duenoInicial();
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
