# Data Model: Gestión de consultorio

**Fase**: 1 | **Fecha**: 2026-10-14 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

Motor: PostgreSQL 16 (Prisma 7). Convenciones: tablas y columnas en `snake_case` (mapeadas a `camelCase` en Prisma con `@map`), IDs `uuid` (`gen_random_uuid()`), instantes en `timestamptz`, fechas de calendario en `date`, dinero en pesos colombianos enteros (`integer`, rango suficiente hasta ~2 100 millones por movimiento; usar `bigint` en totales agregados). Las restricciones marcadas **[SQL]** no se pueden expresar en `schema.prisma` y se agregan a mano en la migración.

## Enumeraciones

| Enum | Valores |
|---|---|
| `Rol` | `DUENO`, `RECEPCIONISTA`, `PROFESIONAL` |
| `EstadoCita` | `PROGRAMADA`, `ASISTIDA`, `CANCELADA` |
| `ZonaCorporal` | `CERVICAL`, `DORSAL`, `LUMBAR`, `HOMBRO`, `CODO`, `MUNECA_MANO`, `CADERA`, `RODILLA`, `TOBILLO_PIE`, `OTRA` |
| `MedioPago` | `EFECTIVO`, `TRANSFERENCIA` |
| `TipoMovimientoFinanciero` | `INGRESO`, `EGRESO` |
| `SubtipoIngreso` | `TERAPIA`, `VENTA_INSUMOS` |
| `TipoMovimientoInventario` | `AJUSTE_INICIAL`, `VENTA`, `REPOSICION` |

## Diagrama de relaciones

```text
Usuario 1──* Sesion
Usuario 1──* Cita (como profesional)          Consultorio 1──* Cita
Paciente 1──* Cita                            Cita 1──0..1 Marcacion
Cita 1──0..1 Atencion ──* Paciente/Usuario    Cita 1──* MovimientoFinanciero (cobros/abonos)
Atencion 1──* NotaAclaratoria
Insumo 1──* MovimientoInventario 1──0..1 MovimientoFinanciero
CategoriaEgreso 1──* MovimientoFinanciero (egresos)
Usuario(Dueño) 1──0..1 ConexionGoogle
Usuario 1──* RegistroAuditoria
```

---

## Usuario (`usuario`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| cedula | text | **único**; solo dígitos, 5–15 caracteres |
| nombre_completo | text | obligatorio, 3–120 |
| rol | Rol | obligatorio |
| atiende_pacientes | boolean | default `true` si rol=PROFESIONAL; el Dueño puede activarlo para ser asignable a citas; siempre `false` para RECEPCIONISTA (**[SQL]** `CHECK (rol <> 'RECEPCIONISTA' OR NOT atiende_pacientes)`) |
| password_hash | text | Argon2id; nunca se expone |
| activo | boolean | default `true` |
| intentos_fallidos | smallint | default 0; se reinicia al iniciar sesión con éxito |
| bloqueado_hasta | timestamptz? | 15 min tras 5 intentos fallidos |
| debe_cambiar_password | boolean | `true` al crear o restablecer contraseña |
| creado_en / actualizado_en | timestamptz | |

- "Profesional asignable" = `activo AND atiende_pacientes`.
- Debe existir al menos un Dueño activo: el servicio impide desactivar o cambiar el rol del último Dueño activo.
- Desactivar con citas futuras PROGRAMADAS → se muestran las citas pendientes como advertencia antes de confirmar; las citas se conservan.

## Sesion (`sesion`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| usuario_id | FK → usuario | `ON DELETE CASCADE` |
| token_hash | text | **único**; SHA-256 del token de la cookie |
| creada_en | timestamptz | vida absoluta 12 h |
| ultima_actividad | timestamptz | expira a los 30 min de inactividad |

## Consultorio (`consultorio`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| nombre | text | **único**, obligatorio |
| orden | smallint | orden de visualización |
| activo | boolean | default `true`; inactivo no aparece para crear citas |
| creado_en / actualizado_en | timestamptz | |

