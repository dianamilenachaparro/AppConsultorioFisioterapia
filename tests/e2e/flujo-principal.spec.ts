import { expect, test, type Page } from "@playwright/test";
import { buscarPaciente, crearDatosE2E, iniciarSesion, retirarDatosE2E, USUARIOS_DEMO, type DatosE2E } from "./utilidades";

// Flujo de punta a punta en escritorio; los tiempos son una referencia mínima de SC-002
// (el script escribe más rápido que una persona; la medición real es con la Recepcionista).
test.describe.configure({ mode: "serial" });

let datos: DatosE2E;
test.beforeAll(({}, info) => {
  test.skip(info.project.name !== "escritorio", "Flujo completo solo en escritorio");
  datos = crearDatosE2E();
});
test.afterAll(() => {
  if (datos) retirarDatosE2E(datos);
});

async function datosDeCita(page: Page, opciones: { profesional: string; hora: string }) {
  await page.getByLabel("Motivo de la terapia").fill("Dolor lumbar al levantarse");
  await page.getByLabel("Zona corporal").selectOption("LUMBAR");
  await page.getByLabel("Profesional").selectOption({ label: opciones.profesional });
  await page.getByLabel("Hora de inicio").selectOption(opciones.hora);
}

test("la Recepcionista agenda a un paciente existente (< 1 min) y a uno nuevo (< 3 min)", async ({ page }) => {
  await iniciarSesion(page, USUARIOS_DEMO.recepcionista);

  let t0 = Date.now();
  await page.goto(`/agenda/nueva?consultorio=${datos.consultorio.id}`);
  await buscarPaciente(page, datos.paciente.documento);
  await page.getByText(datos.paciente.nombre).waitFor();
  await datosDeCita(page, { profesional: datos.profesional.nombre, hora: "15:00" });
  await page.getByRole("button", { name: "Confirmar cita" }).click();
  await page.getByText(/^Cita (creada|registrada)/).waitFor();
  expect(Date.now() - t0, "paciente existente").toBeLessThan(60_000);

  t0 = Date.now();
  await page.goto(`/agenda/nueva?consultorio=${datos.consultorio.id}`);
  await buscarPaciente(page, `N${datos.marca}`);
  await page.getByLabel("Nombre completo").fill(`Paciente Nuevo E2E ${datos.marca}`);
  await page.getByLabel("Teléfono").fill("3105551234");
  await page.getByLabel("Fecha de nacimiento").fill("1992-07-15");
  await page.getByLabel("Dirección").fill("Calle 50 # 40-20");
  await page.getByLabel("Departamento").selectOption("Antioquia");
  await page.getByLabel("Ciudad").fill("Medellín");
  await page.getByLabel("Barrio").fill("Laureles");
  await page.getByRole("button", { name: "Registrar paciente" }).click();
  await page.getByRole("button", { name: "Confirmar cita" }).waitFor();
  await datosDeCita(page, { profesional: datos.profesional.nombre, hora: "16:00" });
  await page.getByRole("button", { name: "Confirmar cita" }).click();
  await page.getByText(/^Cita (creada|registrada)/).waitFor();
  expect(Date.now() - t0, "paciente nuevo").toBeLessThan(180_000);
});

test("dos personas confirman el mismo horario casi a la vez: solo una lo obtiene", async ({ browser }) => {
  const contextos = await Promise.all([browser.newContext(), browser.newContext()]);
  const [a, b] = await Promise.all(contextos.map((c) => c.newPage()));
  await iniciarSesion(a, USUARIOS_DEMO.recepcionista);
  await iniciarSesion(b, USUARIOS_DEMO.dueno);
  // Mismo consultorio y hora; profesionales y pacientes distintos: el único choque es el consultorio.
  const preparar = async (page: Page, documento: string, profesional: string) => {
    await page.goto(`/agenda/nueva?consultorio=${datos.consultorio.id}`);
    await buscarPaciente(page, documento);
    await page.getByRole("button", { name: "Confirmar cita" }).waitFor();
    await datosDeCita(page, { profesional, hora: "14:00" });
  };
  await preparar(a, datos.paciente.documento, datos.profesional.nombre);
  await preparar(b, `N${datos.marca}`, datos.profesional2.nombre);

  await Promise.all([a, b].map((p) => p.getByRole("button", { name: "Confirmar cita" }).click()));
  const resultado = (p: Page) =>
    Promise.race([
      p.getByText(/^Cita (creada|registrada)/).waitFor().then(() => "exito" as const),
      p.getByText("El consultorio ya está ocupado en ese horario").waitFor().then(() => "choque" as const),
    ]);
  const resultados = await Promise.all([resultado(a), resultado(b)]);
  expect(resultados.sort()).toEqual(["choque", "exito"]);
  await Promise.all(contextos.map((c) => c.close()));
});

test("el Profesional marca tiempos y registra la atención", async ({ page }) => {
  await iniciarSesion(page, datos.profesional.cedula);
  await page.goto("/mi-dia");
  const tarjeta = page.getByRole("listitem").filter({ hasText: datos.paciente.nombre }).filter({ hasText: "7:30" });
  await tarjeta.getByRole("button", { name: "Llegada" }).click();
  await tarjeta.getByRole("button", { name: "Ingreso a terapia" }).click();
  await tarjeta.getByRole("link", { name: "Registrar atención" }).click();
  await page.getByLabel("Técnica aplicada").fill("Movilización lumbar");
  await page.getByRole("radio", { name: "6" }).click();
  await page.getByLabel("Notas de evolución").fill("Mejora la flexión.");
  await page.getByRole("button", { name: "Registrar atención" }).click();
  await expect(page.getByText("Corregir atención")).toBeVisible();
});

test("la Recepcionista registra un abono y lo anula en Mis movimientos", async ({ page }) => {
  await iniciarSesion(page, USUARIOS_DEMO.recepcionista);
  await page.goto(`/citas/${datos.citaHoy}/cobro`);
  await page.getByLabel("Valor (COP)").fill("45000");
  await page.getByRole("button", { name: "Registrar cobro" }).click();
  await page.getByText(/Cobro registrado/).waitFor();
  await expect(page.getByText(/Total|Balance|Ingresos/)).toHaveCount(0);

  await page.goto("/mis-movimientos");
  const fila = page.getByRole("listitem").filter({ hasText: datos.paciente.nombre }).filter({ hasText: "45.000" });
  await fila.getByRole("button", { name: "Anular" }).click();
  await page.getByLabel("Motivo").fill("Valor equivocado");
  await page.getByRole("dialog").getByRole("button", { name: "Anular" }).click();
  await expect(fila.getByText("Anulado")).toBeVisible();
});
