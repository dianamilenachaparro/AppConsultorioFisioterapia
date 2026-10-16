# Research: Gestión de consultorio de Quiropraxia / Fisioterapia

**Fase**: 0 (Outline & Research) | **Fecha**: 2026-10-14 | **Plan**: [plan.md](./plan.md)

Cada sección resuelve una incógnita del Technical Context o una decisión de plataforma que la spec dejó para planificación. Formato: Decisión / Justificación / Alternativas consideradas.

---

## R-01 · Plataforma y framework web

- **Decisión**: Una sola aplicación **Next.js 16 (App Router) + React 19 + TypeScript 5**, desplegada en **Vercel**, con renderizado en servidor (Server Components) y mutaciones mediante **Server Actions**. Node.js 22 LTS.
- **Justificación**: Es el stack propuesto en la descripción original (ver `checklists/requirements.md`). Un único proyecto cubre UI responsive y backend, sin una API separada que mantener. Los Server Components permiten que los datos sensibles (salud, finanzas) nunca lleguen al navegador si el rol no tiene permiso, porque el filtrado ocurre en el servidor.
- **Alternativas**: Django + HTMX (encaja muy bien con CRUD y restricciones de exclusión nativas, pero se aparta del stack pedido); SPA (React/Vite) + API REST separada (dos despliegues y más superficie de seguridad, sin ventaja para ~50 citas/día).

## R-02 · Base de datos y ORM

- **Decisión**: **PostgreSQL 16** gestionado en **Neon** (integración nativa de Vercel Marketplace), región `us-east-1` junto a la región de funciones de Vercel `iad1`. ORM **Prisma 7** con driver adapter (`@prisma/adapter-neon` en producción, `@prisma/adapter-pg` en local/pruebas). Se usa la cadena de conexión *pooled* para el runtime y la *directa* para migraciones.
- **Justificación**: Base relacional pedida en la descripción; Postgres aporta restricciones de exclusión (R-03), `CHECK`, triggers y transacciones `SERIALIZABLE`/`FOR UPDATE`, que son exactamente lo que piden FR-015, FR-043 y SC-007. Neon tiene ramas de base de datos útiles para *preview deployments* y respaldo con *point-in-time restore*.
- **Alternativas**: Supabase (también válido, pero trae su propia auth/API que no se usarían); Vercel Postgres (ya migrado a Neon); MySQL (sin restricciones de exclusión por rango).

## R-03 · Garantía de cero citas superpuestas (FR-015, FR-017, SC-001)

- **Decisión**: La garantía vive **en la base de datos**, no solo en la aplicación. La tabla `cita` guarda `inicio` y `fin` (`timestamptz`) y tiene tres restricciones de exclusión GiST (extensión `btree_gist`):
  - `EXCLUDE USING gist (consultorio_id WITH =, tstzrange(inicio, fin, '[)') WITH &&) WHERE (estado <> 'CANCELADA')`
  - lo mismo con `profesional_id`
  - lo mismo con `paciente_id` (FR-017: el paciente no puede tener dos citas superpuestas)

  Prisma no modela restricciones de exclusión: se agregan como SQL manual en la migración (`prisma migrate dev --create-only` y editar el `.sql`). Al crear o reprogramar, el servicio intenta el `INSERT/UPDATE` dentro de una transacción; si Postgres devuelve SQLSTATE **`23P01`** (exclusion_violation), se traduce según el nombre de la restricción a un mensaje claro: "El consultorio ya está ocupado en ese horario", "El profesional no está disponible" o "El paciente ya tiene una cita en ese horario". La verificación previa en la UI (grilla) es solo una ayuda; la autoridad es la restricción.
- **Justificación**: Dos confirmaciones simultáneas no pueden ganarle a una restricción de BD: la segunda transacción falla de forma atómica y no deja citas parciales (una cita = una fila, cubre varios bloques). Funciona igual para citas retroactivas. Las cancelaciones liberan bloques automáticamente gracias al `WHERE estado <> 'CANCELADA'`.
- **Alternativas**: una fila por bloque de 30 min con `UNIQUE(consultorio, bloque)` (funciona, pero complica reprogramar, duraciones y la consulta de profesional); bloqueo `SELECT … FOR UPDATE` + verificación en la aplicación (frágil: si alguien olvida el bloqueo en un camino nuevo, se rompe la garantía); bloqueos asesores (`pg_advisory_xact_lock`) por consultorio/fecha (válido como complemento, innecesario con la restricción).

