import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Clave de 32 bytes en base64 (`GOOGLE_TOKEN_KEY`). */
function clave() {
  const valor = process.env.GOOGLE_TOKEN_KEY;
  const bytes = valor ? Buffer.from(valor, "base64") : Buffer.alloc(0);
  if (bytes.length !== 32) throw new Error("GOOGLE_TOKEN_KEY debe ser una clave de 32 bytes en base64");
  return bytes;
}

/** AES-256-GCM con IV aleatorio de 12 bytes; formato `iv.tag.datos` en base64url. */
export function cifrar(texto: string) {
  const iv = randomBytes(12);
  const cifrador = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([cifrador.update(texto, "utf8"), cifrador.final()]);
  return [iv, cifrador.getAuthTag(), datos].map((b) => b.toString("base64url")).join(".");
}

export function descifrar(valor: string) {
  const [iv, tag, datos] = valor.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !datos) throw new Error("Valor cifrado con formato inválido");
  const descifrador = createDecipheriv("aes-256-gcm", clave(), iv);
  descifrador.setAuthTag(tag);
  return Buffer.concat([descifrador.update(datos), descifrador.final()]).toString("utf8");
}

/** Firma HMAC para valores de cookie (por ejemplo el `state` de OAuth). */
export function firmar(valor: string) {
  return `${valor}.${createHmac("sha256", clave()).update(valor).digest("base64url")}`;
}

/** Devuelve el valor original si la firma es válida, o `null`. */
export function verificarFirma(firmado: string | undefined) {
  if (!firmado) return null;
  const i = firmado.lastIndexOf(".");
  if (i <= 0) return null;
  const valor = firmado.slice(0, i);
  const esperado = Buffer.from(firmar(valor));
  const recibido = Buffer.from(firmado);
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido) ? valor : null;
}