Semilla: "Consultorio 1", "Consultorio 2", "Consultorio 3".

## Paciente (`paciente`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| documento | text | **único**; alfanumérico 4–20 (admite CC, TI, CE, pasaporte); se normaliza sin puntos ni espacios |
| nombre_completo | text | obligatorio |
| telefono | text | obligatorio; 7–15 dígitos |
| fecha_nacimiento | date | obligatorio; ≤ hoy (Bogotá) |
| direccion | text | obligatorio |
| departamento | text | obligatorio; de la lista de 33 (32 departamentos + Bogotá D.C.) |
| ciudad | text | obligatorio |
| barrio | text | obligatorio |
| creado_por / creado_en / actualizado_en | | |

Índices: `documento` (único), índice trigram o `lower(nombre_completo)` para búsqueda por nombre.

## Cita (`cita`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| paciente_id | FK → paciente | obligatorio |
| profesional_id | FK → usuario | obligatorio; debe ser profesional asignable al crear/reprogramar |
| consultorio_id | FK → consultorio | obligatorio; activo al crear/reprogramar |
| inicio | timestamptz | minutos :00 o :30 hora Bogotá; ≥ 07:30 |
| duracion_min | smallint | múltiplo de 30, 30–570 |
| fin | timestamptz | `= inicio + duracion_min` ; ≤ 17:00 del mismo día (Bogotá) |
| motivo | text | obligatorio, ≤ 500 |
| zona_corporal | ZonaCorporal | obligatorio |
| estado | EstadoCita | default `PROGRAMADA` |
| retroactiva | boolean | `true` si `inicio < ahora` al crearla; visible en UI |
| observacion_cancelacion | text? | obligatoria (≥ 5 caracteres) si estado = CANCELADA |
| cancelada_por / cancelada_en | FK usuario? / timestamptz? | obligatorios si CANCELADA |
| creado_por / creado_en / actualizado_por / actualizado_en | | |

**Restricciones [SQL]**:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE cita ADD CONSTRAINT cita_sin_choque_consultorio
  EXCLUDE USING gist (consultorio_id WITH =, tstzrange(inicio, fin, '[)') WITH &&)
  WHERE (estado <> 'CANCELADA');
ALTER TABLE cita ADD CONSTRAINT cita_sin_choque_profesional
  EXCLUDE USING gist (profesional_id WITH =, tstzrange(inicio, fin, '[)') WITH &&)
  WHERE (estado <> 'CANCELADA');
ALTER TABLE cita ADD CONSTRAINT cita_sin_choque_paciente
  EXCLUDE USING gist (paciente_id WITH =, tstzrange(inicio, fin, '[)') WITH &&)
  WHERE (estado <> 'CANCELADA');
ALTER TABLE cita ADD CONSTRAINT cita_duracion_valida
  CHECK (duracion_min % 30 = 0 AND duracion_min BETWEEN 30 AND 570
         AND fin = inicio + make_interval(mins => duracion_min));
ALTER TABLE cita ADD CONSTRAINT cita_en_horario
  CHECK ((inicio AT TIME ZONE 'America/Bogota')::time >= '07:30'
     AND (fin AT TIME ZONE 'America/Bogota')::time <= '17:00'
     AND (inicio AT TIME ZONE 'America/Bogota')::date = (fin AT TIME ZONE 'America/Bogota')::date
     AND extract(minute FROM inicio AT TIME ZONE 'America/Bogota') IN (0, 30));
ALTER TABLE cita ADD CONSTRAINT cita_cancelacion_completa
  CHECK (estado <> 'CANCELADA' OR (observacion_cancelacion IS NOT NULL
         AND cancelada_por IS NOT NULL AND cancelada_en IS NOT NULL));
