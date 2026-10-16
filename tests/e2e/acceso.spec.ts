import { expect, test } from "@playwright/test";
import { abrirMenu, iniciarSesion, USUARIOS_DEMO } from "./utilidades";

test.describe("US1 – acceso por rol", () => {
  test("sin sesión, una pantalla interna redirige a /login sin mostrar datos", async ({ page }) => {
    await page.goto("/pacientes/00000000-0000-0000-0000-000000000000/historial");
    await expect(page).toHaveURL(/\/login\?siguiente=/);
    await expect(page.getByText("Historial")).toHaveCount(0);
  });

  test("Recepcionista ve Agenda y Pacientes, no Finanzas ni Administración", async ({ page }) => {
    await iniciarSesion(page, USUARIOS_DEMO.recepcionista);
    const menu = await abrirMenu(page);
    await expect(menu.getByRole("link", { name: "Agenda" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Pacientes" })).toBeVisible();
    await expect(menu.getByRole("link", { name: "Finanzas" })).toHaveCount(0);
    await expect(menu.getByRole("link", { name: "Administración" })).toHaveCount(0);
  });

  test("Recepcionista no puede abrir finanzas", async ({ page }) => {
    await iniciarSesion(page, USUARIOS_DEMO.recepcionista);
    await page.goto("/finanzas");
    await expect(page.getByText("No tienes permiso para ver esta sección")).toBeVisible();
  });

  test("Profesional no puede abrir finanzas", async ({ page }) => {
    await iniciarSesion(page, USUARIOS_DEMO.profesional);
    await page.goto("/finanzas");
    await expect(page.getByText("No tienes permiso para ver esta sección")).toBeVisible();
  });

  test("credenciales incorrectas muestran un mensaje genérico", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Cédula").fill("123456789");
    await page.getByLabel("Contraseña").fill("incorrecta");
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByText("Cédula o contraseña incorrectas.")).toBeVisible();
  });
});
