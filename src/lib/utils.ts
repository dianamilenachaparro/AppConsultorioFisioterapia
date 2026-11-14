export { cn } from "cn"

/** Iniciales para avatares: primera y última palabra que empiecen por letra ("Ana (Demo) Ruiz" → "AR"). */
export function iniciales(nombre: string) {
  const palabras = nombre.match(/\p{L}[\p{L}'-]*/gu) ?? []
  const [primera, ultima] = [palabras[0], palabras.length > 1 ? palabras[palabras.length - 1] : undefined]
  return ((primera?.[0] ?? "") + (ultima?.[0] ?? "")).toUpperCase()
}