```

Índices: `(consultorio_id, inicio)`, `(profesional_id, inicio)`, `(paciente_id, inicio)`, `(estado, inicio)`.

**Transiciones de estado**:

```text
PROGRAMADA ──(marcar asistida / marcar ingreso a terapia)──▶ ASISTIDA
PROGRAMADA ──(cancelar + observación)──────────────────────▶ CANCELADA   (libera bloques)
ASISTIDA  ──(solo Dueño, con motivo, auditado)─────────────▶ PROGRAMADA
CANCELADA ──(solo Dueño, con motivo, auditado; re-valida choques)──▶ PROGRAMADA
```

- Reprogramar (fecha, hora, duración, consultorio, profesional) solo en PROGRAMADA; mismas validaciones.
- No hay transición ASISTIDA → CANCELADA directa (el Dueño primero revierte a PROGRAMADA).
- No se puede revertir a PROGRAMADA una cita con atención registrada o cobro vigente.

**Grilla de disponibilidad (derivada, no se guarda)**: para un consultorio y una fecha se generan los 19 bloques `07:30 … 16:30`; un bloque está Ocupado si existe una cita no cancelada con `tstzrange(inicio, fin) && [bloque, bloque+30min)`.

## Marcacion (`marcacion`)

| Campo | Tipo | Reglas |
|---|---|---|
| cita_id | uuid PK, FK → cita | 1 a 1 |
| llegada_en / llegada_por | timestamptz? / FK usuario? | |
| ingreso_en / ingreso_por | timestamptz? / FK usuario? | requiere llegada |
| fin_en / fin_por | timestamptz? / FK usuario? | requiere ingreso |

**[SQL]** `CHECK ((ingreso_en IS NULL OR llegada_en IS NOT NULL) AND (fin_en IS NULL OR ingreso_en IS NOT NULL) AND (ingreso_en IS NULL OR ingreso_en >= llegada_en) AND (fin_en IS NULL OR fin_en >= ingreso_en))`.

- Marcación por toque: solo el profesional asignado, solo citas de **hoy** (Bogotá) no canceladas, hora = `now()` del servidor; cada marca solo una vez.
- Registrar ingreso cambia la cita PROGRAMADA → ASISTIDA en la misma transacción (FR-029).
- Corrección: solo Dueño; puede fijar cualquier marca a un valor arbitrario respetando el orden; se audita valor anterior/nuevo (FR-030). Es la vía para citas retroactivas.

## Atencion (`atencion`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| cita_id | FK → cita | **único** (una atención por cita); la cita debe estar ASISTIDA |
| paciente_id | FK → paciente | copiado de la cita (consulta de historial) |
| profesional_id | FK → usuario | profesional de la cita |
| fecha | timestamptz | = `cita.inicio` |
| zona_corporal | ZonaCorporal | precargada desde la cita, editable |
| motivo | text | precargado desde la cita, editable |
| tecnica | text | obligatorio |
| dolor | smallint | **[SQL]** `CHECK (dolor BETWEEN 0 AND 10)` |
| notas_evolucion | text | obligatorio |
| creado_por / creado_en / actualizado_por / actualizado_en | | crea: profesional de la cita o Dueño; edita: el autor (`creado_por`) o el Dueño, solo el mismo día |

Índice: `(paciente_id, fecha)`.

- Historial = atenciones del paciente ordenadas por `fecha`; gráfica = serie `(fecha, dolor)` agrupada por `zona_corporal`.
- Acceso Profesional: solo si existe alguna `cita` (cualquier estado) con `paciente_id = X AND profesional_id = yo`.
- **Ventana de edición (FR-025a)**: editable solo mientras `(now() AT TIME ZONE 'America/Bogota')::date = (creado_en AT TIME ZONE 'America/Bogota')::date`. **[SQL]** trigger `BEFORE UPDATE ON atencion` que lanza excepción fuera de esa ventana, y `BEFORE DELETE` que siempre la lanza. El servicio valida antes y devuelve `FUERA_DE_VENTANA`.
- **Versiones**: cada edición escribe en `registro_auditoria` (`ATENCION_EDITAR`) los valores anteriores (`antes`) y nuevos (`despues`), en la misma transacción. El historial de versiones de una atención se obtiene filtrando la auditoría por `entidad='atencion' AND entidad_id = id`.

## NotaAclaratoria (`nota_aclaratoria`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| atencion_id | FK → atencion | obligatorio |
| texto | text | obligatorio, 5–2000 |
| creado_por / creado_en | FK usuario / timestamptz | autor de la atención o Dueño |

- Append-only: **[SQL]** trigger `BEFORE UPDATE OR DELETE → RAISE EXCEPTION`. Se muestra en el historial bajo la atención, en orden cronológico, sin reemplazar el contenido original.
- Se puede agregar en cualquier momento (también el mismo día). Auditado como `ATENCION_NOTA_AGREGAR`.

## Insumo (`insumo`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| nombre | text | **único** (sin distinguir mayúsculas) |
| costo | integer | ≥ 0 (COP) |
| precio_venta | integer | ≥ 0 (COP) |
| stock | integer | **[SQL]** `CHECK (stock >= 0)`; solo cambia por movimientos |
| stock_minimo | integer | ≥ 0 |
| activo | boolean | default `true` |
| creado_en / actualizado_en | | |

- `bajo_minimo` (derivado) = `stock < stock_minimo` → alerta visual (FR-036).

## MovimientoInventario (`movimiento_inventario`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| insumo_id | FK → insumo | |
| tipo | TipoMovimientoInventario | |
| cantidad | integer | > 0 |
| valor_unitario | integer | VENTA: precio de venta usado; REPOSICION: costo unitario pagado; AJUSTE_INICIAL: costo |
| fecha | date | Bogotá; default hoy |
| anulado | boolean | default `false` |
| anulado_por / anulado_en / motivo_anulacion | | obligatorios si anulado |
| creado_por / creado_en | | |

- Invariante (SC-007): `insumo.stock = Σ(AJUSTE_INICIAL + REPOSICION) − Σ(VENTA)` sobre movimientos no anulados.
- VENTA y REPOSICION generan exactamente un `movimiento_financiero` enlazado; AJUSTE_INICIAL ninguno.
- Anular: revierte stock (falla si quedaría negativo) y anula el movimiento financiero enlazado, en una transacción. Quién: ver "Regla de anulación" en [MovimientoFinanciero](#movimientofinanciero-movimiento_financiero).

## CategoriaEgreso (`categoria_egreso`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| clave | text | **único**: `ARRIENDO`, `SERVICIOS_PUBLICOS`, `COMPRA_INSUMOS`, `NOMINA`, `MANTENIMIENTO`, `OTROS` |
| nombre | text | visible |
| activo | boolean | |

Semilla fija; `COMPRA_INSUMOS` la usa el sistema para reposiciones.

## MovimientoFinanciero (`movimiento_financiero`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | uuid PK | |
| tipo | TipoMovimientoFinanciero | |
| subtipo_ingreso | SubtipoIngreso? | obligatorio si INGRESO, nulo si EGRESO |
| categoria_egreso_id | FK? | obligatorio si EGRESO, nulo si INGRESO |
| fecha | date | Bogotá |
| valor | integer | > 0 |
| medio_pago | MedioPago | obligatorio |
| descripcion | text | obligatorio en egresos; autogenerado en ventas/reposiciones/cobros |
| cita_id | FK? → cita | obligatorio si subtipo TERAPIA |
| movimiento_inventario_id | FK? → movimiento_inventario | **único**; obligatorio si VENTA_INSUMOS o egreso de reposición |
| anulado / anulado_por / anulado_en / motivo_anulacion | | |
| creado_por / creado_en | | |

**[SQL]**:
- `CHECK` de coherencia tipo/subtipo/categoría descrita arriba.
- Una cita puede tener **varios cobros de terapia (abonos)**, cada uno con su valor y medio de pago (sin restricción de unicidad por cita). No existe "valor total esperado"; la UI muestra la suma de cobros vigentes de la cita.
- Cobro de terapia: cita en estado ASISTIDA.
- `CHECK (NOT anulado OR (anulado_por IS NOT NULL AND anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL))`.

Índices: `(fecha)`, `(tipo, fecha)`, `(medio_pago, fecha)`, `(cita_id)`, `(creado_por, creado_en)` (para "mis movimientos de hoy").

**Quién registra (FR-037)**: cobro de terapia → Dueño, Recepcionista o Profesional (este solo si `cita.profesional_id = yo`); venta de insumos → Dueño o Recepcionista; egresos y reposiciones → solo Dueño.

**Regla de anulación (FR-044)** — aplica a cobros de terapia y ventas de insumos (el movimiento de inventario y su financiero se anulan juntos):

```text
puede_anular(usuario, mov) =
     usuario.rol = DUENO
  OR (mov.creado_por = usuario.id
      AND fecha_bogota(mov.creado_en) = hoy_bogota())
