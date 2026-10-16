import { expect, test } from "@playwright/test";
import {
  crearDatosE2E,
  desborde,
  buscarPaciente,
  iniciarSesion,
  retirarDatosE2E,
  USUARIOS_DEMO,
  type DatosE2E,
} from "./utilidades";

// SC-010 y SC-004: solo en los proyectos de celular (Pixel 7, iPhone 14), además a 360 px.
// Recorre varias pantallas en dos anchos; en desarrollo cada página se compila la primera vez.
test.describe.configure({ mode: "serial", timeout: 120_000 });

let datos: DatosE2E;
test.beforeAll(({}, info) => {
  test.skip(info.project.name === "escritorio", "Prueba de celular");
  datos = crearDatosE2E();
});
test.afterAll(() => {
  if (datos) retirarDatosE2E(datos);
});

const ANCHOS = [undefined, 360] as const;

test("sin desplazamiento horizontal en login, agenda y crear cita", async ({ page }) => {
  for (const ancho of ANCHOS) {
    if (ancho) await page.setViewportSize({ width: ancho, height: 780 });
    await page.goto("/login");
    expect(await desborde(page), `login a ${ancho ?? "ancho del dispositivo"}`).toBeLessThanOrEqual(0);
  }
  await iniciarSesion(page, USUARIOS_DEMO.recepcionista);
  for (const ancho of ANCHOS) {
    if (ancho) await page.setViewportSize({ width: ancho, height: 780 });
    await page.goto(`/agenda?consultorio=${datos.consultorio.id}`);
    await page.getByText("Disponible").first().waitFor();
    expect(await desborde(page), "agenda").toBeLessThanOrEqual(0);
    await page.goto(`/agenda/nueva?consultorio=${datos.consultorio.id}`);
    await buscarPaciente(page, datos.paciente.documento);
    await page.getByRole("button", { name: "Confirmar cita" }).waitFor();
    expect(await desborde(page), "crear cita").toBeLessThanOrEqual(0);
  }
});

test("mi día: Llegada → Ingreso → Fin con un toque cada uno, en menos de 5 s", async ({ page }) => {
  await iniciarSesion(page, datos.profesional.cedula);
  await page.goto("/mi-dia");
  const tarjeta = page.getByRole("listitem").filter({ hasText: datos.paciente.nombre });
  expect(await desborde(page), "mi día").toBeLessThanOrEqual(0);

  for (const [boton, siguiente] of [
    ["Llegada", "Ingreso a terapia"],
    ["Ingreso a terapia", "Fin de terapia"],
    ["Fin de terapia", null],
  ] as const) {
    const t0 = Date.now();
    // La vista cambia al instante (optimista); se mide hasta que el servidor confirma la marca.
    const confirmada = page.waitForResponse((r) => r.request().method() === "POST" && r.url().includes("/mi-dia"));
    await tarjeta.getByRole("button", { name: boton }).click();
    expect((await confirmada).ok(), `${boton} guardada`).toBe(true);
    if (siguiente) await expect(tarjeta.getByRole("button", { name: siguiente })).toBeEnabled();
    else await tarjeta.getByText("Terapia terminada").waitFor();
    expect(Date.now() - t0, `${boton} < 5 s`).toBeLessThan(5_000);
  }
  // Las marcas quedaron guardadas en el servidor, no solo en la vista optimista.
  await page.reload();
  await expect(tarjeta.getByText("Terapia terminada")).toBeVisible();
});

test("sin desplazamiento horizontal en atención y cobro", async ({ page }) => {
  await iniciarSesion(page, datos.profesional.cedula);
  for (const ancho of ANCHOS) {
    if (ancho) await page.setViewportSize({ width: ancho, height: 780 });
    await page.goto(`/citas/${datos.citaHoy}/atencion`);
    await page.getByRole("radio", { name: "10" }).waitFor();
    expect(await desborde(page), "atención").toBeLessThanOrEqual(0);
    await page.goto(`/citas/${datos.citaHoy}/cobro`);
    await page.getByLabel("Valor (COP)").waitFor();
    expect(await desborde(page), "cobro").toBeLessThanOrEqual(0);
  }
});
