import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";

/**
 * Usuarios de `pnpm db:seed:demo` (contraseña de demo `demo12345`).
 * Las pruebas E2E corren contra la base de desarrollo con los datos de demo.
 */
export const USUARIOS_DEMO = {
  recepcionista: "1000000001",
  profesional: "1000000002",
  profesional2: "1000000003",
  dueno: "1000000009",
} as const;

export const PASSWORD_DEMO = "demo12345";

export async function iniciarSesion(page: Page, cedula: string) {
  await page.goto("/login");
  await page.getByLabel("Cédula").fill(cedula);
  await page.getByLabel("Contraseña").fill(PASSWORD_DEMO);
  await page.getByRole("button", { name: "Ingresar" }).click();
  // Tras el login se pasa por "/", que redirige según el rol: esperar la página final.
  await page.waitForURL((url) => url.pathname !== "/" && !url.pathname.startsWith("/login"));
}

/** Devuelve el menú principal; en celular primero lo abre desde el botón "Abrir menú". */
export async function abrirMenu(page: Page) {
  const boton = page.getByRole("button", { name: "Abrir menú" });
  if (await boton.isVisible()) await boton.click();
  return page.getByRole("navigation", { name: "Menú principal" }).filter({ visible: true });
}

export type DatosE2E = {
  marca: string;
  consultorio: { id: string; nombre: string };
  profesional: { id: string; cedula: string; nombre: string };
  profesional2: { id: string; cedula: string; nombre: string };
  paciente: { id: string; documento: string; nombre: string };
  citaHoy: string;
};

/** Crea en la base de desarrollo los datos propios de esta corrida (ver datos-e2e.ts). */
export function crearDatosE2E(): DatosE2E {
  const salida = execFileSync("pnpm", ["exec", "tsx", "tests/e2e/datos-e2e.ts", "crear"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return JSON.parse(salida.trim().split("\n").at(-1)!);
}

/** Desactiva el consultorio y los profesionales de la corrida para que no aparezcan en la agenda. */
export function retirarDatosE2E(d: DatosE2E) {
  execFileSync("pnpm", ["exec", "tsx", "tests/e2e/datos-e2e.ts", "retirar", d.consultorio.id, d.profesional.id, d.profesional2.id], {
    shell: process.platform === "win32",
  });
}

/** Ancho del documento menos el de la ventana: > 0 significa desplazamiento horizontal. */
export function desborde(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

/**
 * Busca un paciente por documento en "Nueva cita". Reintenta la escritura porque, si se
 * escribe antes de que React hidrate la página (pasa en WebKit), el estado no la registra.
 */
export async function buscarPaciente(page: Page, documento: string) {
  const buscar = page.getByRole("button", { name: "Buscar" });
  const campo = page.getByLabel("Documento del paciente");
  await expect(async () => {
    // Vaciar primero: si el texto ya quedó en el DOM antes de hidratar, volver a escribir el
    // mismo valor no cambia nada para React y no dispara onChange.
    await campo.fill("");
    await campo.fill(documento);
    await expect(buscar).toBeEnabled({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await buscar.click();
}
