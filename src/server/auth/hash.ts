import "server-only";
import { hash, verify } from "@node-rs/argon2";

// Parámetros OWASP para Argon2id: m=19 MiB, t=2, p=1 (research R-06).
const OPCIONES = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string) {
  return hash(password, OPCIONES);
}

export async function verificarPassword(hashGuardado: string, password: string) {
  try {
    return await verify(hashGuardado, password);
  } catch {
    return false;
  }
}

let hashFicticio: Promise<string> | undefined;

/** Hash de una contraseña aleatoria, para igualar tiempos cuando la cédula no existe. */
export function obtenerHashFicticio() {
  hashFicticio ??= hash(crypto.randomUUID(), OPCIONES);
  return hashFicticio;
}
