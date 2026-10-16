"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { NOMBRE_ROL, type Rol } from "@/lib/permisos";
import type { Fallo } from "@/lib/resultado";
import { crearUsuarioAccion, editarUsuarioAccion } from "./acciones";

type Valores = { cedula: string; nombreCompleto: string; rol: Rol; atiendePacientes: boolean; passwordInicial: string };
type UsuarioEditable = { id: string; cedula: string; nombreCompleto: string; rol: Rol; atiendePacientes: boolean };

/** Crear usuario, o editar nombre, rol y si atiende pacientes cuando llega `usuario`. */
export function FormularioUsuario({ usuario }: { usuario?: UsuarioEditable }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [v, setV] = useState<Valores>(
    usuario
      ? { ...usuario, passwordInicial: "" }
      : { cedula: "", nombreCompleto: "", rol: "PROFESIONAL", atiendePacientes: true, passwordInicial: "" },
  );
  const [error, setError] = useState<Fallo | null>(null);
  const cambiar = (p: Partial<Valores>) => setV((x) => ({ ...x, ...p }));

  const guardar = () =>
    iniciar(async () => {
      setError(null);
      const r = usuario
        ? await editarUsuarioAccion({
            id: usuario.id,
            nombreCompleto: v.nombreCompleto,
            rol: v.rol,
            atiendePacientes: v.atiendePacientes,
          })
        : await crearUsuarioAccion(v);
      if (!r.ok) return setError(r);
      toast.success(usuario ? "Usuario actualizado" : "Usuario creado. Entrega la contraseña inicial en persona.");
      if (usuario) router.refresh();
      else router.push("/admin/usuarios");
    });

  const errores = error?.campos;
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        guardar();
      }}
    >
      <Campo id="cedula" etiqueta="Cédula" error={errores?.cedula}>
        <Input
          id="cedula"
          inputMode="numeric"
          value={v.cedula}
          disabled={!!usuario}
          onChange={(e) => cambiar({ cedula: e.target.value })}
        />
      </Campo>
      <Campo id="nombre" etiqueta="Nombre completo" error={errores?.nombreCompleto}>
        <Input id="nombre" value={v.nombreCompleto} onChange={(e) => cambiar({ nombreCompleto: e.target.value })} />
      </Campo>
      <Campo id="rol" etiqueta="Rol" error={errores?.rol}>
        <NativeSelect
          id="rol"
          value={v.rol}
          onChange={(e) => {
            const rol = e.target.value as Rol;
            const atiendePacientes = rol === "PROFESIONAL" ? true : rol === "RECEPCIONISTA" ? false : v.atiendePacientes;
            cambiar({ rol, atiendePacientes });
          }}
        >
          {(Object.keys(NOMBRE_ROL) as Rol[]).map((r) => (
            <option key={r} value={r}>
              {NOMBRE_ROL[r]}
            </option>
          ))}
        </NativeSelect>
      </Campo>
      {!usuario && (
        <Campo id="password" etiqueta="Contraseña inicial (mín. 8 caracteres)" error={errores?.passwordInicial}>
          <Input
            id="password"
            type="text"
            autoComplete="off"
            value={v.passwordInicial}
            onChange={(e) => cambiar({ passwordInicial: e.target.value })}
          />
        </Campo>
      )}
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          className="size-4"
          checked={v.atiendePacientes}
          disabled={v.rol === "RECEPCIONISTA"}
          onChange={(e) => cambiar({ atiendePacientes: e.target.checked })}
        />
        Atiende pacientes (se le pueden asignar citas)
      </label>
      {error && !error.campos && (
        <p role="alert" className="text-sm text-destructive sm:col-span-2">
          {error.mensaje}
        </p>
      )}
      <Button type="submit" disabled={pendiente} className="justify-self-start">
        {pendiente ? "Guardando…" : usuario ? "Guardar cambios" : "Crear usuario"}
      </Button>
    </form>
  );
}
