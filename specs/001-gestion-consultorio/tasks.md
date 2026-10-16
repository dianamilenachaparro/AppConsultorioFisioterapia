---

description: "Lista de tareas para implementar la gestión del consultorio de Quiropraxia / Fisioterapia"
---

# Tasks: Gestión de consultorio de Quiropraxia / Fisioterapia

**Input**: Documentos de diseño en `specs/001-gestion-consultorio/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Se incluyen pruebas de integración contra PostgreSQL real **solo para las garantías que la spec exige verificar con pruebas** (SC-001 concurrencia, SC-005 matriz de permisos, SC-007 invariante de stock, SC-008 exportación, SC-011 restauración, ventanas del mismo día de FR-025a/FR-044) y las listadas como mínimas en [quickstart.md](./quickstart.md). Escríbelas antes de la implementación de su historia y verifica que fallen.

**Organization**: Tareas agrupadas por historia de usuario (US1 … US8 de la spec), en orden de prioridad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: Historia de usuario a la que pertenece (US1 … US8)

## Convenciones del proyecto (aplican a TODAS las tareas)

- Un único proyecto Next.js 16 en la raíz del repositorio: `src/`, `prisma/`, `tests/` (ver estructura en [plan.md](./plan.md#source-code-repository-root)).
- Todo archivo bajo `src/server/` empieza con `import 'server-only'`. Las páginas y Server Actions son delgadas: validan con Zod, llaman a un servicio de `src/server/**` y devuelven `Resultado<T>` (definido en T016).
- Cada servicio que lee o modifica datos recibe la `Sesion` como primer argumento y llama a `exigirPermiso(sesion, '<accion>')` (T018) **antes** de tocar la BD; los filtros por profesional (`profesional_id = sesion.usuarioId`) van dentro de la consulta, nunca solo en la UI.
- Toda mutación corre en `prisma.$transaction` y llama a `auditar(tx, …)` (T017) en la misma transacción.
- Toda fecha/hora se calcula con `src/lib/tiempo.ts` (T013) en `America/Bogota`; las funciones que dependen de "ahora" reciben `ahora: Date = new Date()` como parámetro para poder probarlas.
- Dinero en pesos colombianos enteros (`Int`), sin decimales.
- Textos de la UI en español (es-CO).

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Inicializar el proyecto y las herramientas.

- [X] T001 Crear el proyecto Next.js 16 (App Router, TypeScript estricto, carpeta `src/`, alias `@/*`) en la raíz del repositorio con pnpm, conservando las carpetas existentes `.claude/`, `.specify/` y `specs/` (si `create-next-app` rechaza el directorio no vacío, generarlo en una carpeta temporal y mover `package.json`, `tsconfig.json`, `next.config.ts`, `src/`, `public/`, `.gitignore`); agregar `.env*` (excepto `.env.example`) a `.gitignore`
- [X] T002 Instalar dependencias en `package.json`: `prisma@7`, `@prisma/client@7`, `@prisma/adapter-pg`, `@prisma/adapter-neon`, `@neondatabase/serverless`, `pg`, `zod@4`, `@node-rs/argon2`, `date-fns@4`, `@date-fns/tz`, `recharts`, `googleapis`, `server-only`; dev: `vitest`, `@vitest/coverage-v8`, `@playwright/test`, `tsx`, `@types/pg`, `prettier`, `prettier-plugin-tailwindcss`, `autocannon`
- [X] T003 [P] Crear `docker-compose.yml` con el servicio `db` (`postgres:16`, puerto `5432`, usuario/clave `consultorio`/`consultorio`, base `consultorio`, volumen `pgdata`) y un script `docker/init-test-db.sql` montado en `/docker-entrypoint-initdb.d/` que crea la base `consultorio_test`
- [X] T004 [P] Crear `.env.example` con `DATABASE_URL`, `DIRECT_URL`, `DATABASE_URL_TEST`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY` (32 bytes base64), `APP_URL`, cada uno con un comentario de una línea y valores de ejemplo para Docker local
- [X] T005 Agregar scripts en `package.json`: `dev`, `build` (`prisma migrate deploy && next build`), `start`, `lint`, `typecheck` (`tsc --noEmit`), `test` (`vitest run --project unit`), `test:integration` (`vitest run --project integration`), `test:e2e` (`playwright test`), `db:seed` (`tsx prisma/seed.ts`), `db:seed:demo` (`tsx prisma/seed-demo.ts`), `db:seed:carga` (`tsx prisma/seed-carga.ts`); configurar `prisma.config.ts` con `seed` y ruta del esquema; crear `.prettierrc`
- [X] T006 [P] Crear `vitest.config.ts` con dos proyectos: `unit` (`tests/unit/**/*.test.ts`, entorno node) e `integration` (`tests/integration/**/*.test.ts`, `pool: 'forks'`, `fileParallelism: false`, `setupFiles: ['tests/integration/setup.ts']`, usa `DATABASE_URL_TEST`); alias `@/` → `src/` y mock de `server-only` en pruebas
- [X] T007 [P] Crear `playwright.config.ts` con `webServer` (`pnpm dev`), `baseURL` `http://localhost:3000` y proyectos `escritorio` (Desktop Chrome), `pixel7` (Pixel 7) e `iphone14` (iPhone 14); carpeta `tests/e2e/`
- [X] T008 [P] Configurar Tailwind CSS 4 y shadcn/ui: `src/app/globals.css`, `components.json`, e instalar en `src/components/ui/` los componentes `button`, `input`, `label`, `select`, `textarea`, `dialog`, `alert-dialog`, `table`, `badge`, `card`, `calendar`, `popover`, `sonner`, `tabs`, `dropdown-menu`; layout raíz `src/app/layout.tsx` con `lang="es-CO"`, `<Toaster />` y viewport móvil

---

## Phase 2: Foundational (Prerrequisitos bloqueantes)

**Purpose**: Esquema base, utilidades de tiempo, permisos, resultado, auditoría y sesión que usan todas las historias.

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta completar esta fase.

