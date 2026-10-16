/**
 * Datos ficticios para desarrollo y pruebas E2E. NUNCA ejecutar contra producción.
 * Contraseña de todos los usuarios demo: demo12345
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hoyBogota, instanteBogota, sumarDias } from "../src/lib/tiempo";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
if (url.includes("neon.tech") && !process.argv.includes("--forzar")) {
  console.error("La base parece ser Neon (posible producción). Usa --forzar solo si es una rama de pruebas.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: "-c timezone=UTC" }) });

const USUARIOS = [
  { cedula: "1000000001", nombreCompleto: "Laura Recepción", rol: "RECEPCIONISTA" as const, atiendePacientes: false },
  { cedula: "1000000002", nombreCompleto: "Carlos Pérez (Fisioterapeuta)", rol: "PROFESIONAL" as const, atiendePacientes: true },
  { cedula: "1000000003", nombreCompleto: "Diana Ruiz (Quiropráctica)", rol: "PROFESIONAL" as const, atiendePacientes: true },
  { cedula: "1000000009", nombreCompleto: "Dueño Demo", rol: "DUENO" as const, atiendePacientes: true },
];

const PACIENTES = [
  ["1010101010", "Andrés Felipe Gómez", "Medellín", "Laureles", "Antioquia"],
  ["1020202020", "María José Restrepo", "Medellín", "El Poblado", "Antioquia"],
  ["1030303030", "Juan Camilo Ríos", "Envigado", "Zúñiga", "Antioquia"],
  ["1040404040", "Luisa Fernanda Ospina", "Bogotá", "Chapinero", "Bogotá D.C."],
  ["1050505050", "Santiago Henao", "Itagüí", "Santa María", "Antioquia"],
  ["1060606060", "Valentina Cárdenas", "Bello", "Niquía", "Antioquia"],
  ["1070707070", "Jorge Iván Zapata", "Medellín", "Belén", "Antioquia"],
  ["1080808080", "Paula Andrea Mejía", "Sabaneta", "Centro", "Antioquia"],
  ["1090909090", "Diego Alejandro Vélez", "Cali", "San Fernando", "Valle del Cauca"],
  ["1101010101", "Natalia Arango", "Medellín", "Robledo", "Antioquia"],
] as const;

async function main() {
  const passwordHash = await hash("demo12345", { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const usuarios: Record<string, string> = {};
  for (const u of USUARIOS) {
    const r = await prisma.usuario.upsert({
      where: { cedula: u.cedula },
      update: {},
      create: { ...u, passwordHash, debeCambiarPassword: false },
    });
    usuarios[u.cedula] = r.id;
  }
  const recepcionista = usuarios["1000000001"];

  for (const [i, nombre] of ["Consultorio 1", "Consultorio 2", "Consultorio 3"].entries()) {
    await prisma.consultorio.upsert({ where: { nombre }, update: {}, create: { nombre, orden: i + 1 } });
  }
  const consultorios = await prisma.consultorio.findMany({ orderBy: { orden: "asc" } });

  const pacientes: string[] = [];
  for (const [documento, nombreCompleto, ciudad, barrio, departamento] of PACIENTES) {
    const p = await prisma.paciente.upsert({
      where: { documento },
      update: {},
      create: {
        documento,
        nombreCompleto,
        telefono: `300${documento.slice(-7)}`,
        fechaNacimiento: new Date("1988-06-15T00:00:00Z"),
        direccion: "Calle 10 # 43-21",
        departamento,
        ciudad,
        barrio,
        creadoPorId: recepcionista,
      },
    });
    pacientes.push(p.id);
  }

  // Citas de hoy y mañana solo si aún no hay citas (idempotente).
  if ((await prisma.cita.count()) === 0) {
    const hoy = hoyBogota();
    const manana = sumarDias(hoy, 1);
    const plan: [string, string, number, number, number, string][] = [
      // fecha, hora, consultorio, paciente, duración, profesional
      [hoy, "08:00", 0, 0, 60, "1000000002"],
      [hoy, "09:30", 0, 1, 30, "1000000002"],
      [hoy, "10:00", 1, 2, 60, "1000000003"],
      [hoy, "14:00", 2, 3, 30, "1000000003"],
      [manana, "08:30", 0, 4, 30, "1000000002"],
      [manana, "11:00", 1, 5, 90, "1000000003"],
    ];
    for (const [fecha, hora, c, p, duracionMin, prof] of plan) {
      const inicio = instanteBogota(fecha, hora);
      await prisma.cita.create({
        data: {
          pacienteId: pacientes[p],
          profesionalId: usuarios[prof],
          consultorioId: consultorios[c].id,
          inicio,
          fin: new Date(inicio.getTime() + duracionMin * 60_000),
          duracionMin,
          motivo: "Dolor de espalda baja",
          zonaCorporal: "LUMBAR",
          creadoPorId: recepcionista,
        },
      });
    }
  }
  console.log("Datos demo listos. Usuarios: 1000000001 (Recepción), 1000000002 y 1000000003 (Profesionales), 1000000009 (Dueño). Clave: demo12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
