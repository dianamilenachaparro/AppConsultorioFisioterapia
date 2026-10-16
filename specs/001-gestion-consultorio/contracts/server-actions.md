# Contrato: Server Actions (mutaciones y consultas)

Todas las acciones se ejecutan en el servidor, obtienen la sesión de la cookie, verifican el permiso con `exigirPermiso` y validan la entrada con Zod **antes** de tocar la BD. Las mutaciones corren en una transacción que incluye su registro de auditoría.

**Forma de respuesta** (todas las acciones):

```ts
type Resultado<T> =
  | { ok: true; data: T }
  | { ok: false; error: CodigoError; mensaje: string; campos?: Record<string, string[]> };
```

**Códigos de error comunes**: `NO_AUTENTICADO`, `SIN_PERMISO`, `VALIDACION`, `NO_ENCONTRADO`, `CONFLICTO_CONSULTORIO`, `CONFLICTO_PROFESIONAL`, `CONFLICTO_PACIENTE`, `FUERA_DE_HORARIO`, `ESTADO_INVALIDO`, `STOCK_INSUFICIENTE`, `DUPLICADO`, `FUERA_DE_VENTANA` (edición/anulación fuera del mismo día), `ERROR_GOOGLE`.

Leyenda de roles: D/R/P (ver [rutas-ui.md](./rutas-ui.md)); "P*" = solo sobre sus propias citas/pacientes.

## Autenticación

| Acción | Rol | Entrada | Salida / reglas |
|---|---|---|---|
| `iniciarSesion` | público | `{ cedula: /^\d{5,15}$/, password: string }` | Crea sesión y cookie. Error único `CREDENCIALES_INVALIDAS` ("Cédula o contraseña incorrectas") para cédula inexistente, contraseña mala, usuario inactivo o bloqueado. 5 fallos → bloqueo 15 min. |
| `cerrarSesion` | todos | — | Borra sesión. |
| `cambiarPassword` | todos | `{ actual, nueva (≥8), confirmacion }` | Invalida las demás sesiones del usuario. |

## Usuarios y consultorios (US6)

| Acción | Rol | Entrada | Reglas |
|---|---|---|---|
| `crearUsuario` | D | `{ cedula, nombreCompleto, rol, atiendePacientes?, passwordInicial (≥8) }` | `DUPLICADO` si la cédula existe. `debeCambiarPassword=true`. |
| `editarUsuario` | D | `{ id, nombreCompleto?, rol?, atiendePacientes? }` | No puede dejar al sistema sin Dueño activo. |
| `cambiarEstadoUsuario` | D | `{ id, activo, confirmar?: boolean }` | Si desactiva y tiene citas futuras PROGRAMADAS y `confirmar` ≠ true → `{ ok:false, error:'REQUIERE_CONFIRMACION', data: citasPendientes[] }`. Al desactivar, borra sus sesiones. |
| `restablecerPassword` | D | `{ id, passwordNueva }` | Borra sesiones, `debeCambiarPassword=true`. |
| `crearConsultorio` / `editarConsultorio` | D | `{ nombre, orden? }` | `DUPLICADO` por nombre. |
| `cambiarEstadoConsultorio` | D | `{ id, activo, confirmar? }` | Igual advertencia de citas futuras que usuarios. |

## Pacientes (US2)

