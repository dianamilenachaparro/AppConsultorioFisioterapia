/**
 * Datos de carga (≈ 1 año) para medir SC-003 (grilla < 2 s) y SC-009 (historial con 100
 * atenciones < 3 s). Usa consultorios, profesionales y pacientes propios ("Carga …") para
 * no chocar con los datos demo. Idempotente. NUNCA ejecutar contra producción.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { BLOQUES, hoyBogota, instanteBogota, sumarDias } from "../src/lib/tiempo";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL!;
if (url.includes("neon.tech") && !process.argv.includes("--forzar")) {
  console.error("La base parece ser Neon (posible producción). Usa --forzar solo si es una rama de pruebas.");
  process.exit(1);
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url, options: "-c timezone=UTC" }) });

const DIAS = 365;
const PACIENTES = 1500;
const ZONAS = ["LUMBAR", "CERVICAL", "RODILLA", "HOMBRO"] as const;

// Generador determinista: los mismos datos en cada corrida.
let semilla = 20261015;
const azar = () => (semilla = (semilla * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
const entre = (min: number, max: number) => min + Math.floor(azar() * (max - min + 1));
const minutos = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);

async function enLotes<T>(filas: T[], tam: number, insertar: (lote: T[]) => Promise<unknown>) {
  for (let i = 0; i < filas.length; i += tam) await insertar(filas.slice(i, i + tam));
}

async function main() {
  if (await prisma.consultorio.findUnique({ where: { nombre: "Carga 1" } })) {
    console.log("Los datos de carga ya existen; no se crean de nuevo.");
    return;
  }
  const recepcion = await prisma.usuario.findFirst({ where: { rol: { in: ["RECEPCIONISTA", "DUENO"] } } });
  if (!recepcion) throw new Error("Ejecuta antes pnpm db:seed o pnpm db:seed:demo");

  const passwordHash = await hash("carga12345", { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  // Todo o nada: si algo falla no quedan datos a medias que bloqueen la siguiente corrida.
  await prisma.$transaction(async (tx) => cargar(tx, recepcion.id, passwordHash), { timeout: 300_000, maxWait: 10_000 });
  await prisma.$executeRawUnsafe("ANALYZE");
}

async function cargar(tx: Prisma.TransactionClient, recepcionId: string, passwordHash: string) {
  const consultorios = await Promise.all(
    [1, 2, 3].map((n) => tx.consultorio.create({ data: { nombre: `Carga ${n}`, orden: 100 + n } })),
  );
  const profesionales = await Promise.all(
    [1, 2, 3].map((n) =>
      tx.usuario.create({
        data: {
          cedula: `900000000${n}`,
          nombreCompleto: `Profesional Carga ${n}`,
          rol: "PROFESIONAL",
          atiendePacientes: true,
          passwordHash,
          debeCambiarPassword: false,
        },
      }),
    ),
  );

  const pacientes = Array.from({ length: PACIENTES }, (_, i) => ({
    id: randomUUID(),
    documento: `CARGA${String(i).padStart(6, "0")}`,
    nombreCompleto: i === 0 ? "Paciente Carga Cien Atenciones" : `Paciente Carga ${i}`,
    telefono: "3000000000",
    fechaNacimiento: new Date("1980-01-01T00:00:00Z"),
    direccion: "Calle 1",
    departamento: "Antioquia",
    ciudad: "Medellín",
    barrio: "Centro",
    creadoPorId: recepcionId,
  }));
  await enLotes(pacientes, 1000, (lote) => tx.paciente.createMany({ data: lote }));

  const citas: Prisma.CitaCreateManyInput[] = [];
  const marcaciones: Prisma.MarcacionCreateManyInput[] = [];
  const atenciones: Prisma.AtencionCreateManyInput[] = [];
  const hoy = hoyBogota();
  let atencionesEspecial = 0;

  for (let d = 1; d <= DIAS; d++) {
    const fecha = sumarDias(hoy, -d);
    // El paciente especial tiene una cita a las 07:30 en Carga 1 cada 3 días, hasta 100.
    const diaEspecial = d % 3 === 1 && atencionesEspecial < 100;
    for (let c = 0; c < 3; c++) {
      // 17 de 19 bloques ocupados por consultorio y día; el bloque 0 nunca se salta.
      const saltar = new Set([((d + c) % 18) + 1, ((d + c + 7) % 18) + 1]);
      BLOQUES.forEach((hora, b) => {
        if (saltar.has(b)) return;
        const especial = diaEspecial && c === 0 && b === 0;
        // Citas simultáneas (mismo d y b) caen en pacientes distintos: sus índices difieren en 19.
        const paciente = especial ? pacientes[0] : pacientes[1 + ((d * 57 + c * 19 + b) % (PACIENTES - 1))];
        const inicio = instanteBogota(fecha, hora);
        const r = azar();
        const estado = especial || r < 0.8 ? "ASISTIDA" : r < 0.92 ? "CANCELADA" : "PROGRAMADA";
        const zona = especial ? ZONAS[atencionesEspecial % ZONAS.length] : ZONAS[entre(0, 3)];
        const id = randomUUID();
        citas.push({
          id,
          pacienteId: paciente.id,
          profesionalId: profesionales[c].id,
          consultorioId: consultorios[c].id,
          inicio,
          duracionMin: 30,
          fin: minutos(inicio, 30),
          motivo: "Control",
          zonaCorporal: zona,
          estado,
          creadoPorId: recepcionId,
          ...(estado === "CANCELADA"
            ? { observacionCancelacion: "Cancelada (datos de carga)", canceladaPorId: recepcionId, canceladaEn: minutos(inicio, -120) }
            : {}),
        });
        if (estado === "ASISTIDA") {
          const ingreso = minutos(inicio, entre(-3, 15));
          marcaciones.push({
            citaId: id,
            // La llegada siempre antes del ingreso (CHECK marcacion_orden).
            llegadaEn: minutos(ingreso, -entre(2, 20)),
            ingresoEn: ingreso,
            finEn: minutos(ingreso, entre(25, 35)),
          });
        }
        if (especial) {
          atencionesEspecial++;
          atenciones.push({
            citaId: id,
            pacienteId: paciente.id,
            profesionalId: profesionales[c].id,
            fecha: inicio,
            zonaCorporal: zona,
            motivo: "Control",
            tecnica: "Terapia manual",
            dolor: Math.max(0, Math.min(10, 8 - Math.floor(atencionesEspecial / 15) + entre(-1, 1))),
            notasEvolucion: "Evolución favorable (datos de carga).",
            creadoPorId: profesionales[c].id,
            creadoEn: minutos(inicio, 60),
          });
        }
      });
    }
  }

  await enLotes(citas, 2000, (lote) => tx.cita.createMany({ data: lote }));
  await enLotes(marcaciones, 2000, (lote) => tx.marcacion.createMany({ data: lote }));
  await enLotes(atenciones, 500, (lote) => tx.atencion.createMany({ data: lote }));
  console.log(
    `Datos de carga listos: ${citas.length} citas, ${marcaciones.length} marcaciones, ${atenciones.length} atenciones del paciente ${pacientes[0].id}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
