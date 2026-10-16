"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { buscarPacientePorDocumentoAccion, crearCitaAccion, crearPacienteAccion } from "@/app/(app)/agenda/acciones";
import { Button } from "@/components/ui/button";
import { Campo } from "@/components/ui/campo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { Fallo } from "@/lib/resultado";
import { NOMBRE_ZONA, ZONAS } from "@/lib/validacion/cita";
import { CamposHorario, type DatosHorario } from "./campos-horario";
import { CamposPaciente, PACIENTE_VACIO, type DatosPaciente } from "./form-paciente";

type PacienteCargado = DatosPaciente & { id: string };

/**
 * Crear cita (US2): 1) digitar documento → cargar paciente existente (FR-012) o
 * registrarlo completo (FR-011); 2) datos de la cita. Los errores de choque u
 * horario se muestran sin perder lo digitado.
 */
export function FormCita({
  consultorios,
  profesionales,
  inicial,
}: {
  consultorios: { id: string; nombre: string }[];
  profesionales: { id: string; nombreCompleto: string }[];
  inicial: DatosHorario;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [documento, setDocumento] = useState("");
  const [paciente, setPaciente] = useState<PacienteCargado | null>(null);
  const [nuevo, setNuevo] = useState<DatosPaciente | null>(null);
  const [horario, setHorario] = useState<DatosHorario>(inicial);
  const [motivo, setMotivo] = useState("");
  const [zona, setZona] = useState("");
  const [error, setError] = useState<Fallo | null>(null);

  const buscar = () =>
    iniciar(async () => {
      setError(null);
      const r = await buscarPacientePorDocumentoAccion(documento);
      if (!r.ok) return setError(r);
      if (r.data) {
        setPaciente(r.data);
        setNuevo(null);
      } else {
        setPaciente(null);
        setNuevo({ ...PACIENTE_VACIO, documento });
      }
    });

  const registrar = () =>
    iniciar(async () => {
      if (!nuevo) return;
      setError(null);
      const r = await crearPacienteAccion(nuevo);
      if (r.ok) {
        setPaciente(r.data);
        setNuevo(null);
        toast.success("Paciente registrado");
      } else if (r.error === "DUPLICADO" && r.data) {
        setPaciente(r.data as PacienteCargado);
        setNuevo(null);
        toast.info(r.mensaje);
      } else {
        setError(r);
      }
    });

  const confirmar = () =>
    iniciar(async () => {
      if (!paciente) return;
      setError(null);
      const r = await crearCitaAccion({
        pacienteId: paciente.id,
        ...horario,
        motivo,
        zonaCorporal: zona as (typeof ZONAS)[number],
      });
      if (!r.ok) return setError(r);
      toast.success(r.data.retroactiva ? "Cita registrada (retroactiva)" : "Cita creada");
      router.push(`/agenda?consultorio=${horario.consultorioId}&fecha=${horario.fecha}`);
    });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Paciente</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              buscar();
            }}
          >
            <Campo id="documento" etiqueta="Documento del paciente" className="flex-1">
              <Input
                id="documento"
                value={documento}
                onChange={(e) => {
                  setDocumento(e.target.value);
                  setPaciente(null);
                  setNuevo(null);
                }}
                autoFocus
                required
              />
            </Campo>
            <Button type="submit" variant="secondary" disabled={pendiente || !documento.trim()}>
              Buscar
            </Button>
          </form>

          {paciente && (
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <p className="font-medium">{paciente.nombreCompleto}</p>
              <p className="text-muted-foreground">
                Doc. {paciente.documento} · Tel. {paciente.telefono} · {paciente.ciudad}, {paciente.barrio}
              </p>
            </div>
          )}

          {nuevo && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                No hay un paciente con ese documento. Registra sus datos para continuar.
              </p>
              <CamposPaciente valores={nuevo} onChange={setNuevo} errores={error?.campos} />
              <Button type="button" onClick={registrar} disabled={pendiente}>
                Registrar paciente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {paciente && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Cita</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                confirmar();
              }}
            >
              <Campo id="motivo" etiqueta="Motivo de la terapia" error={error?.campos?.motivo}>
                <Textarea id="motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} required />
              </Campo>
              <Campo id="zona" etiqueta="Zona corporal" error={error?.campos?.zonaCorporal}>
                <NativeSelect id="zona" value={zona} onChange={(e) => setZona(e.target.value)} required>
                  <option value="">Selecciona…</option>
                  {ZONAS.map((z) => (
                    <option key={z} value={z}>
                      {NOMBRE_ZONA[z]}
                    </option>
                  ))}
                </NativeSelect>
              </Campo>
              <CamposHorario
                valores={horario}
                onChange={setHorario}
                consultorios={consultorios}
                profesionales={profesionales}
                errores={error?.campos}
              />
              <Button type="submit" size="lg" disabled={pendiente}>
                {pendiente ? "Guardando…" : "Confirmar cita"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && !error.campos && (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error.mensaje}
        </p>
      )}
    </div>
  );
}
