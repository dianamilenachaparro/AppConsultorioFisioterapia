import { describe, expect, it } from "vitest";
import { autenticar } from "@/server/auth/login";
import { crearSesionEnBD, validarToken } from "@/server/auth/sesion";
import { prisma } from "@/server/db";
import { crearUsuarioPrueba, PASSWORD_PRUEBA } from "./helpers";

const MENSAJE = "Cédula o contraseña incorrectas.";

async function esperarCredencialesInvalidas(promesa: Promise<unknown>) {
  await expect(promesa).rejects.toMatchObject({ codigo: "CREDENCIALES_INVALIDAS", message: MENSAJE });
}

describe("autenticación (US1)", () => {
  it("inicia sesión con cédula y contraseña correctas", async () => {
    const u = await crearUsuarioPrueba({ rol: "RECEPCIONISTA" });
    const usuario = await autenticar({ cedula: u.cedula, password: PASSWORD_PRUEBA });
    expect(usuario.id).toBe(u.id);
  });

  it("usa el mismo mensaje genérico para cédula inexistente, contraseña mala, inactivo y bloqueado", async () => {
    const activo = await crearUsuarioPrueba({ rol: "PROFESIONAL" });
    const inactivo = await crearUsuarioPrueba({ rol: "PROFESIONAL", activo: false });
    const bloqueado = await crearUsuarioPrueba({ rol: "PROFESIONAL" });
    await prisma.usuario.update({
      where: { id: bloqueado.id },
      data: { bloqueadoHasta: new Date(Date.now() + 10 * 60_000) },
    });

    await esperarCredencialesInvalidas(autenticar({ cedula: "99999999999", password: PASSWORD_PRUEBA }));
    await esperarCredencialesInvalidas(autenticar({ cedula: activo.cedula, password: "otra-clave-1" }));
    await esperarCredencialesInvalidas(autenticar({ cedula: inactivo.cedula, password: PASSWORD_PRUEBA }));
    await esperarCredencialesInvalidas(autenticar({ cedula: bloqueado.cedula, password: PASSWORD_PRUEBA }));
  });

  it("bloquea 15 minutos tras 5 intentos fallidos y luego permite entrar", async () => {
    const u = await crearUsuarioPrueba({ rol: "RECEPCIONISTA" });
    const t0 = new Date("2026-10-14T15:00:00Z");
    for (let i = 0; i < 5; i++) {
      await esperarCredencialesInvalidas(autenticar({ cedula: u.cedula, password: "mala-clave" }, t0));
    }
    const fila = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(fila.bloqueadoHasta?.toISOString()).toBe(new Date(t0.getTime() + 15 * 60_000).toISOString());

    // 6.º intento con la contraseña correcta: rechazado.
    await esperarCredencialesInvalidas(
      autenticar({ cedula: u.cedula, password: PASSWORD_PRUEBA }, new Date(t0.getTime() + 60_000)),
    );
    // Pasados 16 minutos: entra y se reinician los contadores.
    const ok = await autenticar({ cedula: u.cedula, password: PASSWORD_PRUEBA }, new Date(t0.getTime() + 16 * 60_000));
    expect(ok.id).toBe(u.id);
    const despues = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(despues.intentosFallidos).toBe(0);
    expect(despues.bloqueadoHasta).toBeNull();
  });

  it("un inicio exitoso reinicia los intentos fallidos", async () => {
    const u = await crearUsuarioPrueba({ rol: "RECEPCIONISTA" });
    await esperarCredencialesInvalidas(autenticar({ cedula: u.cedula, password: "mala-clave" }));
    await autenticar({ cedula: u.cedula, password: PASSWORD_PRUEBA });
    const fila = await prisma.usuario.findUniqueOrThrow({ where: { id: u.id } });
    expect(fila.intentosFallidos).toBe(0);
  });

  it("la sesión expira tras 30 minutos de inactividad", async () => {
    const u = await crearUsuarioPrueba({ rol: "DUENO" });
    const t0 = new Date();
    const token = await crearSesionEnBD(u.id, t0);
    expect(await validarToken(token, new Date(t0.getTime() + 29 * 60_000))).not.toBeNull();
    // La validación anterior renovó la actividad; 31 min después de ella expira.
    expect(await validarToken(token, new Date(t0.getTime() + 60 * 60_000))).toBeNull();
  });

  it("la sesión de un usuario desactivado deja de ser válida", async () => {
    const u = await crearUsuarioPrueba({ rol: "PROFESIONAL" });
    const token = await crearSesionEnBD(u.id);
    await prisma.usuario.update({ where: { id: u.id }, data: { activo: false } });
    expect(await validarToken(token)).toBeNull();
  });
});
