"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Fallo } from "@/lib/resultado";
import { cambiarPasswordAccion } from "./acciones";

const CAMPOS = [
  { name: "actual", etiqueta: "Contraseña actual", autoComplete: "current-password" },
  { name: "nueva", etiqueta: "Nueva contraseña (mínimo 8 caracteres)", autoComplete: "new-password" },
  { name: "confirmacion", etiqueta: "Confirma la nueva contraseña", autoComplete: "new-password" },
] as const;

export function FormularioCambioPassword() {
  const [estado, enviar, pendiente] = useActionState<Fallo | null, FormData>(cambiarPasswordAccion, null);
  return (
    <form action={enviar} className="flex flex-col gap-4">
      {CAMPOS.map((c) => (
        <div key={c.name} className="flex flex-col gap-2">
          <Label htmlFor={c.name}>{c.etiqueta}</Label>
          <Input id={c.name} name={c.name} type="password" autoComplete={c.autoComplete} required />
          {estado?.campos?.[c.name] && <p className="text-sm text-destructive">{estado.campos[c.name][0]}</p>}
        </div>
      ))}
      {estado && !estado.campos && (
        <p role="alert" className="text-sm text-destructive">
          {estado.mensaje}
        </p>
      )}
      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