| Acción | Rol | Entrada | Reglas |
|---|---|---|---|
| `buscarPacientePorDocumento` | D, R | `{ documento }` | `{ paciente \| null }` — alimenta el autocompletado al crear cita (FR-012). |
| `buscarPacientes` | D, R, P* | `{ q, pagina }` | P solo ve pacientes con alguna cita suya. |
| `crearPaciente` | D, R | todos los campos de [Paciente](../data-model.md#paciente-paciente) obligatorios | `DUPLICADO` → devuelve el paciente existente para cargarlo. |
| `editarPaciente` | D, R | `{ id, ...campos }` (documento editable solo por D) | Auditado. |

## Agenda y citas (US2, US3)

| Acción | Rol | Entrada | Reglas |
|---|---|---|---|
| `obtenerGrilla` | D, R | `{ consultorioId, fecha: 'YYYY-MM-DD' }` | 19 bloques `{ hora:'07:30', estado:'DISPONIBLE'\|'OCUPADO', cita?: {id, paciente, profesional, estado, retroactiva} }`. < 2 s (SC-003). |
| `obtenerMiAgenda` | P, D | `{ fecha }` | Citas propias en todos los consultorios. |
| `crearCita` | D, R | `{ pacienteId, consultorioId, profesionalId, fecha, horaInicio:'HH:MM', duracionMin, motivo, zonaCorporal }` | Valida horario (`FUERA_DE_HORARIO`), consultorio activo, profesional asignable. Inserta; SQLSTATE 23P01 → `CONFLICTO_*` según restricción. `retroactiva` = inicio < ahora. Nunca queda una cita parcial. |
| `reprogramarCita` | D, R | `{ id, consultorioId?, profesionalId?, fecha?, horaInicio?, duracionMin? }` | Solo PROGRAMADA (`ESTADO_INVALIDO`); mismas validaciones que crear. Auditado con antes/después. |
| `marcarAsistida` | D, R | `{ id }` | PROGRAMADA → ASISTIDA. |
| `cancelarCita` | D, R | `{ id, observacion: string ≥ 5 }` | PROGRAMADA → CANCELADA; guarda quién/cuándo; libera bloques. Sin observación → `VALIDACION`. |
| `revertirEstadoCita` | D | `{ id, motivo }` | ASISTIDA/CANCELADA → PROGRAMADA; re-valida choques; rechaza si hay atención o cobro vigente. |
| `listarCitas` | D, R, P* | `{ desde, hasta, consultorioId?, profesionalId?, estado?, pagina }` | `{ filas, total, conteos: { PROGRAMADA, ASISTIDA, CANCELADA } }`. P: `profesionalId` forzado al suyo. |

## Marcación de tiempos (US5)

| Acción | Rol | Entrada | Reglas |
|---|---|---|---|
| `marcarLlegada` | P*, D* (si es el profesional) | `{ citaId }` | Cita de hoy, no cancelada, sin llegada. Hora = `now()` servidor. |
| `marcarIngreso` | P* | `{ citaId }` | Requiere llegada; si PROGRAMADA → ASISTIDA (misma transacción). |
| `marcarFin` | P* | `{ citaId }` | Requiere ingreso. |
| `corregirMarcacion` | D | `{ citaId, llegadaEn?, ingresoEn?, finEn?, motivo }` | Respeta orden; audita antes/después (FR-030). |

Respuesta de las tres marcas: estado completo de la marcación y siguiente botón habilitado (`'LLEGADA' \| 'INGRESO' \| 'FIN' \| null`).

## Indicadores (US5)

| Acción | Rol | Entrada | Salida |
|---|---|---|---|
| `obtenerIndicadores` | D; P (forzado a sí mismo) | `{ periodo: 'DIA'\|'SEMANA'\|'MES', fecha, profesionalId?, consultorioId? }` | `{ rango:{desde,hasta}, esperaPromedioMin, duracionRealPromedioMin, retrasoPromedioMin, porcentajeATiempo, conteos:{programadas, asistidas, canceladas}, muestras:{espera, duracion, puntualidad} }` — `muestras` indica cuántas citas entraron a cada cálculo (las incompletas se excluyen). |

Ejemplo de verificación (US5-3): programada 08:00, llegada 07:55, ingreso 08:10, fin 08:40 → espera 15, duración 30, retraso 10, no a tiempo (> 5 min).

## Atenciones e historial (US4)

| Acción | Rol | Entrada | Reglas |
|---|---|---|---|
| `registrarAtencion` | P*, D | `{ citaId, zonaCorporal, motivo, tecnica, dolor: int 0..10, notasEvolucion }` | Cita ASISTIDA; una por cita (`DUPLICADO`). |
| `editarAtencion` | autor, D | `{ id, ...campos }` | Solo el mismo día de creación (Bogotá) → si no, `FUERA_DE_VENTANA`. Audita `antes`/`despues` (versión anterior). |
| `agregarNotaAclaratoria` | autor, D | `{ atencionId, texto: 5..2000 }` | En cualquier momento; append-only. |
| `obtenerVersionesAtencion` | D, R, P* | `{ atencionId }` | Versiones anteriores desde la auditoría `{ editadoPor, editadoEn, antes, despues }[]`. |
| `obtenerHistorial` | D, R, P* | `{ pacienteId }` | `{ paciente, atenciones[] (orden por fecha desc, cada una con `notasAclaratorias[]` y `editable: boolean`), serieDolor: { [zona]: {fecha, dolor}[] } }`. P sin cita con el paciente → `SIN_PERMISO`. ≤ 3 s con 100 atenciones (SC-009). |

## Inventario (US7)

| Acción | Rol | Entrada | Reglas |
|---|---|---|---|
| `crearInsumo` | D | `{ nombre, costo, precioVenta, stockInicial ≥0, stockMinimo }` | Crea movimiento `AJUSTE_INICIAL` si stockInicial > 0. |
| `editarInsumo` | D | `{ id, nombre?, costo?, precioVenta?, stockMinimo?, activo? }` | El stock **no** se edita directamente. |
| `registrarVenta` | D, R | `{ insumoId, cantidad > 0, medioPago, fecha? }` | Transacción: bloqueo, `STOCK_INSUFICIENTE` si no alcanza, movimiento VENTA + ingreso VENTA_INSUMOS por `cantidad × precioVenta`. |
| `registrarReposicion` | D | `{ insumoId, cantidad > 0, costoUnitario, medioPago, fecha? }` | Movimiento REPOSICION + egreso categoría COMPRA_INSUMOS. |
| `anularMovimientoInventario` | D; R (ventas propias del día) | `{ id, motivo }` | Revierte stock y anula el financiero enlazado. Reposiciones: solo D. Regla `puedeAnular` ([data-model](../data-model.md#movimientofinanciero-movimiento_financiero)); fuera de ventana → `FUERA_DE_VENTANA`. |

## Finanzas (US8)

| Acción | Rol | Entrada | Reglas |
|---|---|---|---|
| `obtenerCobrosCita` | D, R, P* | `{ citaId }` | `{ cobros: {id, valor, medioPago, fecha, anulado}[], sumaVigente }` — se muestra antes de registrar un abono. |
| `registrarCobroTerapia` | D, R, P* | `{ citaId, valor > 0, medioPago, fecha? }` | Cita ASISTIDA. Admite varios cobros (abonos) por cita. P solo en citas propias (`SIN_PERMISO`). R y P reciben solo la confirmación. |
| `registrarEgreso` | D | `{ categoriaId, fecha, valor > 0, medioPago, descripcion }` | Todos obligatorios. |
| `anularMovimientoFinanciero` | D; R, P (propios del día) | `{ id, motivo }` | Cobros de terapia: D siempre; autor solo el mismo día (Bogotá), si no `FUERA_DE_VENTANA` ("Solicítalo al Dueño"). Egresos: solo D. Si está enlazado a inventario, se anula vía `anularMovimientoInventario`. |
| `listarMisMovimientosHoy` | R, P | — | Cobros y ventas creados hoy por el usuario `{ id, tipo, descripcion, valor, medioPago, anulado, anulable }[]`; **sin totales** (FR-041). |
| `consultarFinanzas` | D | `FiltroFinanzas = { desde, hasta, tipo?, subtipoIngreso?, categoriaId?, medioPago?, incluirAnulados?=false }` | `{ filas[], totales: { ingresos, egresos, balance } }`. Totales calculados sobre **todas** las filas filtradas (no solo la página). |
| `exportarFinanzasAGoogle` | D | `FiltroFinanzas` | Ver [exportacion-google-sheets.md](./exportacion-google-sheets.md). Devuelve `{ urlHoja }`. |
