import { beforeEach, describe, expect, it } from "vitest";
import { asegurarCategoriasEgreso } from "@/lib/categorias-egreso";
import { hoyBogota } from "@/lib/tiempo";
import { prisma } from "@/server/db";
import { registrarCobroTerapia } from "@/server/finanzas/cobros";
import { consultarFinanzas } from "@/server/finanzas/consulta";
import { registrarEgreso } from "@/server/finanzas/egresos";
import { cifrar } from "@/server/google/cifrado";
import { ENCABEZADOS, exportarFinanzasAGoogle, textoSeguro } from "@/server/google/exportar";
import type { ClienteSheets, Rango } from "@/server/google/sheets";
import { crearCitaPrueba, escenarioBase, limpiarBaseDeDatos, sesionDe } from "./helpers";

let e: Awaited<ReturnType<typeof escenarioBase>>;

beforeEach(async () => {
  await limpiarBaseDeDatos();
  await asegurarCategoriasEgreso(prisma);
  e = await escenarioBase();
});

const D = () => sesionDe(e.dueno);
const HOY = () => hoyBogota();
const filtro = () => ({ desde: HOY(), hasta: HOY() });

/** Cliente de Sheets falso que registra lo enviado; `fallas` define errores por llamada. */
function falso(fallas: { crear?: unknown[]; escribir?: unknown[] } = {}) {
  const registro = { titulos: [] as string[], escrito: [] as Rango[], tokens: [] as string[] };
  const fabrica = (token: string): ClienteSheets => {
    registro.tokens.push(token);
    return {
      async crearHoja(titulo) {
        const f = fallas.crear?.shift();
        if (f) throw f;
        registro.titulos.push(titulo);
        return { id: "hoja-1", url: "https://docs.google.com/spreadsheets/d/hoja-1" };
      },
      async escribirValores(_id, rangos) {
        const f = fallas.escribir?.shift();
        if (f) throw f;
        registro.escrito.push(...rangos);
      },
    };
  };
  return { fabrica, registro };
}

async function conectar() {
  await prisma.conexionGoogle.create({
    data: { usuarioId: e.dueno.id, emailGoogle: "dueno@example.com", refreshTokenCifrado: cifrar("token-secreto") },
  });
}

async function datos() {
  const c = await crearCitaPrueba({
    pacienteId: e.paciente.id,
    profesionalId: e.profesional.id,
    consultorioId: e.consultorio.id,
    creadoPorId: e.recepcionista.id,
    fecha: HOY(),
    estado: "ASISTIDA",
  });
  await registrarCobroTerapia(sesionDe(e.recepcionista), { citaId: c.id, valor: 80_000, medioPago: "EFECTIVO" });
  await registrarCobroTerapia(sesionDe(e.recepcionista), { citaId: c.id, valor: 40_000, medioPago: "TRANSFERENCIA" });
  const otros = await prisma.categoriaEgreso.findUniqueOrThrow({ where: { clave: "OTROS" } });
  await registrarEgreso(D(), {
    categoriaId: otros.id,
    fecha: HOY(),
    valor: 25_000,
    medioPago: "EFECTIVO",
    descripcion: "=HYPERLINK(\"http://malo\")",
  });
}

const tablas = async () => ({
  financieros: await prisma.movimientoFinanciero.count(),
  conexion: await prisma.conexionGoogle.count(),
});