```

Egresos y reposiciones: solo Dueño. Motivo obligatorio siempre. Recepcionista y Profesional solo pueden **listar** sus propios movimientos creados hoy (`creado_por = yo AND creado_en ∈ hoy Bogotá`), sin totales agregados.

## ConexionGoogle (`conexion_google`)

| Campo | Tipo | Reglas |
|---|---|---|
| usuario_id | uuid PK, FK → usuario | rol DUENO |
| email_google | text | para mostrar "Conectado como …" |
| refresh_token_cifrado | text | AES-256-GCM (`GOOGLE_TOKEN_KEY`) |
| conectado_en | timestamptz | |

## RegistroAuditoria (`registro_auditoria`)

| Campo | Tipo | Reglas |
|---|---|---|
| id | bigint identity PK | |
| usuario_id | FK → usuario | quién |
| accion | text | p. ej. `CITA_CREAR`, `CITA_CANCELAR`, `CITA_REPROGRAMAR`, `CITA_REVERTIR_ESTADO`, `MARCACION_REGISTRAR`, `MARCACION_CORREGIR`, `ATENCION_CREAR`, `ATENCION_EDITAR`, `ATENCION_NOTA_AGREGAR`, `INVENTARIO_VENTA`, `INVENTARIO_REPOSICION`, `MOVIMIENTO_ANULAR`, `EGRESO_CREAR`, `COBRO_CREAR`, `USUARIO_*`, `CONSULTORIO_*`, `PACIENTE_*`, `FINANZAS_EXPORTAR`, `SESION_INICIAR`, `SESION_BLOQUEO` |
| entidad | text | nombre de la tabla |
| entidad_id | text | |
| antes | jsonb? | valores anteriores (solo campos cambiados) |
| despues | jsonb? | valores nuevos |
| motivo | text? | obligatorio en correcciones, reversiones y anulaciones |
| creado_en | timestamptz | default `now()` |

**[SQL]** trigger `BEFORE UPDATE OR DELETE ON registro_auditoria → RAISE EXCEPTION` (append-only). Se escribe en la misma transacción que la acción auditada.

---

## Trazabilidad requisito → modelo

| Requisito | Dónde se garantiza |
|---|---|
| FR-010, edge "documento duplicado" | `paciente.documento` único |
| FR-015, FR-017, SC-001 | 3 restricciones `EXCLUDE` en `cita` |
| FR-016 | `cita_en_horario` + Zod |
| FR-020 | `cita_cancelacion_completa` + exclusión con `WHERE estado <> 'CANCELADA'` |
| FR-024 (dolor 0–10) | `CHECK` en `atencion.dolor` |
| FR-025a (edición mismo día, versiones, notas) | trigger de ventana en `atencion` + `registro_auditoria.antes` + `nota_aclaratoria` append-only |
| FR-037 (abonos, quién cobra) | sin unicidad por cita en `movimiento_financiero`; matriz de permisos + filtro `profesional_id` |
| FR-028 (orden de marcas) | `CHECK` en `marcacion` |
| FR-034, SC-007 | `CHECK (stock >= 0)` + transacción con `FOR UPDATE` |
| FR-043, SC-006 | `registro_auditoria` + trigger append-only |
| FR-044 | sin `DELETE` en servicios; columnas `anulado_*`; `puede_anular` (autor mismo día o Dueño) |
| FR-044a, SC-011 | fuera del modelo: PITR de Neon + respaldo lógico diario (ver [research.md R-16](./research.md)) |