## R-04 · Reglas de horario (FR-008, FR-016)

- **Decisión**: Validación en dos capas: (1) esquema Zod en el servidor (minutos de inicio en :00 o :30, duración múltiplo de 30 entre 30 y 570, inicio ≥ 07:30 y fin ≤ 17:00 hora de Bogotá, mismo día); (2) `CHECK` en Postgres equivalente usando `(inicio AT TIME ZONE 'America/Bogota')::time`. La duración se guarda (`duracion_min`) y `fin` se deriva y se valida con `CHECK (fin = inicio + duracion_min * interval '1 minute')`.
- **Justificación**: Defensa en profundidad; la BD nunca acepta una cita fuera de horario aunque haya un error en la aplicación.
- **Alternativas**: solo validación en la aplicación (menos robusta).

## R-05 · Zona horaria (FR-042)

- **Decisión**: Guardar instantes como `timestamptz` (UTC internamente) y fechas de calendario como `date`. Toda conversión y todo "hoy", corte de día/semana/mes se hacen explícitamente con `America/Bogota` usando `date-fns` 4 + `@date-fns/tz` (`TZDate`). La semana empieza el **lunes** (convención colombiana). Las consultas de rango por día usan límites calculados en Bogotá (`[00:00, 24:00)` local → UTC). Formato visible con `Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota' })`.
- **Justificación**: Los servidores de Vercel corren en UTC; nunca debe usarse la zona del proceso. Colombia no tiene horario de verano (UTC−5 fijo), lo que simplifica pero no elimina la necesidad de ser explícitos.
- **Alternativas**: Guardar hora local sin zona (`timestamp`) — rechazado por ambigüedad; Luxon/Temporal — válidos, pero date-fns ya cubre el caso con menor peso.

## R-06 · Autenticación propia y sesiones (FR-001, FR-004, FR-005)

- **Decisión**: Autenticación propia, sin proveedor externo:
  - Usuario = cédula (solo dígitos, 5–15) + contraseña (mín. 8 caracteres).
  - Hash **Argon2id** con `@node-rs/argon2` (parámetros OWASP: m=19 MiB, t=2, p=1).
  - Sesiones en BD (tabla `sesion`): token aleatorio de 32 bytes en cookie `HttpOnly; Secure; SameSite=Lax; Path=/`; en BD solo se guarda el SHA-256 del token. Expiración por inactividad de **30 min** (se renueva `ultima_actividad` en cada solicitud, como máximo una escritura por minuto) y vida absoluta de 12 h.
  - Bloqueo: 5 intentos fallidos consecutivos → `bloqueado_hasta = ahora + 15 min` en el usuario. Mensaje genérico "Cédula o contraseña incorrectas" en todos los casos (incluye cédula inexistente, usuario inactivo y bloqueado); para cédulas inexistentes se ejecuta igualmente un hash de verificación para igualar tiempos.
  - Al desactivar un usuario o restablecer su contraseña se borran todas sus sesiones.
  - El primer Dueño se crea con un script de semilla que pide la contraseña (no hay contraseña por defecto en código).
- **Justificación**: La spec pide autenticación propia por cédula; no hay correo ni recuperación externa. Sesiones en BD permiten revocar al instante (desactivación).
- **Alternativas**: Auth.js / Better Auth con Credentials (añaden capas pensadas para OAuth/email que no se usan; Better Auth sería la alternativa si se quiere menos código propio); JWT sin estado (no permite revocar sesiones al desactivar un usuario).

## R-07 · Autorización por rol (FR-002, FR-027, SC-005)

- **Decisión**: Una matriz de permisos única en código (`src/lib/permisos.ts`) que refleja la tabla de la spec, consumida por:
  1. una **capa de acceso a datos** (`src/server/**`): cada función de lectura/escritura recibe la sesión y llama a `exigirPermiso(sesion, 'finanzas:ver')` o aplica el filtro por profesional (`profesional_id = sesion.usuarioId`) dentro de la consulta;
  2. los layouts/páginas, para ocultar menús;
  3. `proxy.ts` (antes `middleware.ts`) **solo** para redirigir a `/login` cuando no hay cookie — nunca como única barrera.
  Los accesos denegados devuelven la página 403 "No tienes permiso para ver esta sección".
