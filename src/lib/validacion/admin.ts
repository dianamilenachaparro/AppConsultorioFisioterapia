import { z } from "zod";
import { cedula, password, uuid } from "./comunes";

export const ROLES = ["DUENO", "RECEPCIONISTA", "PROFESIONAL"] as const;
export const rol = z.enum(ROLES, { error: "Elige un rol" });

const nombreCompleto = z
  .string()
  .trim()
  .min(3, "El nombre debe tener al menos 3 caracteres")
  .max(120, "El nombre admite máximo 120 caracteres");

export const crearUsuarioSchema = z.object({
  cedula,
  nombreCompleto,
  rol,
  atiendePacientes: z.boolean().optional(),
  passwordInicial: password,
});

export const editarUsuarioSchema = z.object({
  id: uuid,
  nombreCompleto: nombreCompleto.optional(),
  rol: rol.optional(),
  atiendePacientes: z.boolean().optional(),
});

export const cambiarEstadoSchema = z.object({
  id: uuid,
  activo: z.boolean(),
  confirmar: z.boolean().optional(),
});

export const restablecerPasswordSchema = z.object({ id: uuid, passwordNueva: password });

export const consultorioSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio").max(60, "El nombre admite máximo 60 caracteres"),
  orden: z.coerce.number().int().min(0).max(999).optional(),
});

export const editarConsultorioSchema = consultorioSchema.partial().extend({ id: uuid });

export type CrearUsuarioEntrada = z.input<typeof crearUsuarioSchema>;
