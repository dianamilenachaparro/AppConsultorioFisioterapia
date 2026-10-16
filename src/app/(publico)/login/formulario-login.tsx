"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { iniciarSesionAccion, type EstadoLogin } from "./acciones";

export function FormularioLogin({ siguiente }: { siguiente?: string }) {
  const [estado, enviar, pendiente] = useActionState<EstadoLogin, FormData>(iniciarSesionAccion, null);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="siguiente" value={siguiente ?? ""} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="cedula">Cédula</Label>
        <Input
          id="cedula"
          name="cedula"
          inputMode="numeric"
          autoComplete="username"
          required
          className="h-11 text-base"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 text-base"
        />
      </div>
      {estado && (
        <p role="alert" className="text-sm text-destructive">
          {estado.mensaje}
        </p>
      )}
      <Button type="submit" size="lg" className="h-11" disabled={pendiente}>
        {pendiente ? "Ingresando…" : "Ingresar"}
      </Button>
    </form>
  );
}