- **Justificación**: Ocultar menús no es seguridad; la verificación tiene que estar donde se leen los datos (lección de CVE-2025-29927 sobre middleware en Next.js). Un único punto de verdad permite probar la matriz completa con una prueba parametrizada (rol × acción) para SC-005.
- **Alternativas**: Row-Level Security de Postgres (potente, pero complica Prisma con conexiones *pooled*; se deja como mejora futura).

## R-08 · Auditoría inmutable (FR-030, FR-043, SC-006)

- **Decisión**: Tabla `registro_auditoria` (append-only) escrita **en la misma transacción** que la operación auditada desde la capa de servicios (`auditar(tx, {...})`). Un trigger de Postgres rechaza cualquier `UPDATE` o `DELETE` sobre esa tabla. Además, las tablas `cita`, `movimiento_financiero` y `movimiento_inventario` llevan `creado_por/creado_en` (y `actualizado_*`, `anulado_*` donde aplica). Las correcciones de marcaciones y la reversión de estados guardan valores anteriores y nuevos en JSON.
- **Justificación**: Si la acción se guarda, su auditoría también (atomicidad); ningún usuario puede editarla ni siquiera con un bug en la aplicación.
- **Alternativas**: Triggers de auditoría genéricos en BD (no conocen al usuario de la aplicación sin `SET LOCAL app.usuario_id`, lo cual es frágil con pooling); extensiones Prisma `$extends` para auditar automáticamente (difícil capturar el "motivo" y la intención de la acción).

## R-09 · Inventario y finanzas consistentes (FR-034, FR-035, FR-044, SC-007)

- **Decisión**:
  - `insumo.stock` se guarda (para consultas rápidas) y tiene `CHECK (stock >= 0)`. Cada venta/reposición/anulación ocurre en una transacción que: bloquea el insumo (`SELECT … FOR UPDATE`), inserta el `movimiento_inventario`, actualiza el stock con `UPDATE … SET stock = stock ± n` e inserta el `movimiento_financiero` enlazado. Si el stock quedaría negativo, la BD rechaza (y la aplicación muestra "Stock insuficiente").
  - El stock inicial al crear un insumo se registra como movimiento `AJUSTE_INICIAL` (sin efecto financiero), para que siempre se cumpla `stock = Σ movimientos no anulados`.
  - Nada se borra: anular marca `anulado=true` con motivo/usuario/fecha, revierte el stock y anula el movimiento financiero enlazado en la misma transacción.
  - Dinero en **pesos colombianos enteros** (`Int`/`BigInt` sin decimales); el COP no usa centavos en la práctica.
  - Prueba de invariante (SC-007) en la suite de integración.
- **Alternativas**: stock calculado siempre como suma (simple pero más lento y sin `CHECK` directo); saldo por *event sourcing* (excesivo para el volumen).

## R-10 · Exportación a Google Sheets (FR-040, SC-008)

- **Decisión**: OAuth 2.0 de Google (flujo web, `access_type=offline`) iniciado por el Dueño desde "Finanzas → Conectar Google". Scope mínimo **`https://www.googleapis.com/auth/drive.file`** (solo archivos creados por la app; scope no sensible). El *refresh token* se guarda cifrado (AES-256-GCM con clave `GOOGLE_TOKEN_KEY` en variables de entorno de Vercel). En cada exportación se crea una hoja nueva con `spreadsheets.create` y se escriben filas + totales con `spreadsheets.values.batchUpdate` (paquete `googleapis`). Las filas y totales se generan con **la misma función** que alimenta la tabla en pantalla, con los mismos filtros, para que coincidan exactamente. Si Google falla, se muestra el error y no se modifica ningún dato local.
- **Justificación**: Cumple "exportar directamente a Google Sheets" sin pedir acceso a todo el Drive del Dueño. Una sola fuente de datos garantiza SC-008.
- **Alternativas**: cuenta de servicio (la hoja quedaría en una cuenta ajena y habría que compartirla); exportar CSV para importar manualmente (no cumple "directamente"; se ofrece como respaldo opcional sin costo extra).
- **Nota operativa**: hay que crear un proyecto en Google Cloud, habilitar Sheets API y Drive API y configurar la pantalla de consentimiento. Mientras la app esté en modo "Testing", el Dueño debe estar en la lista de usuarios de prueba y el refresh token caduca a los 7 días; para uso real se publica la app (con `drive.file` no requiere verificación de seguridad).

