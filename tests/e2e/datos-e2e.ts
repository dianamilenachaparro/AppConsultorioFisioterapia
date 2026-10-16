/**
 * Datos propios de cada corrida E2E en la base de desarrollo (se ejecuta con tsx).
 *   tsx tests/e2e/datos-e2e.ts crear      → imprime JSON con los ids
 *   tsx tests/e2e/datos-e2e.ts retirar <consultorioId> <profesionalId>...
 * Crea un consultorio y dos profesionales nuevos ("E2E …") para que los horarios de hoy estén
 * libres en cada corrida; al terminar se desactivan para no aparecer en la agenda.
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { hoyBogota, instanteBogota } from "../../src/lib/tiempo";

const url = process.env.DATABASE_URL!;
if (url.includes("neon.tech")) throw new Error("Las pruebas E2E nunca se ejecutan contra Neon");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: "-c timezone=UTC" }) });

async function crear() {
  const marca = Date.now().toString(36).toUpperCase();
  const recepcion = await prisma.usuario.findUniqueOrThrow({ where: { cedula: "1000000001" } });
  const consultorio = await prisma.consultorio.create({ data: { nombre: `E2E ${marca}`, orden: 900 } });
  const passwordHash = await hash("demo12345", { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const nuevoProfesional = (n: number) =>
    prisma.usuario.create({
      data: {
        cedula: `8${n}${String(Date.now()).slice(-8)}`,
        nombreCompleto: `Profesional E2E ${n} ${marca}`,
        rol: "PROFESIONAL",
        atiendePacientes: true,
        debeCambiarPassword: false,
        passwordHash,
      },
    });
  const profesional = await nuevoProfesional(1);
  const profesional2 = await nuevoProfesional(2);
  const paciente = await prisma.paciente.create({
    data: {
      documento: `E2E${marca}`,
      nombreCompleto: `Paciente E2E ${marca}`,
      telefono: "3000000000",
      fechaNacimiento: new Date("1990-01-01T00:00:00Z"),
      direccion: "Calle 1",
      departamento: "Antioquia",
      ciudad: "Medellín",
      barrio: "Centro",
      creadoPorId: recepcion.id,
    },
  });
  // Cita de hoy a las 07:30 para marcar tiempos, registrar atención y cobrar.
  const inicio = instanteBogota(hoyBogota(), "07:30");
  const cita = await prisma.cita.create({
    data: {
      pacienteId: paciente.id,
      profesionalId: profesional.id,
      consultorioId: consultorio.id,
      inicio,
      duracionMin: 30,
      fin: new Date(inicio.getTime() + 30 * 60_000),
      motivo: "Dolor lumbar",
      zonaCorporal: "LUMBAR",
      creadoPorId: recepcion.id,
    },
  });
  return {
    marca,
    consultorio: { id: consultorio.id, nombre: consultorio.nombre },
    profesional: { id: profesional.id, cedula: profesional.cedula, nombre: profesional.nombreCompleto },
    profesional2: { id: profesional2.id, cedula: profesional2.cedula, nombre: profesional2.nombreCompleto },
    paciente: { id: paciente.id, documento: paciente.documento, nombre: paciente.nombreCompleto },
    citaHoy: cita.id,
  };
}

async function retirar(consultorioId: string, profesionales: string[]) {
  await prisma.consultorio.update({ where: { id: consultorioId }, data: { activo: false } });
  await prisma.usuario.updateMany({ where: { id: { in: profesionales } }, data: { activo: false } });
  await prisma.sesion.deleteMany({ where: { usuarioId: { in: profesionales } } });
}

const [orden, ...args] = process.argv.slice(2);
(orden === "crear" ? crear().then((d) => console.log(JSON.stringify(d))) : retirar(args[0], args.slice(1)))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