describe("exportación a Google Sheets (FR-040, SC-008)", () => {
  it("escribe filtros, encabezados, las mismas filas y los mismos totales que la pantalla", async () => {
    await conectar();
    await datos();
    const { fabrica, registro } = falso();
    const r = await exportarFinanzasAGoogle(D(), filtro(), fabrica);
    expect(r.urlHoja).toContain("hoja-1");
    expect(registro.tokens).toEqual(["token-secreto"]);
    expect(registro.titulos[0]).toMatch(new RegExp(`^Finanzas Consultorio ${HOY()} a ${HOY()} – exportado \\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}$`));

    const v = registro.escrito[0].valores;
    const pantalla = await consultarFinanzas(D(), filtro());
    const n = 3 + pantalla.filas.length;
    expect(String(v[0][0])).toMatch(/^Filtros: /);
    expect(v[2]).toEqual([...ENCABEZADOS]);
    expect(v.slice(3, n).map((f) => f[8])).toEqual(pantalla.filas.map((f) => f.id));
    expect(v.slice(3, n).map((f) => f[5])).toEqual(pantalla.filas.map((f) => (f.tipo === "EGRESO" ? -f.valor : f.valor)));
    expect(v[n + 1]).toEqual(["Total ingresos", pantalla.totales.ingresos]);
    expect(v[n + 2]).toEqual(["Total egresos", pantalla.totales.egresos]);
    expect(v[n + 3]).toEqual(["Balance", pantalla.totales.balance]);
    expect(pantalla.totales).toEqual({ ingresos: 120_000, egresos: 25_000, balance: 95_000 });
    expect(registro.escrito[0].rango).toBe(`A1:I${v.length}`);
    expect(await prisma.registroAuditoria.count({ where: { accion: "FINANZAS_EXPORTAR" } })).toBe(1);
  });

  it("los textos que parecen fórmulas se escriben como texto literal", async () => {
    await conectar();
    await datos();
    const { fabrica, registro } = falso();
    await exportarFinanzasAGoogle(D(), filtro(), fabrica);
    const descripciones = registro.escrito[0].valores.map((f) => f[3]);
    expect(descripciones).toContain("'=HYPERLINK(\"http://malo\")");
    expect(textoSeguro("-5")).toBe("'-5");
    expect(textoSeguro("Venta")).toBe("Venta");
  });

  it("sin resultados escribe solo encabezados y totales en 0", async () => {
    await conectar();
    const { fabrica, registro } = falso();
    await exportarFinanzasAGoogle(D(), filtro(), fabrica);
    const v = registro.escrito[0].valores;
    expect(v[2]).toEqual([...ENCABEZADOS]);
    expect(v.slice(4)).toEqual([["Total ingresos", 0], ["Total egresos", 0], ["Balance", 0]]);
  });

  it("sin conexión pide conectar Google", async () => {
    const { fabrica } = falso();
    await expect(exportarFinanzasAGoogle(D(), filtro(), fabrica)).rejects.toMatchObject({
      codigo: "ERROR_GOOGLE",
      message: "Conecta tu cuenta de Google para exportar",
    });
  });

  it("invalid_grant borra la conexión y pide reconectar", async () => {
    await conectar();
    const { fabrica } = falso({ crear: [{ message: "invalid_grant", response: { data: { error: "invalid_grant" } } }] });
    await expect(exportarFinanzasAGoogle(D(), filtro(), fabrica)).rejects.toMatchObject({
      codigo: "ERROR_GOOGLE",
      message: expect.stringContaining("vuelve a conectarla"),
    });
    expect(await prisma.conexionGoogle.count()).toBe(0);
  });

  it("reintenta una vez ante un 5xx y, si vuelve a fallar, no cambia ningún dato", async () => {
    await conectar();
    await datos();
    const antes = await tablas();
    const ok = falso({ escribir: [{ response: { status: 503 } }] });
    await exportarFinanzasAGoogle(D(), filtro(), ok.fabrica, { esperaReintentoMs: 1 });
    expect(ok.registro.escrito).toHaveLength(1);

    const mal = falso({ crear: [{ response: { status: 500 } }, { response: { status: 502 } }] });
    await expect(exportarFinanzasAGoogle(D(), filtro(), mal.fabrica, { esperaReintentoMs: 1 })).rejects.toMatchObject({
      codigo: "ERROR_GOOGLE",
    });
    expect(await tablas()).toEqual(antes);
  });
});