## R-11 · UI responsive y gráficas (FR-045, SC-004, SC-010)

- **Decisión**: **Tailwind CSS 4** con componentes **shadcn/ui** (Radix) copiados al repositorio; diseño *mobile-first*. Formularios con Server Actions + validación **Zod** compartida cliente/servidor. Gráfica de evolución del dolor con **Recharts** (una línea por zona corporal, eje Y 0–10). Botones de marcación grandes (≥ 48 px) en la vista "Mi día" del profesional, con actualización optimista (`useOptimistic`) para cumplir el "único toque" en < 5 s.
- **Alternativas**: Bootstrap (válido, menos alineado con el ecosistema Next.js); Chart.js (válido; Recharts encaja mejor con React).

## R-12 · Pruebas

- **Decisión**:
  - **Vitest** para unitarias (reglas de horario, zona horaria, cálculo de indicadores, matriz de permisos).
  - **Vitest + PostgreSQL real** (Docker local / servicio en CI) para integración: restricciones de exclusión, concurrencia (dos transacciones simultáneas con `Promise.all`), invariantes de stock, inmutabilidad de auditoría. No se usa SQLite ni mocks de BD porque las garantías clave viven en Postgres.
  - **Playwright** para E2E de los recorridos P1/P2, en viewport de escritorio y de celular (Pixel 7 / iPhone 14) para SC-010.
- **Alternativas**: Jest (más lento y con peor soporte ESM); Cypress (Playwright cubre mejor múltiples viewports y paralelismo).

## R-13 · Indicadores (FR-031, FR-032)

- **Decisión**: Calculados al vuelo con SQL de agregación (Prisma `$queryRaw` tipado) sobre `cita` + `marcacion`, con filtros de periodo (día/semana/mes en Bogotá), profesional y consultorio. Cada indicador excluye las citas a las que les falta la marca necesaria. "A tiempo" = ingreso ≤ hora programada + 5 min. Índices en `(inicio)`, `(profesional_id, inicio)`, `(consultorio_id, inicio)`.
- **Justificación**: ~50 citas/día ≈ 18 000/año; agregados directos responden en milisegundos. No se necesitan tablas resumen ni trabajos programados.
- **Alternativas**: vistas materializadas (innecesarias a este volumen).

## R-14 · Registro y anulación de cobros y ventas fuera del Dueño (FR-037, FR-044 — aclarado 2026-10-14)

- **Decisión**:
  - Permisos en la matriz: `cobro:registrar` → D, R, P (P con filtro `cita.profesional_id = sesion.usuarioId` aplicado dentro de la consulta, no solo en la UI); `inventario:vender` → D, R.
  - **Abonos**: varios cobros de terapia por cita; no hay índice único por cita. Para evitar dobles registros accidentales (dos roles cobrando la misma cita), el formulario muestra los cobros vigentes de la cita y su suma antes de confirmar; no se bloquea.
  - **Anulación**: función pura `puedeAnular(sesion, movimiento, ahora)` en `src/server/finanzas/` = Dueño, o autor con `fechaBogota(creado_en) = hoyBogota(ahora)`. Se evalúa dentro de la transacción tras `SELECT … FOR UPDATE` del movimiento (evita carrera con otra anulación). Fuera de ventana → `FUERA_DE_VENTANA` con mensaje "Solicítalo al Dueño".
  - **Vista "Mis movimientos de hoy"** (R y P): lista solo `creado_por = yo` del día, sin totales agregados; es la única superficie financiera que ven, cumpliendo FR-041.
- **Justificación**: Quien recibe el dinero lo registra al momento; la ventana del mismo día corrige errores de digitación sin dar a R/P poder sobre movimientos históricos. El "ahora" se inyecta para poder probar el corte de medianoche en Bogotá.
- **Alternativas**: un cobro único por cita (descartado por la aclaración: se requieren abonos); anulación solo por el Dueño (cuello de botella); ventana de N horas móviles (menos intuitiva que "el mismo día").

