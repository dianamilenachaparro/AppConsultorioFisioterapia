import type { Page } from "@playwright/test";

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
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}
