import "server-only";
import { randomBytes } from "node:crypto";
import { google } from "googleapis";
import { ErrorDominio } from "@/lib/resultado";
import { auditar } from "@/server/auditoria/auditar";
import { exigirPermiso, type Sesion } from "@/server/auth/sesion";
import { prisma } from "@/server/db";
import { cifrar, descifrar, firmar, verificarFirma } from "./cifrado";

export const COOKIE_ESTADO_OAUTH = "google_oauth_estado";
export const VIDA_ESTADO_S = 10 * 60;
const ALCANCES = ["https://www.googleapis.com/auth/drive.file", "openid", "email"];

function variable(nombre: string) {
  const v = process.env[nombre];
  if (!v) throw new Error(`Falta la variable de entorno ${nombre}`);
  return v;
}

export function clienteOAuth() {
  return new google.auth.OAuth2(
    variable("GOOGLE_CLIENT_ID"),
    variable("GOOGLE_CLIENT_SECRET"),
    `${variable("APP_URL")}/api/google/oauth/callback`,
  );
}

/** Paso 1: URL de consentimiento y el `state` firmado que va a la cookie. Solo el Dueño. */
export function iniciarConexion(sesion: Sesion) {
  exigirPermiso(sesion, "finanzas:exportar");
  const estado = randomBytes(24).toString("base64url");
  const url = clienteOAuth().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ALCANCES,
    state: estado,
    include_granted_scopes: false,
  });
  return { url, cookie: firmar(estado) };
}

/** Paso 2: valida el `state`, intercambia el código y guarda el refresh token cifrado. */
export async function completarConexion(
  sesion: Sesion,
  { code, state, cookie }: { code: string | null; state: string | null; cookie: string | undefined },
) {
  exigirPermiso(sesion, "finanzas:exportar");
  const esperado = verificarFirma(cookie);
  if (!code || !state || !esperado || esperado !== state) {
    throw new ErrorDominio("ERROR_GOOGLE", "La solicitud de conexión no es válida o expiró. Intenta de nuevo.");
  }
  const cliente = clienteOAuth();
  const { tokens } = await cliente.getToken(code);
  if (!tokens.refresh_token || !tokens.id_token) {
    throw new ErrorDominio("ERROR_GOOGLE", "Google no entregó el permiso sin conexión. Intenta de nuevo.");
  }
  const ticket = await cliente.verifyIdToken({ idToken: tokens.id_token, audience: variable("GOOGLE_CLIENT_ID") });
  const email = ticket.getPayload()?.email ?? "cuenta de Google";
  await prisma.$transaction(async (tx) => {
    const datos = { emailGoogle: email, refreshTokenCifrado: cifrar(tokens.refresh_token!), conectadoEn: new Date() };
    await tx.conexionGoogle.upsert({
      where: { usuarioId: sesion.usuarioId },
      create: { usuarioId: sesion.usuarioId, ...datos },
      update: datos,
    });
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: "GOOGLE_CONECTAR",
      entidad: "conexion_google",
      entidadId: sesion.usuarioId,
      despues: { emailGoogle: email },
    });
  });
  return { email };
}

export async function obtenerConexion(sesion: Sesion) {
  exigirPermiso(sesion, "finanzas:exportar");
  return prisma.conexionGoogle.findUnique({
    where: { usuarioId: sesion.usuarioId },
    select: { emailGoogle: true, conectadoEn: true },
  });
}

/** Revoca el token en Google (si falla, igual se borra localmente) y borra la conexión. */
export async function desconectarGoogle(sesion: Sesion) {
  exigirPermiso(sesion, "finanzas:exportar");
  const conexion = await prisma.conexionGoogle.findUnique({ where: { usuarioId: sesion.usuarioId } });
  if (!conexion) return;
  try {
    await clienteOAuth().revokeToken(descifrar(conexion.refreshTokenCifrado));
  } catch {
    // El token ya pudo estar revocado o vencido; la conexión local se elimina de todos modos.
  }
  await prisma.$transaction(async (tx) => {
    await tx.conexionGoogle.delete({ where: { usuarioId: sesion.usuarioId } });
    await auditar(tx, {
      usuarioId: sesion.usuarioId,
      accion: "GOOGLE_DESCONECTAR",
      entidad: "conexion_google",
      entidadId: sesion.usuarioId,
      antes: { emailGoogle: conexion.emailGoogle },
    });
  });
}