## R-15 · Despliegue y Ley 1581

- **Decisión**: Vercel (plan Pro recomendado para uso comercial; Hobby solo para pruebas), región de funciones `iad1`; Neon `us-east-1` (respaldos en R-16). Variables de entorno: `DATABASE_URL` (pooled), `DIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY`, `APP_URL`. HTTPS obligatorio (Vercel), cabeceras de seguridad (CSP, `X-Frame-Options: DENY`, HSTS) en `next.config.ts`. Las *preview deployments* usan una rama de Neon con datos ficticios, **nunca** datos reales de pacientes. Logs sin datos personales ni de salud.
- **Justificación**: La transferencia internacional de datos a EE. UU. es aceptada por la SIC (Circular Externa 005 de 2017 lo lista como país con nivel adecuado); aun así el consultorio debe tener su política de tratamiento de datos. La app limita el acceso al personal autorizado y deja trazabilidad.
- **Alternativas**: VPS propio (más mantenimiento, sin ventaja para el volumen).

## R-16 · Respaldos y recuperación (FR-044a, SC-011 — aclarado 2026-10-14)

- **Decisión**: Dos mecanismos complementarios:
  1. **Recuperación a un momento específico (PITR) de Neon** con ventana de restauración ≥ 7 días. Requiere un **plan de pago de Neon** (el plan gratuito tiene una ventana de horas); confirmar en la página de precios de Neon al contratar que la ventana configurada sea ≥ 7 días. Neon conserva el WAL de forma continua, así que la pérdida máxima es de segundos, dentro de los 5 minutos de SC-011. La restauración se hace creando una rama a un instante dado y, tras verificarla, promoviéndola o restaurando la rama principal.
  2. **Respaldo lógico diario retenido 30 días**: flujo programado de GitHub Actions (`cron` diario, 03:00 Bogotá = 08:00 UTC) que ejecuta `pg_dump --format=custom` contra la conexión directa, cifra el archivo con `age` (clave pública en el repo, clave privada solo en poder del Dueño fuera del sistema) y lo sube a un bucket privado de almacenamiento compatible con S3 (p. ej. Cloudflare R2) con regla de ciclo de vida que borra objetos de más de 30 días. El flujo falla visiblemente (notificación de GitHub) si el dump o la subida fallan.
  - **Simulacro de restauración** (SC-011): antes de salir a producción y luego trimestralmente, restaurar (a) una rama PITR a un instante de hace 10 minutos y (b) el último dump en un Postgres local, verificando conteos de `cita`, `atencion`, `movimiento_financiero` y que el invariante de stock se cumpla. Se documenta en [quickstart.md](./quickstart.md).
- **Justificación**: El PITR cubre la pérdida máxima de unos 5 minutos y la ventana de 7 días; el dump diario cubre los 30 días de retención y protege también ante pérdida de la cuenta o del proveedor. El cifrado con `age` mantiene ilegibles los datos de salud fuera de la BD (Ley 1581).
- **Alternativas**: solo PITR con ventana de 30 días (plan más costoso de Neon y sin copia fuera del proveedor); snapshots programados del proveedor (depende del plan y de la disponibilidad de la función; válido si se confirma que retiene 30 días); Vercel Cron para el dump (las funciones no traen `pg_dump` y tienen límite de duración).

## R-17 · Ventana de edición y versiones de atenciones (FR-025a)

- **Decisión**: Edición permitida al autor o al Dueño solo el mismo día calendario de Bogotá en que se creó. Doble barrera: validación en el servicio + trigger `BEFORE UPDATE` en `atencion` que compara fechas en `America/Bogota` (y `BEFORE DELETE` que siempre falla). Las versiones anteriores se guardan en `registro_auditoria.antes/despues` (ya append-only), en lugar de una tabla de versiones aparte. Tras la ventana solo se agregan filas a `nota_aclaratoria` (append-only por trigger).
- **Justificación**: Información de salud: la BD impide modificar el registro clínico aunque exista un bug en la aplicación. Reutilizar la auditoría evita duplicar mecanismos; el volumen (una atención por cita) es mínimo.
- **Alternativas**: tabla `atencion_version` con copia completa por edición (más explícita, duplica la auditoría); inmutabilidad total (descartada por la aclaración); edición libre auditada (descartada).