- [X] T009 Crear `prisma/schema.prisma` (generator `prisma-client` con `previewFeatures` necesarios para driver adapters, datasource `postgresql`) con todas las enumeraciones de [data-model.md](./data-model.md#enumeraciones) (`Rol`, `EstadoCita`, `ZonaCorporal`, `MedioPago`, `TipoMovimientoFinanciero`, `SubtipoIngreso`, `TipoMovimientoInventario`) y los modelos `Usuario`, `Sesion`, `Consultorio`, `Paciente`, `Cita`, `RegistroAuditoria` con exactamente los campos de data-model.md, tablas/columnas en `snake_case` vía `@@map`/`@map`, IDs `uuid` con `@default(dbgenerated("gen_random_uuid()")) @db.Uuid`, instantes `@db.Timestamptz`, fechas `@db.Date`. Reglas a respetar: `usuario.cedula` **único**, "solo dígitos, 5–15 caracteres"; `sesion.token_hash` **único**, `ON DELETE CASCADE` hacia usuario; `consultorio.nombre` **único**; `paciente.documento` **único**, "alfanumérico 4–20"; `cita.duracion_min` smallint; `registro_auditoria.id` `bigint identity`, `antes`/`despues` `jsonb?`. Índices de `cita`: `(consultorio_id, inicio)`, `(profesional_id, inicio)`, `(paciente_id, inicio)`, `(estado, inicio)`; índice `lower(nombre_completo)` en paciente
- [X] T010 Generar la migración `prisma/migrations/<timestamp>_base/migration.sql` con `pnpm prisma migrate dev --create-only --name base` y agregar a mano al final el SQL **[SQL]** de data-model.md: `CREATE EXTENSION IF NOT EXISTS btree_gist;` y `pg_trgm`; las tres restricciones `EXCLUDE` (`cita_sin_choque_consultorio`, `cita_sin_choque_profesional`, `cita_sin_choque_paciente`) con `WHERE (estado <> 'CANCELADA')`; `cita_duracion_valida`, `cita_en_horario` y `cita_cancelacion_completa` copiadas literalmente de data-model.md; `CHECK (rol <> 'RECEPCIONISTA' OR NOT atiende_pacientes)` en usuario; la función y el trigger `BEFORE UPDATE OR DELETE ON registro_auditoria` que hacen `RAISE EXCEPTION 'registro_auditoria es de solo inserción'`; luego ejecutar `pnpm prisma migrate dev`
- [X] T011 [P] Crear `src/server/db.ts`: exporta `prisma` (singleton en desarrollo vía `globalThis`) usando `PrismaNeon` cuando `DATABASE_URL` apunta a Neon (`neon.tech`) y `PrismaPg` en otro caso; exporta el tipo `Tx` (cliente de transacción)
- [X] T012 [P] Crear `src/lib/tiempo.ts`: constante `ZONA = 'America/Bogota'`; `hoyBogota(ahora?) → 'YYYY-MM-DD'`; `fechaBogota(instante) → 'YYYY-MM-DD'`; `esMismoDiaBogota(a, b)`; `instanteBogota(fecha, 'HH:MM') → Date`; `rangoDia(fecha)`, `rangoSemana(fecha)` (semana inicia **lunes**), `rangoMes(fecha)` → `{ desde: Date, hasta: Date }` semiabierto en UTC; `BLOQUES` = los 19 bloques `'07:30' … '16:30'` cada 30 min; `formatearFechaHora`, `formatearFecha`, `formatearHora` con `Intl.DateTimeFormat('es-CO', { timeZone: ZONA })`. Usar `TZDate` de `@date-fns/tz`; nunca la zona del proceso
- [X] T013 [P] Crear `src/lib/permisos.ts` como fuente única: tipo `Accion` con las claves `agenda:ver_todas`, `agenda:ver_propia`, `citas:gestionar` (crear/reprogramar/cancelar/marcar asistida), `citas:revertir_estado`, `citas:listar`, `pacientes:gestionar`, `pacientes:consultar_propios`, `atenciones:registrar`, `historial:ver_todos`, `historial:ver_propios`, `marcaciones:registrar`, `marcaciones:corregir`, `indicadores:ver_todos`, `indicadores:ver_propios`, `cobro:registrar`, `inventario:vender`, `inventario:gestionar` (catálogo y reposiciones), `movimientos:ver_propios_hoy`, `movimientos:anular_propios_hoy`, `movimientos:anular_todos`, `finanzas:ver`, `finanzas:egresos`, `finanzas:exportar`, `admin:usuarios`, `admin:consultorios`, `admin:auditoria`; `MATRIZ: Record<Rol, Set<Accion>>` que reproduce la **Matriz de permisos** de [spec.md](./spec.md) incluidas las filas aclaradas (cobro de terapia: D, R, P-sus citas; venta de insumos: D, R; anular cobro/venta: D siempre, R y P propios mismo día); función `puede(rol, accion): boolean`. El Dueño además tiene `marcaciones:registrar` y `agenda:ver_propia` (aplican solo cuando es el profesional de la cita, por la regla de T067; ver FR-028 y el supuesto "El Dueño también puede ser asignado como profesional")
- [X] T014 [P] Crear `src/lib/validacion/comunes.ts` con esquemas Zod: `cedula` (`/^\d{5,15}$/`), `password` (mín. 8), `documento` (alfanumérico 4–20, normaliza quitando puntos, guiones y espacios y pasa a mayúsculas), `fechaISO` (`YYYY-MM-DD`), `horaBloque` (`HH:MM` con minutos `00` o `30`), `dinero` (entero > 0), `motivo` (texto ≥ 5 caracteres, recortado), `uuid`
- [X] T015 [P] Crear `src/lib/dinero.ts` con `formatearCOP(valor)` (`Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })`)
- [X] T016 [P] Crear `src/lib/resultado.ts`: tipo `Resultado<T>` y `CodigoError` exactamente como en [server-actions.md](./contracts/server-actions.md) (`NO_AUTENTICADO`, `SIN_PERMISO`, `VALIDACION`, `NO_ENCONTRADO`, `CONFLICTO_CONSULTORIO`, `CONFLICTO_PROFESIONAL`, `CONFLICTO_PACIENTE`, `FUERA_DE_HORARIO`, `ESTADO_INVALIDO`, `STOCK_INSUFICIENTE`, `DUPLICADO`, `FUERA_DE_VENTANA`, `REQUIERE_CONFIRMACION`, `CREDENCIALES_INVALIDAS`, `ERROR_GOOGLE`); clase `ErrorDominio(codigo, mensaje, data?)`; helpers `ok(data)`, `fallo(codigo, mensaje, campos?)`; `traducirErrorBD(e)` que mapea Prisma `P2002` → `DUPLICADO`, SQLSTATE `23P01` según nombre de restricción → `CONFLICTO_CONSULTORIO` ("El consultorio ya está ocupado en ese horario") / `CONFLICTO_PROFESIONAL` ("El profesional no está disponible en ese horario") / `CONFLICTO_PACIENTE` ("El paciente ya tiene una cita en ese horario"), `23514` en `cita_en_horario` o `cita_duracion_valida` → `FUERA_DE_HORARIO`, `23514` en `stock` → `STOCK_INSUFICIENTE`; y `accion(fn)` que envuelve una Server Action: captura `ErrorDominio`, errores de Zod (→ `VALIDACION` con `campos`) y de BD, y siempre devuelve `Resultado<T>` sin filtrar detalles internos
- [X] T017 Crear `src/server/auditoria/auditar.ts`: `auditar(tx, { usuarioId, accion, entidad, entidadId, antes?, despues?, motivo? })` que inserta en `registro_auditoria` guardando en `antes`/`despues` **solo los campos que cambiaron**, sin incluir nunca `password_hash` ni `token_hash`
- [X] T018 Crear `src/server/auth/hash.ts` (Argon2id con `@node-rs/argon2`, `memoryCost: 19456`, `timeCost: 2`, `parallelism: 1`; `hashPassword`, `verificarPassword`, y `HASH_FICTICIO` precalculado para igualar tiempos) y `src/server/auth/sesion.ts`: cookie `sesion` (`HttpOnly; Secure` en producción; `SameSite=Lax; Path=/`), token aleatorio de 32 bytes, en BD solo SHA-256; `crearSesion(usuarioId)`, `obtenerSesion(ahora?)` que rechaza (y borra) sesiones con `ultima_actividad` > 30 min o `creada_en` > 12 h, o de usuarios inactivos, y renueva `ultima_actividad` como máximo una vez por minuto; tipo `Sesion = { id, usuarioId, rol, nombre, atiendePacientes, debeCambiarPassword }`; `exigirSesion()` (lanza `ErrorDominio('NO_AUTENTICADO')`), `exigirPermiso(sesion, accion)` (lanza `SIN_PERMISO` usando `puede` de T013), `borrarSesionesDeUsuario(tx, usuarioId, exceptoId?)`
- [X] T019 Crear `prisma/seed.ts`: crea (idempotente, `upsert`) "Consultorio 1", "Consultorio 2", "Consultorio 3" con `orden` 1–3, y el Dueño inicial pidiendo cédula, nombre y contraseña por consola (`node:readline`, sin valores por defecto en el código), con `debe_cambiar_password = false`; si ya existe un Dueño activo no pide nada
- [X] T020 Crear `tests/integration/setup.ts` y `tests/integration/helpers.ts`: antes de la suite aplica migraciones a `DATABASE_URL_TEST` (`prisma migrate reset --force --skip-seed`); antes de cada archivo hace `TRUNCATE … RESTART IDENTITY CASCADE` de todas las tablas (TRUNCATE no dispara el trigger de auditoría por fila); fábricas `crearUsuarioPrueba({ rol, atiendePacientes? })`, `crearConsultorioPrueba()`, `crearPacientePrueba()`, `crearCitaPrueba({ … })`, y `sesionDe(usuario)` que construye un objeto `Sesion` sin cookie para llamar servicios directamente
- [X] T021 [P] Crear `tests/unit/tiempo.test.ts`: `BLOQUES` tiene 19 elementos de `07:30` a `16:30`; `rangoSemana` empieza lunes 00:00 Bogotá (= 05:00 UTC); `hoyBogota` con `ahora = 2026-10-15T04:30:00Z` devuelve `2026-10-14`; `esMismoDiaBogota` en el corte de medianoche Bogotá

**Checkpoint**: Base lista; `pnpm prisma migrate dev`, `pnpm test` y `pnpm typecheck` en verde.

---

## Phase 3: User Story 1 - Acceso del personal con permisos por rol (Priority: P1) 🎯 MVP

**Goal**: Inicio de sesión por cédula y contraseña, sesión con expiración, bloqueo por intentos, y cada rol ve solo sus módulos.

**Independent Test**: Crear un usuario por rol, iniciar sesión con cada uno y verificar menús visibles, 403 al abrir rutas fuera del rol y redirección a `/login` sin sesión.

### Tests for User Story 1 ⚠️

- [X] T022 [P] [US1] Crear `tests/unit/permisos.test.ts`: prueba parametrizada rol × acción que compara `MATRIZ` contra una tabla esperada escrita a mano a partir de la Matriz de permisos de spec.md (incluye: Recepcionista sin `finanzas:ver`, `admin:*`, `atenciones:registrar`; Profesional sin `finanzas:ver`, `citas:gestionar`, `inventario:vender`; Profesional con `cobro:registrar`; Dueño con `marcaciones:registrar`, `marcaciones:corregir` y `agenda:ver_propia`)
- [X] T023 [P] [US1] Crear `tests/integration/auth.test.ts`: login correcto crea sesión; cédula inexistente, contraseña incorrecta, usuario inactivo y usuario bloqueado devuelven todos `CREDENCIALES_INVALIDAS` con el mismo mensaje "Cédula o contraseña incorrectas"; 5 fallos consecutivos fijan `bloqueado_hasta = ahora + 15 min` y el 6.º intento con la contraseña correcta falla; con `ahora` + 16 min vuelve a funcionar; un éxito reinicia `intentos_fallidos`; `obtenerSesion` con `ahora` 31 min después de la última actividad devuelve null
- [X] T024 [P] [US1] Crear `tests/e2e/acceso.spec.ts`: sin sesión, `/pacientes/<id>/historial` redirige a `/login?siguiente=…` sin mostrar datos; Recepcionista ve "Agenda" y "Pacientes" y no "Finanzas" ni "Administración", y `/finanzas` muestra "No tienes permiso para ver esta sección"; Profesional en `/finanzas` → 403

### Implementation for User Story 1

- [X] T025 [US1] Crear `src/server/auth/login.ts`: `iniciarSesion({ cedula, password }, ahora?)` que busca el usuario por cédula, verifica contra `HASH_FICTICIO` si no existe (igualar tiempos), rechaza inactivos y bloqueados (`bloqueado_hasta > ahora`), incrementa `intentos_fallidos` y al llegar a 5 fija `bloqueado_hasta = ahora + 15 min` y audita `SESION_BLOQUEO`; en éxito reinicia contadores, crea sesión, audita `SESION_INICIAR`; siempre el mismo error `CREDENCIALES_INVALIDAS`; `cerrarSesion()`; `cambiarPassword({ actual, nueva, confirmacion })` (nueva ≥ 8, igual a confirmación, pone `debe_cambiar_password=false` y borra las demás sesiones)
- [X] T026 [US1] Crear `src/app/(publico)/login/page.tsx` y `src/app/(publico)/login/acciones.ts`: formulario móvil (cédula con `inputMode="numeric"`, contraseña, botón "Ingresar"), muestra el mensaje genérico, y tras el éxito redirige a `siguiente` (solo rutas internas que empiezan por `/`) o a `/`
- [X] T027 [P] [US1] Crear `src/proxy.ts`: si la ruta no es `/login`, `/_next/*`, `/favicon.ico` ni `/api/google/oauth/callback` y no hay cookie `sesion`, redirige a `/login?siguiente=<ruta>`; no hace ninguna otra verificación (la autorización real es T018)
- [X] T028 [US1] Crear `src/server/auth/paginas.ts` con `paginaProtegida(accion?: Accion | Accion[])` para Server Components: obtiene la sesión (si no hay → `redirect('/login')`), si `debeCambiarPassword` → `redirect('/cambiar-password')`, si falta el permiso (basta uno de la lista) → `redirect('/prohibido')`; devuelve la sesión
- [X] T029 [US1] Crear `src/app/(app)/layout.tsx` y `src/components/navegacion/menu.tsx`: layout con sesión obligatoria (`paginaProtegida()`), encabezado con nombre y rol, botón "Cerrar sesión", y menú (hamburguesa en móvil) cuyos ítems se muestran según `puede(rol, …)`: Agenda, Mi día, Mi agenda, Citas, Pacientes, Indicadores, Insumos, Mis movimientos, Finanzas, Administración
- [X] T030 [P] [US1] Crear `src/app/(app)/prohibido/page.tsx` ("No tienes permiso para ver esta sección", con enlace al inicio) y `src/app/(app)/page.tsx` que redirige: Dueño y Recepcionista → `/agenda`, Profesional → `/mi-dia`
- [X] T031 [P] [US1] Crear `src/app/(app)/cambiar-password/page.tsx` y `acciones.ts` usando `cambiarPassword` de T025; accesible aunque `debeCambiarPassword` sea true (no usar `paginaProtegida` con redirección en esta ruta)
- [X] T032 [P] [US1] Crear `src/app/api/sesion/cerrar/route.ts` (`POST`: borra la fila de sesión y la cookie, redirige a `/login`)

**Checkpoint**: US1 funcional: login, bloqueo, expiración, menús por rol y 403. `pnpm test`, `pnpm test:integration -- auth` y `pnpm test:e2e -- acceso` en verde.

---

## Phase 4: User Story 2 - Registrar paciente y agendar cita sin colisiones (Priority: P1)

**Goal**: Grilla de 19 bloques por consultorio y fecha; crear citas con paciente nuevo o existente, sin choques de consultorio, profesional ni paciente aun con confirmaciones simultáneas.

**Independent Test**: Con dos sesiones a la vez, reservar el mismo bloque del mismo consultorio (o el mismo profesional en otro consultorio): solo una reserva se confirma y la otra recibe un error claro.

### Tests for User Story 2 ⚠️

- [X] T033 [P] [US2] Crear `tests/integration/citas-choques.test.ts`: dos `crearCita` simultáneas (`Promise.all`) mismo consultorio y hora → exactamente 1 éxito y 1 `CONFLICTO_CONSULTORIO` (SC-001); 09:00–10:00 vs 09:30–10:00 → rechazada; mismo profesional en consultorios distintos a la misma hora → `CONFLICTO_PROFESIONAL`; mismo paciente superpuesto → `CONFLICTO_PACIENTE`; cita CANCELADA (actualizar estado directo en BD) → nueva cita en el mismo bloque permitida; cita de 60 min a las 09:00 → `obtenerGrilla` marca 09:00 y 09:30 OCUPADO
- [X] T034 [P] [US2] Crear `tests/integration/citas-horario.test.ts`: 90 min a las 16:00, inicio 07:00 e inicio 09:15 → `FUERA_DE_HORARIO`; los mismos casos por `INSERT` SQL directo → error de la BD; cita con inicio anterior a `ahora` → guardada con `retroactiva = true`; consultorio inactivo o profesional no asignable → `VALIDACION`
- [X] T035 [P] [US2] Crear `tests/integration/pacientes.test.ts`: `crearPaciente` exige los 8 campos; documento repetido (también con puntos/espacios) → `DUPLICADO` devolviendo el paciente existente; `buscarPacientePorDocumento` devuelve los datos; Profesional en `buscarPacientes` solo ve pacientes con alguna cita suya

### Implementation for User Story 2

- [X] T036 [P] [US2] Crear `src/lib/departamentos.ts` con la lista de los 33 valores (32 departamentos + "Bogotá D.C.") y `src/lib/validacion/paciente.ts` (Zod): `documento` (de comunes), `nombreCompleto` obligatorio, `telefono` "7–15 dígitos", `fechaNacimiento` "≤ hoy (Bogotá)", `direccion`, `departamento` (de la lista), `ciudad`, `barrio` — todos obligatorios en el primer registro (FR-011)
- [X] T037 [P] [US2] Crear `src/lib/validacion/cita.ts` (Zod): `crearCitaSchema = { pacienteId, consultorioId, profesionalId, fecha, horaInicio: horaBloque, duracionMin: múltiplo de 30 entre 30 y 570, motivo: 1–500, zonaCorporal: ZonaCorporal }` con refinamiento: inicio ≥ 07:30 y fin ≤ 17:00 hora Bogotá → si no, error con código `FUERA_DE_HORARIO`
- [X] T038 [US2] Crear `src/server/pacientes/servicio.ts`: `buscarPacientePorDocumento(sesion, documento)` (D, R), `buscarPacientes(sesion, { q, pagina })` (por documento o `lower(nombre_completo)` con `ILIKE`; si Profesional, filtra con `EXISTS (cita con profesional_id = yo)`), `crearPaciente(sesion, datos)` (si `P2002` devuelve `DUPLICADO` con el paciente existente en `data`), `editarPaciente(sesion, { id, …campos })` (documento editable solo por Dueño), `obtenerPaciente(sesion, id)`; auditar `PACIENTE_CREAR`/`PACIENTE_EDITAR`
- [X] T039 [P] [US2] Crear `src/server/usuarios/profesionales.ts`: `listarProfesionalesAsignables()` = usuarios `activo AND atiende_pacientes`, ordenados por nombre; y `src/server/consultorios/consulta.ts`: `listarConsultoriosActivos()` ordenados por `orden`
- [X] T040 [US2] Crear `src/server/citas/crear.ts`: `crearCita(sesion, entrada, ahora?)` con permiso `citas:gestionar`; valida con T037, verifica consultorio activo y profesional asignable, calcula `inicio` con `instanteBogota`, `fin = inicio + duracionMin`, `retroactiva = inicio < ahora`, inserta en transacción, audita `CITA_CREAR`; los errores `23P01`/`23514` se traducen con `traducirErrorBD`. Nunca verifica disponibilidad solo en la aplicación: la restricción de BD es la autoridad
- [X] T041 [US2] Crear `src/server/citas/grilla.ts`: `obtenerGrilla(sesion, { consultorioId, fecha })` (permiso `agenda:ver_todas`) con una sola consulta de las citas no canceladas del consultorio en `rangoDia(fecha)` y genera los 19 bloques `{ hora, estado: 'DISPONIBLE' | 'OCUPADO', cita?: { id, paciente, profesional, estado, retroactiva } }` (un bloque está ocupado si `[bloque, bloque+30min)` se cruza con `[inicio, fin)`)
- [X] T042 [US2] Crear `src/components/agenda/grilla.tsx` y `src/app/(app)/agenda/page.tsx` (`paginaProtegida('agenda:ver_todas')`): selector de consultorio, calendario (shadcn `calendar`) y lista vertical de 19 bloques legible a 360 px; bloque Disponible enlaza a `/agenda/nueva?consultorio=&fecha=&hora=`; bloque Ocupado muestra paciente, profesional, estado y etiqueta "Retroactiva", y enlaza a `/citas/[id]`; parámetros `consultorio` y `fecha` en la URL (por defecto el primer consultorio y `hoyBogota()`)
- [X] T043 [US2] Crear `src/components/formularios/form-paciente.tsx` (reutilizable, los 8 campos con selector de departamento) y `src/components/formularios/form-cita.tsx`: paso 1 digitar documento → `buscarPacientePorDocumento`; si existe, muestra sus datos cargados (FR-012); si no, muestra `form-paciente` y lo registra antes de continuar; paso 2 motivo, zona corporal, profesional, consultorio, fecha, hora de inicio y duración (30, 60, 90, … hasta que no pase de 17:00); muestra los errores `CONFLICTO_*`/`FUERA_DE_HORARIO` con su mensaje y conserva lo digitado
- [X] T044 [US2] Crear `src/app/(app)/agenda/nueva/page.tsx` y `src/app/(app)/agenda/acciones.ts` (`buscarPacientePorDocumentoAccion`, `crearPacienteAccion`, `crearCitaAccion`, cada una con `accion()` de T016); al crear con éxito redirige a `/agenda?consultorio=&fecha=` con un aviso "Cita creada"
- [X] T045 [P] [US2] Crear `src/app/(app)/pacientes/page.tsx` (búsqueda `?q=` paginada), `src/app/(app)/pacientes/nuevo/page.tsx`, `src/app/(app)/pacientes/[id]/page.tsx` (ver y, para D/R, editar con `form-paciente`; Profesional solo lectura y solo sus pacientes) y `src/app/(app)/pacientes/acciones.ts`
- [X] T046 [US2] Crear `prisma/seed-demo.ts`: una Recepcionista, dos Profesionales (`atiende_pacientes=true`), 10 pacientes ficticios con datos colombianos plausibles y algunas citas de hoy y mañana; todas las contraseñas de demo `demo12345` (solo para entornos locales; el script se niega a correr si `DATABASE_URL` contiene `neon.tech` sin `--forzar`)

**Checkpoint**: US1 + US2 funcionales: se puede agendar sin choques desde escritorio y celular.

---

## Phase 5: User Story 3 - Control de estados de citas (Priority: P2)

**Goal**: Marcar Asistida o Cancelada (con motivo obligatorio), reprogramar, revertir (solo Dueño) y listar citas con filtros y conteos; agenda propia del Profesional.

**Independent Test**: Cancelar sin motivo (falla), cancelar con motivo (libera bloques), marcar asistida y verificar que los filtros devuelven las citas correctas con sus conteos.

### Tests for User Story 3 ⚠️

- [X] T047 [P] [US3] Crear `tests/integration/citas-estados.test.ts`: cancelar sin observación o con menos de 5 caracteres → `VALIDACION`; cancelar con observación → CANCELADA con `cancelada_por`/`cancelada_en` y el bloque queda DISPONIBLE en la grilla; cancelar o reprogramar una ASISTIDA → `ESTADO_INVALIDO`; reprogramar a un horario ocupado → `CONFLICTO_*`; `revertirEstadoCita` por Recepcionista → `SIN_PERMISO`; por Dueño de CANCELADA → PROGRAMADA re-valida choques; `listarCitas` con profesional + ASISTIDA + rango devuelve solo las que cumplen y `conteos` correctos; Profesional con `profesionalId` de otro → recibe solo las suyas

### Implementation for User Story 3

- [X] T048 [US3] Crear `src/server/citas/estados.ts`: `marcarAsistida(sesion, { id })` (PROGRAMADA → ASISTIDA), `cancelarCita(sesion, { id, observacion })` (solo PROGRAMADA; "observación obligatoria (≥ 5 caracteres)"; guarda `cancelada_por`, `cancelada_en`), `revertirEstadoCita(sesion, { id, motivo })` (permiso `citas:revertir_estado`; ASISTIDA/CANCELADA → PROGRAMADA; limpia campos de cancelación; la restricción `EXCLUDE` re-valida choques; deja un punto de extensión `validarReversion(tx, citaId)` que en esta fase no hace nada y que US4 y US8 completan); cada una bloquea la fila con `SELECT … FOR UPDATE` y audita `CITA_MARCAR_ASISTIDA`/`CITA_CANCELAR`/`CITA_REVERTIR_ESTADO` con antes/después y motivo
- [X] T049 [US3] Crear `src/server/citas/reprogramar.ts`: `reprogramarCita(sesion, { id, consultorioId?, profesionalId?, fecha?, horaInicio?, duracionMin? })` solo en PROGRAMADA (`ESTADO_INVALIDO`), mismas validaciones que `crearCita` (horario, consultorio activo, profesional asignable), recalcula `inicio`/`fin`, audita `CITA_REPROGRAMAR` con antes/después
- [X] T050 [US3] Crear `src/server/citas/listar.ts`: `listarCitas(sesion, { desde, hasta, consultorioId?, profesionalId?, estado?, pagina })` → `{ filas, total, conteos: { PROGRAMADA, ASISTIDA, CANCELADA } }` (conteos sobre todo el filtro, no la página; si Profesional, `profesionalId` forzado al suyo); `obtenerCita(sesion, id)` (Profesional solo las suyas → `SIN_PERMISO`); `obtenerMiAgenda(sesion, { fecha })` (citas propias en todos los consultorios, FR-023)
- [X] T051 [P] [US3] Crear `src/app/(app)/citas/page.tsx`: filtros (rango de fechas, consultorio, profesional, estado) en la URL, tabla/tarjetas responsive, conteos por estado y total
- [X] T052 [US3] Crear `src/app/(app)/citas/[id]/page.tsx` y `src/app/(app)/citas/[id]/acciones.ts`: detalle con paciente, profesional, consultorio, horario, motivo, zona, estado y etiqueta "Retroactiva"; botones según rol y estado: "Marcar asistida", "Cancelar" (diálogo con observación obligatoria), "Reprogramar", "Revertir a Programada" (solo Dueño, con motivo); muestra observación de cancelación y quién/cuándo
- [X] T053 [P] [US3] Crear `src/app/(app)/citas/[id]/reprogramar/page.tsx` reutilizando el paso 2 de `form-cita` con los valores actuales precargados
- [X] T054 [P] [US3] Crear `src/app/(app)/mi-agenda/page.tsx` (`paginaProtegida('agenda:ver_propia')`): selector de fecha y lista de citas propias de todos los consultorios ordenadas por hora

**Checkpoint**: US1–US3 funcionales.

---

## Phase 6: User Story 4 - Registro de atención e historial del paciente (Priority: P2)

**Goal**: El profesional registra la atención de una cita asistida; se edita solo el mismo día con versión anterior guardada; después solo notas aclaratorias; historial ordenado con gráfica de dolor por zona.

**Independent Test**: Registrar tres atenciones lumbares en fechas distintas con dolores diferentes y verificar el listado ordenado y la gráfica; editar una de hoy (se guarda la versión anterior) y comprobar que una de ayer solo admite nota aclaratoria.

### Tests for User Story 4 ⚠️

- [ ] T055 [P] [US4] Crear `tests/integration/atenciones.test.ts`: registrar en cita no ASISTIDA → `ESTADO_INVALIDO`; segunda atención para la misma cita → `DUPLICADO`; dolor 11 o -1 → `VALIDACION` y por SQL directo → error de BD; Profesional que no es el de la cita → `SIN_PERMISO`; `editarAtencion` el mismo día → éxito y `registro_auditoria` con `accion='ATENCION_EDITAR'` y `antes.dolor` anterior; con `ahora` = día siguiente (Bogotá) → `FUERA_DE_VENTANA`; con `creado_en` puesto a ayer por SQL, un `UPDATE atencion` directo → error de BD (trigger); `agregarNotaAclaratoria` funciona en cualquier día; `UPDATE`/`DELETE` sobre `nota_aclaratoria` → error de BD; `obtenerHistorial` de un Profesional sin citas con el paciente → `SIN_PERMISO`; Recepcionista sí lo ve; `revertirEstadoCita` de una cita con atención → `ESTADO_INVALIDO`

### Implementation for User Story 4

- [ ] T056 [US4] Agregar a `prisma/schema.prisma` los modelos `Atencion` (`cita_id` **único**, `paciente_id`, `profesional_id`, `fecha` timestamptz "= `cita.inicio`", `zona_corporal`, `motivo`, `tecnica` obligatorio, `dolor` smallint, `notas_evolucion` obligatorio, `creado_por`, `creado_en`, `actualizado_por?`, `actualizado_en?`; índice `(paciente_id, fecha)`) y `NotaAclaratoria` (`atencion_id`, `texto` "obligatorio, 5–2000", `creado_por`, `creado_en`); generar `prisma/migrations/<timestamp>_atenciones/migration.sql` con `--create-only` y añadir a mano: `CHECK (dolor BETWEEN 0 AND 10)`; función + trigger `BEFORE UPDATE ON atencion` que lanza excepción si `(now() AT TIME ZONE 'America/Bogota')::date <> (OLD.creado_en AT TIME ZONE 'America/Bogota')::date`; trigger `BEFORE DELETE ON atencion` que siempre lanza excepción; trigger `BEFORE UPDATE OR DELETE ON nota_aclaratoria` que siempre lanza excepción; aplicar con `prisma migrate dev`
- [ ] T057 [P] [US4] Crear `src/lib/validacion/atencion.ts` (Zod): `zonaCorporal`, `motivo` 1–500, `tecnica` 1–500, `dolor` "entero de 0 a 10", `notasEvolucion` 1–5000; `notaAclaratoria.texto` 5–2000
- [ ] T058 [US4] Crear `src/server/atenciones/servicio.ts`: `registrarAtencion(sesion, { citaId, … })` (permiso `atenciones:registrar`; la cita debe estar ASISTIDA; Profesional solo si `cita.profesional_id = yo`; copia `paciente_id`, `profesional_id` y `fecha = cita.inicio`; audita `ATENCION_CREAR`); `editarAtencion(sesion, { id, … }, ahora?)` (solo `creado_por` o Dueño; si `!esMismoDiaBogota(creado_en, ahora)` → `FUERA_DE_VENTANA` "La atención solo se puede editar el mismo día; agrega una nota aclaratoria"; audita `ATENCION_EDITAR` con antes/después); `agregarNotaAclaratoria(sesion, { atencionId, texto })` (autor o Dueño; audita `ATENCION_NOTA_AGREGAR`); `obtenerVersionesAtencion(sesion, atencionId)` (lee `registro_auditoria` con `entidad='atencion'`, misma regla de acceso que el historial)
- [ ] T059 [US4] Crear `src/server/atenciones/historial.ts`: `obtenerHistorial(sesion, { pacienteId }, ahora?)` con acceso D y R a todos y P solo si existe una `cita` (cualquier estado) suya con ese paciente (si no → `SIN_PERMISO`); devuelve `{ paciente, atenciones[] ordenadas por fecha desc con profesional, notasAclaratorias[] (orden cronológico), editada: boolean, editable: boolean (autor/Dueño y mismo día) }, serieDolor: { [zona]: { fecha, dolor }[] } ordenada asc }` en un máximo de 3 consultas
- [ ] T060 [US4] Completar `validarReversion` en `src/server/citas/estados.ts`: si la cita tiene atención → `ESTADO_INVALIDO` "La cita tiene una atención registrada"
- [ ] T061 [P] [US4] Crear `src/components/graficas/evolucion-dolor.tsx` (Client Component con Recharts): una línea por zona corporal con color y leyenda, eje Y fijo 0–10, eje X por fecha `es-CO`, contenedor responsive sin desplazamiento horizontal a 360 px, y una tabla accesible equivalente debajo
- [ ] T062 [US4] Crear `src/app/(app)/citas/[id]/atencion/page.tsx` y `acciones.ts`: si no hay atención, formulario con zona y motivo precargados de la cita, técnica, dolor (selector 0–10 grande, apto para táctil) y notas; si existe y es `editable`, el mismo formulario en modo edición; si no es editable, la atención en solo lectura y un formulario "Agregar nota aclaratoria"; lista de notas existentes
- [ ] T063 [US4] Crear `src/app/(app)/pacientes/[id]/historial/page.tsx`: datos básicos del paciente, gráfica `evolucion-dolor`, y lista de atenciones (fecha, profesional, zona, motivo, técnica, dolor, notas) con distintivo "Editada" que abre un diálogo de versiones (`obtenerVersionesAtencion`) y las notas aclaratorias debajo de cada atención; enlace al historial desde `/pacientes/[id]` y `/citas/[id]`

**Checkpoint**: US1–US4 funcionales.

---

## Phase 7: User Story 5 - Marcación de tiempos e indicadores de atención (Priority: P2)

**Goal**: El profesional marca llegada → ingreso → fin con un toque desde el celular; el Dueño (y el Profesional para lo propio) ve espera, duración, puntualidad y conteos por periodo.

**Independent Test**: Marcar los tres tiempos en varias citas y verificar que los indicadores coinciden con cálculos manuales (ejemplo 08:00 / 07:55 / 08:10 / 08:40 → espera 15, duración 30, retraso 10).

### Tests for User Story 5 ⚠️

- [ ] T064 [P] [US5] Crear `tests/integration/marcaciones.test.ts`: `marcarIngreso` sin llegada y `marcarFin` sin ingreso → `ESTADO_INVALIDO`; segunda llegada → `ESTADO_INVALIDO`; Profesional no asignado → `SIN_PERMISO`; cita de otro día o CANCELADA → `ESTADO_INVALIDO`; `marcarIngreso` en cita PROGRAMADA la deja ASISTIDA en la misma transacción; `corregirMarcacion` por Dueño respeta el orden y audita antes/después con motivo; por Profesional → `SIN_PERMISO`
- [ ] T065 [P] [US5] Crear `tests/unit/indicadores.test.ts` para la función pura de cálculo y `tests/integration/indicadores.test.ts`: ejemplo de US5-3 → espera 15, duración 30, retraso 10, no a tiempo; "a tiempo" = ingreso ≤ programada + 5 min; citas sin llegada se excluyen de espera (y `muestras.espera` lo refleja); filtro SEMANA + consultorio considera solo esas citas; Profesional recibe solo sus indicadores aunque envíe otro `profesionalId`

### Implementation for User Story 5

- [ ] T066 [US5] Agregar a `prisma/schema.prisma` el modelo `Marcacion` (`cita_id` uuid PK y FK 1 a 1, `llegada_en?`/`llegada_por?`, `ingreso_en?`/`ingreso_por?`, `fin_en?`/`fin_por?`) y generar `prisma/migrations/<timestamp>_marcaciones/migration.sql` añadiendo a mano `CHECK ((ingreso_en IS NULL OR llegada_en IS NOT NULL) AND (fin_en IS NULL OR ingreso_en IS NOT NULL) AND (ingreso_en IS NULL OR ingreso_en >= llegada_en) AND (fin_en IS NULL OR fin_en >= ingreso_en))`
- [ ] T067 [US5] Crear `src/server/marcaciones/servicio.ts`: `marcarLlegada`, `marcarIngreso`, `marcarFin` (`sesion, { citaId }`): solo el profesional asignado (`cita.profesional_id = yo`), solo citas de hoy (Bogotá) no canceladas, hora = `now()` del servidor, cada marca una sola vez, orden obligatorio; `marcarIngreso` cambia PROGRAMADA → ASISTIDA en la misma transacción (FR-029); devuelven `{ marcacion, siguiente: 'LLEGADA' | 'INGRESO' | 'FIN' | null }`; `corregirMarcacion(sesion, { citaId, llegadaEn?, ingresoEn?, finEn?, motivo })` solo Dueño, respetando el orden, auditando `MARCACION_CORREGIR` con antes/después (FR-030); auditar `MARCACION_REGISTRAR` en las marcas normales
- [ ] T068 [US5] Crear `src/server/indicadores/calculo.ts` (funciones puras: espera = ingreso − llegada, duración = fin − ingreso, retraso = ingreso − inicio programado, a tiempo si retraso ≤ 5 min; promedios en minutos redondeados a 1 decimal) y `src/server/indicadores/consulta.ts`: `obtenerIndicadores(sesion, { periodo: 'DIA'|'SEMANA'|'MES', fecha, profesionalId?, consultorioId? })` con una consulta `$queryRaw` tipada sobre `cita` LEFT JOIN `marcacion` en el rango Bogotá; devuelve exactamente la forma de [server-actions.md](./contracts/server-actions.md#indicadores-us5) incluyendo `muestras`; Profesional forzado a sí mismo
- [ ] T069 [US5] Crear `src/components/agenda/botones-marcacion.tsx` (Client Component con `useOptimistic`): un solo botón grande (≥ 48 px de alto, ancho completo en móvil) con la siguiente marca disponible ("Llegada", "Ingreso a terapia", "Fin de terapia"), las horas ya marcadas debajo, y reversión con mensaje si el servidor rechaza
- [ ] T070 [US5] Crear `src/app/(app)/mi-dia/page.tsx` y `acciones.ts` (`paginaProtegida('marcaciones:registrar')`): citas de hoy del profesional en sesión (todos los consultorios) ordenadas por hora, cada una con paciente, consultorio, hora, motivo, `botones-marcacion` y enlace a registrar atención cuando la cita quede ASISTIDA
- [ ] T071 [P] [US5] Agregar a `src/app/(app)/citas/[id]/page.tsx` la sección "Tiempos" (llegada, ingreso, fin) y, para el Dueño, un diálogo "Corregir marcación" con campos de hora y motivo obligatorio que llama a `corregirMarcacion`
- [ ] T072 [US5] Crear `src/app/(app)/indicadores/page.tsx` (`paginaProtegida(['indicadores:ver_todos','indicadores:ver_propios'])`): filtros periodo/fecha/profesional/consultorio en la URL (filtro de profesional oculto y fijo para el Profesional), tarjetas con espera promedio, duración real promedio, retraso promedio, % a tiempo y conteos programadas/asistidas/canceladas, y nota "basado en N citas" por indicador

**Checkpoint**: US1–US5 funcionales.

---

## Phase 8: User Story 6 - Administración de usuarios y consultorios (Priority: P2)

**Goal**: El Dueño crea, edita, desactiva y reactiva usuarios y consultorios, restablece contraseñas y consulta la auditoría.

**Independent Test**: Crear un cuarto consultorio y verificar que aparece en la agenda; desactivarlo y verificar que no admite nuevas citas; crear un usuario con cédula repetida (rechazado).

### Tests for User Story 6 ⚠️

- [ ] T073 [P] [US6] Crear `tests/integration/admin.test.ts`: `crearUsuario` con cédula existente → `DUPLICADO`; el nuevo usuario inicia sesión con su rol y `debe_cambiar_password=true`; Recepcionista con `atiendePacientes=true` → `VALIDACION`; desactivar al último Dueño activo o cambiarle el rol → `VALIDACION`; desactivar un Profesional o un consultorio con citas futuras PROGRAMADAS sin `confirmar` → `REQUIERE_CONFIRMACION` con la lista de citas, y con `confirmar=true` se desactiva conservando las citas; desactivar o restablecer contraseña borra las sesiones del usuario; consultorio inactivo no aparece en `listarConsultoriosActivos` y `crearCita` en él → `VALIDACION`; Recepcionista en cualquier acción de admin → `SIN_PERMISO`

### Implementation for User Story 6

- [ ] T074 [P] [US6] Crear `src/lib/validacion/admin.ts` (Zod): `crearUsuario = { cedula, nombreCompleto: 3–120, rol, atiendePacientes?, passwordInicial: ≥ 8 }`, `editarUsuario`, `consultorio = { nombre obligatorio, orden? }`
- [ ] T075 [US6] Crear `src/server/usuarios/servicio.ts`: `listarUsuarios`, `crearUsuario` (`atiende_pacientes` por defecto `true` si PROFESIONAL, siempre `false` si RECEPCIONISTA; hash; `debe_cambiar_password=true`), `editarUsuario` (no puede dejar el sistema sin Dueño activo), `cambiarEstadoUsuario(sesion, { id, activo, confirmar? })` (advierte con `REQUIERE_CONFIRMACION` y `data: citasPendientes[]` si tiene citas futuras PROGRAMADAS; al desactivar borra sus sesiones), `restablecerPassword(sesion, { id, passwordNueva })` (borra sesiones, `debe_cambiar_password=true`, reinicia bloqueo); permiso `admin:usuarios`; auditar `USUARIO_*` sin incluir hashes
- [ ] T076 [US6] Crear `src/server/consultorios/servicio.ts`: `listarConsultorios`, `crearConsultorio`, `editarConsultorio` (`DUPLICADO` por nombre), `cambiarEstadoConsultorio(sesion, { id, activo, confirmar? })` con la misma advertencia de citas futuras; permiso `admin:consultorios`; auditar `CONSULTORIO_*`
- [ ] T077 [P] [US6] Crear `src/app/(app)/admin/usuarios/page.tsx`, `src/app/(app)/admin/usuarios/[id]/page.tsx` y `src/app/(app)/admin/usuarios/acciones.ts`: lista con rol y estado; crear/editar; activar/desactivar con diálogo que muestra las citas pendientes cuando llega `REQUIERE_CONFIRMACION`; restablecer contraseña
- [ ] T078 [P] [US6] Crear `src/app/(app)/admin/consultorios/page.tsx` y `acciones.ts`: lista, crear, renombrar, ordenar, activar/desactivar con la misma confirmación de citas pendientes
- [ ] T079 [US6] Crear `src/server/auditoria/consulta.ts` (`consultarAuditoria(sesion, { desde, hasta, usuarioId?, accion?, entidad?, pagina })`, permiso `admin:auditoria`) y `src/app/(app)/admin/auditoria/page.tsx`: tabla de solo lectura paginada con quién, acción, entidad, cuándo, motivo y un detalle desplegable de antes/después

**Checkpoint**: US1–US6 funcionales.

---

## Phase 9: User Story 7 - Insumos e inventario (Priority: P3)

**Goal**: Catálogo de insumos con stock mínimo; ventas (Dueño y Recepcionista) que descuentan stock y generan ingreso; reposiciones (Dueño) que generan egreso; anulación por el autor el mismo día o por el Dueño; "Mis movimientos de hoy".

**Independent Test**: Registrar una venta y una reposición y verificar stock resultante, movimientos financieros generados y alerta de stock bajo; la Recepcionista anula su venta de hoy pero no una de ayer.

### Tests for User Story 7 ⚠️

- [ ] T080 [P] [US7] Crear `tests/integration/inventario.test.ts`: stock 10 → venta 3 → stock 7 y un `movimiento_financiero` INGRESO/VENTA_INSUMOS por `3 × precio_venta` con su medio de pago; venta de 8 con stock 2 → `STOCK_INSUFICIENTE` y nada cambia; reposición 20 → stock +20 y EGRESO en categoría `COMPRA_INSUMOS`; `crearInsumo` con stock inicial 5 crea `AJUSTE_INICIAL` sin financiero; invariante SC-007 tras 50 operaciones aleatorias (ventas, reposiciones, anulaciones): `stock = Σ(AJUSTE_INICIAL + REPOSICION) − Σ(VENTA)` de no anulados y cada VENTA/REPOSICION con exactamente un financiero; anulación: Recepcionista anula su venta el mismo día → stock repuesto y financiero anulado; con `ahora` = día siguiente → `FUERA_DE_VENTANA`; Dueño anula ambas; Recepcionista anula venta de otro usuario → `SIN_PERMISO`; Recepcionista anula reposición → `SIN_PERMISO`; Profesional `registrarVenta` → `SIN_PERMISO`; `listarMisMovimientosHoy` devuelve solo los propios de hoy y no incluye totales
- [ ] T081 [P] [US7] Crear `tests/unit/anulacion.test.ts` para `puedeAnular`: Dueño siempre; autor a las 23:59 Bogotá del mismo día → sí; autor a las 00:00 del día siguiente → no; no autor (R o P) → no

### Implementation for User Story 7

- [ ] T082 [US7] Agregar a `prisma/schema.prisma` los modelos `Insumo` (`nombre` "**único** (sin distinguir mayúsculas)", `costo` "≥ 0 (COP)", `precio_venta` "≥ 0 (COP)", `stock` int, `stock_minimo` "≥ 0", `activo`), `MovimientoInventario` (`insumo_id`, `tipo`, `cantidad` "> 0", `valor_unitario`, `fecha` date, `anulado` default false, `anulado_por?`, `anulado_en?`, `motivo_anulacion?`, `creado_por`, `creado_en`), `CategoriaEgreso` (`clave` **único**, `nombre`, `activo`) y `MovimientoFinanciero` (campos de [data-model.md](./data-model.md#movimientofinanciero-movimiento_financiero) incluido `movimiento_inventario_id` **único** opcional y `cita_id` opcional; índices `(fecha)`, `(tipo, fecha)`, `(medio_pago, fecha)`, `(cita_id)`, `(creado_por, creado_en)`); generar `prisma/migrations/<timestamp>_inventario_finanzas/migration.sql` y añadir a mano: `CHECK (stock >= 0)` (nombre `insumo_stock_no_negativo`), `CHECK (costo >= 0 AND precio_venta >= 0 AND stock_minimo >= 0)`, `CHECK (cantidad > 0)`, `CHECK (valor > 0)`, índice único `lower(nombre)` en insumo, `CHECK` de coherencia (`tipo='INGRESO'` ⇒ `subtipo_ingreso IS NOT NULL AND categoria_egreso_id IS NULL`; `tipo='EGRESO'` ⇒ `subtipo_ingreso IS NULL AND categoria_egreso_id IS NOT NULL`; `subtipo_ingreso='TERAPIA'` ⇒ `cita_id IS NOT NULL`; `subtipo_ingreso='VENTA_INSUMOS'` ⇒ `movimiento_inventario_id IS NOT NULL`), y en ambas tablas de movimientos `CHECK (NOT anulado OR (anulado_por IS NOT NULL AND anulado_en IS NOT NULL AND motivo_anulacion IS NOT NULL))`. **No** crear índice único de cobro por cita (se permiten abonos)
- [ ] T083 [US7] Ampliar `prisma/seed.ts` para crear (idempotente) las categorías de egreso `ARRIENDO` "Arriendo", `SERVICIOS_PUBLICOS` "Servicios públicos", `COMPRA_INSUMOS` "Compra de insumos", `NOMINA` "Nómina", `MANTENIMIENTO` "Mantenimiento", `OTROS` "Otros"; ampliar `prisma/seed-demo.ts` con 5 insumos (uno bajo el mínimo)
- [ ] T084 [P] [US7] Crear `src/lib/validacion/inventario.ts` (Zod): `crearInsumo = { nombre, costo ≥ 0, precioVenta ≥ 0, stockInicial ≥ 0, stockMinimo ≥ 0 }`, `editarInsumo` (sin stock), `venta = { insumoId, cantidad > 0, medioPago, fecha? }`, `reposicion = { insumoId, cantidad > 0, costoUnitario ≥ 0, medioPago, fecha? }`, `anulacion = { id, motivo (≥ 5) }`
- [ ] T085 [US7] Crear `src/server/finanzas/anulacion.ts`: función pura `puedeAnular(sesion, mov: { creadoPor, creadoEn, tipo, subtipoIngreso }, ahora)` = Dueño, o (`subtipoIngreso` ∈ {TERAPIA, VENTA_INSUMOS} y `creadoPor = sesion.usuarioId` y `esMismoDiaBogota(creadoEn, ahora)`); egresos y reposiciones solo Dueño; y `anularFinancieroEnTx(tx, sesion, id, motivo, ahora)` que bloquea con `SELECT … FOR UPDATE`, re-evalúa `puedeAnular` (no autor → `SIN_PERMISO`; autor fuera del día → `FUERA_DE_VENTANA` "Solo puedes anular movimientos registrados hoy. Solicítalo al Dueño"), rechaza si ya está anulado (`ESTADO_INVALIDO`), marca `anulado_*` y audita `MOVIMIENTO_ANULAR` con motivo
- [ ] T086 [US7] Crear `src/server/inventario/servicio.ts`: `listarInsumos(sesion)` (D: todos; R: activos, para vender) con `bajoMinimo = stock < stock_minimo`; `crearInsumo` (crea `AJUSTE_INICIAL` si stock inicial > 0); `editarInsumo` (el stock **no** se edita directamente); `registrarVenta(sesion, { insumoId, cantidad, medioPago, fecha? })` (permiso `inventario:vender`; transacción: `SELECT … FOR UPDATE` del insumo, `STOCK_INSUFICIENTE` si no alcanza, `UPDATE insumo SET stock = stock - n`, movimiento VENTA con `valor_unitario = precio_venta`, financiero INGRESO/VENTA_INSUMOS por `cantidad × precio_venta`, descripción "Venta de N × <insumo>"); `registrarReposicion` (permiso `inventario:gestionar`; movimiento REPOSICION + EGRESO categoría `COMPRA_INSUMOS` por `cantidad × costoUnitario`); `anularMovimientoInventario(sesion, { id, motivo }, ahora?)` (aplica `puedeAnular` sobre el financiero enlazado, revierte stock — falla con `STOCK_INSUFICIENTE` si quedaría negativo — y anula ambos movimientos en una transacción); `listarMovimientosInsumo(sesion, insumoId)` (solo Dueño); auditar `INVENTARIO_VENTA`, `INVENTARIO_REPOSICION`, `INSUMO_*`
- [ ] T087 [US7] Crear `src/server/finanzas/mis-movimientos.ts`: `listarMisMovimientosHoy(sesion, ahora?)` (permiso `movimientos:ver_propios_hoy`): `movimiento_financiero` con `creado_por = yo` y `creado_en` en `rangoDia(hoyBogota(ahora))`, devolviendo `{ id, tipo, subtipo, descripcion, valor, medioPago, anulado, anulable }[]` **sin totales** (FR-041); y `anularMiMovimiento(sesion, { id, motivo })` que despacha a `anularMovimientoInventario` si el financiero tiene `movimiento_inventario_id`, o a `anularFinancieroEnTx` en otro caso
- [ ] T088 [P] [US7] Crear `src/app/(app)/insumos/page.tsx`: lista con nombre, precio, stock, mínimo y distintivo "Stock bajo" (color + texto, no solo color) cuando `stock < stock_minimo`; D ve botones de crear/editar/reponer; R ve solo el botón "Vender"
- [ ] T089 [P] [US7] Crear `src/app/(app)/insumos/nuevo/page.tsx`, `src/app/(app)/insumos/[id]/page.tsx` (editar, activar/desactivar, historial de movimientos con opción "Anular" y motivo) y `src/app/(app)/insumos/[id]/reponer/page.tsx` con `src/app/(app)/insumos/acciones.ts` (solo Dueño)
- [ ] T090 [US7] Crear `src/app/(app)/insumos/venta/page.tsx` (D, R): selector de insumo activo con stock disponible, cantidad, medio de pago, total calculado en pantalla con `formatearCOP`; tras guardar muestra solo la confirmación y un enlace a "Mis movimientos"
- [ ] T091 [US7] Crear `src/app/(app)/mis-movimientos/page.tsx` y `acciones.ts` (`paginaProtegida('movimientos:ver_propios_hoy')`; el Dueño es redirigido a `/finanzas`): lista de los movimientos que registré hoy con estado y botón "Anular" (diálogo con motivo obligatorio) cuando `anulable`; sin totales ni sumas

**Checkpoint**: US1–US7 funcionales.

---

## Phase 10: User Story 8 - Registro financiero y exportación (Priority: P3)

**Goal**: Cobros de terapia con abonos (Dueño, Recepcionista y Profesional en sus citas), egresos, historial con filtros y totales solo para el Dueño, y exportación a Google Sheets idéntica a la pantalla.

**Independent Test**: Registrar ingresos y egresos variados, aplicar filtros, verificar totales y exportar a Google Sheets comparando filas y totales.

### Tests for User Story 8 ⚠️

- [ ] T092 [P] [US8] Crear `tests/integration/finanzas.test.ts`: cobro en cita no ASISTIDA → `ESTADO_INVALIDO`; dos cobros en la misma cita (efectivo + transferencia) → ambos vigentes y `obtenerCobrosCita.sumaVigente` = suma; Profesional cobra su cita → éxito; cita de otro profesional → `SIN_PERMISO`; Recepcionista y Profesional en `consultarFinanzas`, `registrarEgreso` o `exportarFinanzasAGoogle` → `SIN_PERMISO`; anular cobro propio mismo día → éxito, día siguiente → `FUERA_DE_VENTANA`, Dueño → éxito siempre; egreso sin categoría, fecha, valor o descripción → `VALIDACION`; `consultarFinanzas` con rango + `TRANSFERENCIA` devuelve solo esas filas y totales de ingresos, egresos y balance calculados sobre **todas** las filas filtradas (con más filas que una página); anulados excluidos por defecto; `revertirEstadoCita` con cobro vigente → `ESTADO_INVALIDO`
- [ ] T093 [P] [US8] Crear `tests/integration/exportacion-google.test.ts` con un cliente de Sheets simulado inyectado: las filas enviadas (desde la fila 4) y los tres totales (filas n+2 a n+4) coinciden exactamente con `consultarFinanzas(filtro)` sin paginar; egresos con valor negativo; filtro sin resultados → solo encabezados y totales en 0; error del cliente → `ERROR_GOOGLE` y ninguna tabla de datos modificada; `invalid_grant` → borra `conexion_google` y devuelve el mensaje de reconexión; sin conexión → `ERROR_GOOGLE` "Conecta tu cuenta de Google para exportar"

### Implementation for User Story 8

- [ ] T094 [US8] Agregar a `prisma/schema.prisma` el modelo `ConexionGoogle` (`usuario_id` uuid PK FK, `email_google`, `refresh_token_cifrado`, `conectado_en`) y generar la migración `prisma/migrations/<timestamp>_conexion_google/migration.sql`
- [ ] T095 [P] [US8] Crear `src/lib/validacion/finanzas.ts` (Zod): `cobro = { citaId, valor: dinero, medioPago, fecha? }`, `egreso = { categoriaId, fecha, valor: dinero, medioPago, descripcion: 3–300 }` (todos obligatorios), `FiltroFinanzas = { desde, hasta, tipo?, subtipoIngreso?, categoriaId?, medioPago?, incluirAnulados?: boolean = false }`
- [ ] T096 [US8] Crear `src/server/finanzas/cobros.ts`: `obtenerCobrosCita(sesion, { citaId })` → `{ cobros: { id, valor, medioPago, fecha, anulado }[], sumaVigente }` (mismo acceso que registrar); `registrarCobroTerapia(sesion, { citaId, valor, medioPago, fecha? })` (permiso `cobro:registrar`; la cita debe estar ASISTIDA; Profesional solo si `cita.profesional_id = yo` dentro de la consulta; admite varios cobros por cita; descripción "Terapia – <paciente> – <fecha cita>"; audita `COBRO_CREAR`; devuelve solo la confirmación a R/P)
- [ ] T097 [US8] Crear `src/server/finanzas/egresos.ts` (`registrarEgreso`, permiso `finanzas:egresos`, audita `EGRESO_CREAR`; `listarCategoriasEgreso`) y `src/server/finanzas/anular.ts` con `anularMovimientoFinanciero(sesion, { id, motivo }, ahora?)` (si tiene `movimiento_inventario_id` delega a `anularMovimientoInventario`; si no, `anularFinancieroEnTx`)
- [ ] T098 [US8] Crear `src/server/finanzas/consulta.ts`: `consultarFinanzas(sesion, filtro, { paginar?: { pagina, tamano } })` (permiso `finanzas:ver`) que devuelve `{ filas[], totales: { ingresos, egresos, balance } }` con filas que incluyen fecha, tipo, subtipo/categoría, descripción, medio de pago, valor, paciente/insumo, registrado por e id, ordenadas por fecha desc; totales con `SUM` en `bigint` sobre **todo** el filtro, no solo la página. Es la única fuente de datos para la pantalla y la exportación (SC-008)
- [ ] T099 [US8] Completar `validarReversion` en `src/server/citas/estados.ts`: si la cita tiene algún cobro de terapia no anulado → `ESTADO_INVALIDO` "La cita tiene cobros registrados"
- [ ] T100 [P] [US8] Crear `src/server/google/cifrado.ts`: `cifrar(texto)` / `descifrar(texto)` con AES-256-GCM usando `GOOGLE_TOKEN_KEY` (32 bytes base64), IV aleatorio de 12 bytes, formato `iv.tag.datos` en base64url
- [ ] T101 [US8] Crear `src/server/google/oauth.ts` y las rutas `src/app/api/google/oauth/iniciar/route.ts` y `src/app/api/google/oauth/callback/route.ts` según [exportacion-google-sheets.md](./contracts/exportacion-google-sheets.md#conexión-una-vez): solo Dueño; `state` aleatorio en cookie firmada de 10 min; scopes `https://www.googleapis.com/auth/drive.file openid email`, `access_type=offline`, `prompt=consent`, `redirect_uri={APP_URL}/api/google/oauth/callback`; el callback valida `state` y sesión de Dueño, intercambia el `code`, guarda el refresh token cifrado y el email, audita `GOOGLE_CONECTAR` y redirige a `/finanzas/google`; `desconectarGoogle(sesion)` revoca el token y borra la fila
- [ ] T102 [US8] Crear `src/server/google/sheets.ts` (interfaz `ClienteSheets { crearHoja(titulo), escribirValores(id, rangos) }` con implementación real sobre `googleapis` y posibilidad de inyectar un falso) y `src/server/google/exportar.ts`: `exportarFinanzasAGoogle(sesion, filtro, cliente?)` que llama a `consultarFinanzas` sin paginar, crea la hoja con título `Finanzas Consultorio {desde} a {hasta} – exportado {YYYY-MM-DD HH:mm}` (hora Bogotá) y escribe con `USER_ENTERED`: fila 1 "Filtros:" + descripción, fila 3 encabezados `Fecha`, `Tipo`, `Subtipo / Categoría`, `Descripción`, `Medio de pago`, `Valor (COP)`, `Paciente / Insumo`, `Registrado por`, `ID`, filas 4…n (egresos negativos), y `Total ingresos`, `Total egresos`, `Balance` en n+2…n+4 como números calculados en el servidor; reintenta 1 vez con backoff en errores de red/5xx; mapea errores según la tabla del contrato; audita `FINANZAS_EXPORTAR` con filtros y número de filas; devuelve `{ urlHoja }`
- [ ] T103 [US8] Crear `src/app/(app)/citas/[id]/cobro/page.tsx` y `acciones.ts` (`paginaProtegida('cobro:registrar')`; Profesional solo sus citas): muestra los cobros previos de la cita y su suma antes del formulario (valor, medio de pago, fecha opcional) para evitar dobles registros; tras guardar, confirmación y enlace a "Mis movimientos" (R/P) o a `/finanzas` (D); enlace "Registrar cobro" en `/citas/[id]` y en `/mi-dia` para citas ASISTIDA
- [ ] T104 [US8] Crear `src/app/(app)/finanzas/page.tsx` y `acciones.ts` (`paginaProtegida('finanzas:ver')`): filtros en la URL (rango, tipo, subtipo, categoría, medio de pago, incluir anulados), tarjetas de totales (ingresos, egresos, balance), tabla paginada con acción "Anular" (motivo obligatorio), botón "Exportar a Google Sheets" que envía el mismo filtro y muestra el enlace "Abrir hoja" o el error; quitar `test.fixme` de las dos pruebas de finanzas en `tests/e2e/acceso.spec.ts`
- [ ] T105 [P] [US8] Crear `src/app/(app)/finanzas/egresos/nuevo/page.tsx` (categoría desplegable de la lista, fecha, valor, medio de pago, descripción — todos obligatorios) y `src/app/(app)/finanzas/google/page.tsx` (estado "Conectado como <email>" o botón "Conectar cuenta de Google"; botón "Desconectar")

**Checkpoint**: Todas las historias funcionales.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Respaldos, seguridad, rendimiento, móvil y validación final.

- [ ] T106 [P] Crear `.github/workflows/respaldo-diario.yml` (FR-044a): `schedule: cron '0 8 * * *'` (03:00 Bogotá) y `workflow_dispatch`; instala `postgresql-client-16` y `age`; ejecuta `pg_dump --format=custom --no-owner "$DIRECT_URL"`, cifra con `age -r "$AGE_PUBLIC_KEY"`, y sube a un bucket S3-compatible (`aws s3 cp --endpoint-url "$S3_ENDPOINT"`) como `respaldos/consultorio-YYYY-MM-DD.dump.age`; secretos `DIRECT_URL`, `AGE_PUBLIC_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`; el job falla (y GitHub notifica) si cualquier paso falla; nunca imprime datos en el log
- [ ] T107 [P] Crear `docs/respaldos.md`: requisitos (plan de pago de Neon con ventana de restauración ≥ 7 días; regla de ciclo de vida del bucket que borra objetos de más de 30 días; dónde guardar la clave privada `age` en dos lugares fuera del sistema), procedimiento de restauración PITR (rama de Neon a un instante) y de restauración del dump (`age -d` + `pg_restore`), y el simulacro de [quickstart.md](./quickstart.md#simulacro-de-restauración-sc-011--obligatorio-antes-de-producción)
- [ ] T108 [P] Agregar cabeceras de seguridad en `next.config.ts` (`Content-Security-Policy` restrictiva compatible con Next.js, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` mínima)
- [ ] T109 Crear `tests/integration/matriz-permisos.test.ts` (SC-005): para cada servicio expuesto en [server-actions.md](./contracts/server-actions.md) y cada rol sin ese permiso, llamarlo con `sesionDe(rol)` y comprobar `SIN_PERMISO` sin efectos en BD; para el Profesional, verificar además el filtro "solo propias" en citas, pacientes, historial, indicadores, cobros y marcaciones
- [ ] T116 Crear `tests/integration/auditoria-cobertura.test.ts` (SC-006): para cada servicio de mutación (citas, marcaciones, atenciones, notas, inventario, cobros, egresos, anulaciones, usuarios, consultorios, pacientes) ejecutar una llamada válida y comprobar que se insertó exactamente una fila nueva en `registro_auditoria` con `usuario_id`, `accion`, `entidad_id` y `creado_en` no nulos, y que un fallo de validación no deja ninguna fila
- [ ] T110 [P] Crear `tests/e2e/movil.spec.ts` (SC-010, proyectos `pixel7` e `iphone14` y viewport de 360 px): en login, agenda, crear cita, mi-día, atención y cobro comprobar `document.documentElement.scrollWidth <= window.innerWidth`; en mi-día completar Llegada → Ingreso → Fin con un toque cada uno y medir < 5 s por marca (SC-004)
- [ ] T111 [P] Crear `tests/e2e/flujo-principal.spec.ts`: Recepcionista agenda a paciente nuevo y existente; dos contextos de navegador confirman la misma cita casi a la vez y solo uno tiene éxito con el mensaje "El consultorio ya está ocupado en ese horario"; Profesional marca tiempos y registra atención; Recepcionista registra un abono y lo anula en "Mis movimientos"; medir con `Date.now()` desde abrir `/agenda/nueva` hasta "Cita creada": paciente existente < 60 s y paciente nuevo < 180 s, con datos escritos por el script como referencia mínima (SC-002)
- [ ] T112 Crear `prisma/seed-carga.ts` (≈ 1 año: 18 000 citas en 3 consultorios con estados variados, marcaciones, y un paciente con 100 atenciones en varias zonas) y verificar SC-003 (grilla < 2 s) y SC-009 (historial con 100 atenciones + gráfica < 3 s) en local; además, con `autocannon` (dependencia de desarrollo) lanzar 10 conexiones simultáneas durante 30 s contra `/agenda?consultorio=&fecha=` con una cookie de sesión de prueba: p95 < 2 s; si no se cumple, revisar índices y consultas de T041 y T059
- [ ] T113 [P] Revisar que ningún `console.*` ni mensaje de error registre datos personales o de salud (documentos, nombres, notas, dolor); centralizar en `src/lib/log.ts` un `registrarError(contexto, error)` que solo registre códigos, ids y mensajes técnicos
- [ ] T114 [P] Crear `README.md` en la raíz: requisitos, puesta en marcha local (de [quickstart.md](./quickstart.md)), scripts, variables de entorno, despliegue en Vercel + Neon y enlace a `docs/respaldos.md`
- [ ] T115 Ejecutar la validación completa de [quickstart.md](./quickstart.md): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, la validación manual por historia (US1–US8) y, en el entorno de producción antes de abrirlo al personal, el simulacro de restauración (SC-011); cronometrar con la Recepcionista real 3 citas de paciente existente (< 1 min cada una) y 3 de paciente nuevo (< 3 min cada una) (SC-002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; **bloquea** todas las historias.
- **US1 (Phase 3)**: depende de Foundational. Es el MVP: sin acceso no se puede usar ningún módulo.
- **US2 (Phase 4)**: depende de US1 (layout, `paginaProtegida`, login).
- **US3 (Phase 5)**: depende de US2 (citas creadas).
- **US4 (Phase 6)**: depende de US3 (necesita citas ASISTIDA vía `marcarAsistida`; T060 modifica `estados.ts` de T048).
- **US5 (Phase 7)**: depende de US2; independiente de US3/US4 (T067 pasa la cita a ASISTIDA por sí mismo). T071 modifica la página de T052 (US3).
- **US6 (Phase 8)**: su implementación depende solo de US1 y puede adelantarse en paralelo con US2–US5. Su prueba independiente completa (el consultorio aparece o desaparece en la agenda) requiere US2; con solo US1 se valida con T073 (`listarConsultoriosActivos` y `crearCita` → `VALIDACION`).
- **US7 (Phase 9)**: depende de US1; independiente de las citas.
- **US8 (Phase 10)**: depende de US3 (citas ASISTIDA) y de US7 (`movimiento_financiero`, `puedeAnular`, `/mis-movimientos`).
- **Polish (Phase 11)**: depende de las historias que se vayan a entregar; T106–T108 pueden hacerse en cualquier momento después de Setup.

### Archivos compartidos (tareas que no pueden ir en paralelo entre sí)

- `prisma/schema.prisma`: T009 → T056 → T066 → T082 → T094 (en orden; cada una con su propia migración).
- `src/server/citas/estados.ts`: T048 → T060 → T099.
- `src/app/(app)/citas/[id]/page.tsx`: T052 → T071 (y enlaces de T063, T103).
- `prisma/seed.ts` / `prisma/seed-demo.ts`: T019 → T083; T046 → T083.

### Within Each User Story

- Pruebas primero (deben fallar), luego esquema/migración, validación Zod, servicios en `src/server/`, y por último páginas y acciones.
- Completar el checkpoint de la historia antes de pasar a la siguiente prioridad.

---

## Parallel Examples

### Phase 2 (Foundational)

```text
Task: "T011 src/server/db.ts"
Task: "T012 src/lib/tiempo.ts"
Task: "T013 src/lib/permisos.ts"
Task: "T014 src/lib/validacion/comunes.ts"
Task: "T015 src/lib/dinero.ts"
Task: "T016 src/lib/resultado.ts"
```

### User Story 2

```text
# Pruebas juntas:
Task: "T033 tests/integration/citas-choques.test.ts"
Task: "T034 tests/integration/citas-horario.test.ts"
Task: "T035 tests/integration/pacientes.test.ts"

# Validaciones y consultas auxiliares juntas:
Task: "T036 src/lib/departamentos.ts + src/lib/validacion/paciente.ts"
Task: "T037 src/lib/validacion/cita.ts"
Task: "T039 src/server/usuarios/profesionales.ts + src/server/consultorios/consulta.ts"
```

### User Story 4

```text
Task: "T055 tests/integration/atenciones.test.ts"
Task: "T057 src/lib/validacion/atencion.ts"
Task: "T061 src/components/graficas/evolucion-dolor.tsx"
```

### User Story 7

```text
Task: "T080 tests/integration/inventario.test.ts"
Task: "T081 tests/unit/anulacion.test.ts"
Task: "T084 src/lib/validacion/inventario.ts"
Task: "T088 src/app/(app)/insumos/page.tsx"
Task: "T089 src/app/(app)/insumos/nuevo, [id], [id]/reponer"
```

### Entre historias (con más de una persona)

Tras US1: una persona en US2 → US3 → US4, otra en US6, otra en US7; US5 tras US2; US8 tras US3 y US7.

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational.
2. Phase 3 (US1): acceso seguro por rol. **Validar** con su prueba independiente.
3. Phase 4 (US2): agendar sin choques. **Validar** con dos sesiones simultáneas.
4. Desplegar en una preview de Vercel con una rama de Neon y datos ficticios (`seed-demo`) para que la Recepcionista lo pruebe.

US1 sola es un MVP técnico; US1 + US2 es el primer incremento con valor para el consultorio (reemplaza la agenda de papel/WhatsApp).

### Incremental Delivery

1. US1 + US2 → agenda en uso.
2. US3 → estados y listados; US6 → el Dueño administra personal y consultorios sin ayuda técnica.
3. US4 + US5 → valor clínico y operativo (atenciones, historial, tiempos).
4. US7 + US8 → control económico.
5. Antes de cargar datos reales de pacientes en producción: T106, T107, T108, T113 y el simulacro de restauración (T115).

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes.
- Las restricciones de BD (`EXCLUDE`, `CHECK`, triggers) son la autoridad; las validaciones Zod y la UI son ayudas. No eliminar una restricción para "hacer pasar" una prueba.
- Toda prueba de "ventana del mismo día" inyecta `ahora`; no depender del reloj real.
- Hacer commit al terminar cada tarea o grupo lógico; detenerse en cada checkpoint para validar la historia.
