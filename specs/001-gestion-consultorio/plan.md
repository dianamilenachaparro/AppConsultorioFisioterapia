# Implementation Plan: Gestión de consultorio de Quiropraxia / Fisioterapia

**Branch**: `001-gestion-consultorio` (rama git actual: `plan`) | **Date**: 2026-10-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-gestion-consultorio/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Aplicación web responsive, de uso exclusivo del personal (Dueño, Recepcionista, Profesional), para agenda de citas por consultorio en bloques de 30 min (7:30–17:00), historial clínico de atenciones con evolución del dolor, marcación de tiempos e indicadores, inventario de insumos y registro financiero con exportación a Google Sheets.

Enfoque técnico: una sola aplicación **Next.js 16 (App Router) + TypeScript** desplegada en **Vercel**, con **PostgreSQL 16 (Neon)** vía **Prisma 7**. Las garantías críticas viven en la base de datos: restricciones `EXCLUDE` GiST sobre rangos de tiempo impiden citas superpuestas por consultorio, profesional y paciente incluso con confirmaciones simultáneas; `CHECK` de horario, stock no negativo y orden de marcaciones; registro de auditoría append-only protegido por trigger. Autenticación propia por cédula (Argon2id, sesiones en BD con expiración por inactividad de 30 min, bloqueo tras 5 fallos) y autorización por rol verificada en la capa de acceso a datos. Las aclaraciones del 2026-10-14 añaden: cobros (con abonos) registrables por los tres roles; anulación por el autor solo el mismo día; atenciones editables solo el mismo día, protegidas por trigger, con notas aclaratorias append-only; y respaldos con PITR de Neon más un dump diario cifrado retenido 30 días. Detalle de decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 22 LTS

**Primary Dependencies**: Next.js 16 (App Router, Server Actions), React 19, Prisma 7 (+ `@prisma/adapter-neon` / `@prisma/adapter-pg`), Zod 4, `@node-rs/argon2`, date-fns 4 + `@date-fns/tz`, Tailwind CSS 4 + shadcn/ui, Recharts, `googleapis`

**Storage**: PostgreSQL 16 (Neon gestionado en producción; Docker en local/pruebas) con extensión `btree_gist`

**Testing**: Vitest (unitarias + integración contra Postgres real), Playwright (E2E escritorio y celular)

**Target Platform**: Vercel (funciones Node.js, región `iad1`); navegadores modernos de escritorio y móviles (Chrome/Safari/Edge, últimas 2 versiones)

**Project Type**: Aplicación web full-stack (un único proyecto Next.js)

**Performance Goals**: grilla de disponibilidad < 2 s (SC-003); historial con 100 atenciones + gráfica < 3 s (SC-009); marcación por toque < 5 s en celular (SC-004)

**Constraints**: cero citas superpuestas bajo concurrencia (SC-001); pérdida máxima de datos ≤ 5 min, restauración a cualquier momento de 7 días y respaldos diarios por 30 días (FR-044a, SC-011); registro clínico inmutable tras el día de creación (FR-025a); zona horaria America/Bogota en todo cálculo (FR-042); sin desplazamiento horizontal a 360 px (SC-010); datos personales y de salud (Ley 1581 de 2012): acceso solo por rol, auditoría inmutable, sin datos reales en entornos de preview ni en logs

**Scale/Scope**: ~50 citas/día (~18 000/año), 3+ consultorios, < 15 usuarios del personal, ~25 pantallas, 3 roles

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` **aún es la plantilla sin completar** (sin principios ratificados), por lo que no hay compuertas formales que evaluar. Mientras se ratifica (recomendado: `/speckit-constitution`), este plan se valida contra principios de base derivados de la spec:

| Compuerta provisional | Estado inicial | Tras diseño (Fase 1) |
|---|---|---|
| Integridad en BD para invariantes críticos (choques, stock, auditoría) | ✅ previsto | ✅ `EXCLUDE`, `CHECK`, trigger en [data-model.md](./data-model.md) |
| Seguridad por defecto: autorización en el servidor, no solo en la UI | ✅ previsto | ✅ matriz única + `exigirPermiso` en cada acción ([server-actions.md](./contracts/server-actions.md)) |
| Simplicidad: un solo proyecto, sin servicios extra | ✅ | ✅ un proyecto Next.js, sin colas ni caché |
| Pruebas de las garantías contra Postgres real | ✅ previsto | ✅ escenarios en [quickstart.md](./quickstart.md) |
| Trazabilidad (quién/cuándo) en todas las mutaciones relevantes | ✅ previsto | ✅ `registro_auditoria` en la misma transacción (incluye ediciones de atención con versión anterior) |
| Recuperabilidad de datos (aclaración 2026-10-14) | ✅ previsto | ✅ PITR + dump diario cifrado + simulacro en [quickstart.md](./quickstart.md) |

Resultado: **PASA** (sin violaciones; Complexity Tracking vacío).

## Project Structure

### Documentation (this feature)

```text
specs/001-gestion-consultorio/
├── plan.md              # Este archivo
├── research.md          # Fase 0: decisiones técnicas (R-01 … R-17)
├── data-model.md        # Fase 1: entidades, restricciones, transiciones
├── quickstart.md        # Fase 1: guía de validación
├── contracts/
│   ├── rutas-ui.md                   # Rutas y permisos por rol
│   ├── server-actions.md             # Acciones del servidor: entradas, salidas, errores
│   └── exportacion-google-sheets.md  # Integración externa
├── checklists/requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks; no lo crea este comando)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma
├── migrations/                 # incluye SQL manual: btree_gist, EXCLUDE, CHECK, trigger de auditoría
└── seed.ts                     # consultorios, categorías, Dueño inicial (+ seed-demo.ts, seed-carga.ts)

src/
├── app/
│   ├── (publico)/login/
│   ├── (app)/                  # layout con sesión obligatoria y menú según rol
│   │   ├── agenda/             # grilla + nueva cita
│   │   ├── citas/[id]/         # detalle, reprogramar, atencion, cobro
│   │   ├── mi-dia/  mi-agenda/  mis-movimientos/
│   │   ├── pacientes/[id]/historial/
│   │   ├── indicadores/
│   │   ├── insumos/
│   │   ├── finanzas/           # historial, egresos, google
│   │   └── admin/              # usuarios, consultorios, auditoria
│   └── api/
│       ├── google/oauth/       # iniciar, callback
│       └── sesion/cerrar/
├── server/                     # capa de dominio y acceso a datos (solo servidor)
│   ├── auth/                   # sesiones, hash, bloqueo
│   ├── citas/                  # crear, reprogramar, estados, grilla, errores 23P01
│   ├── pacientes/
│   ├── atenciones/
│   ├── marcaciones/
│   ├── indicadores/
│   ├── inventario/
│   ├── finanzas/
│   ├── google/                 # oauth + sheets (cliente inyectable)
│   ├── auditoria/
│   └── db.ts                   # PrismaClient + adapter
├── lib/
│   ├── permisos.ts             # matriz rol × acción (fuente única)
│   ├── tiempo.ts               # America/Bogota: hoy, cortes día/semana/mes, bloques
│   ├── validacion/             # esquemas Zod compartidos
│   └── dinero.ts               # formato COP
├── components/                 # ui/ (shadcn), agenda/, graficas/, formularios/
└── proxy.ts                    # solo redirección a /login sin cookie

tests/
├── unit/
├── integration/                # requiere Postgres (docker compose)
└── e2e/                        # Playwright

docker-compose.yml              # postgres:16 para dev/pruebas
.github/workflows/
└── respaldo-diario.yml         # pg_dump cifrado con age → bucket con retención 30 días (R-16)
```

**Structure Decision**: Un único proyecto Next.js en la raíz del repositorio. La lógica de negocio y todo acceso a datos se concentra en `src/server/` (importable solo desde el servidor mediante `import 'server-only'`), de modo que páginas y Server Actions sean delgadas y la autorización y la auditoría no puedan saltarse. Las pruebas están separadas por tipo porque las de integración requieren Postgres real.

## Fases de entrega sugeridas (insumo para `/speckit-tasks`)

1. **Fundación**: proyecto, Prisma + migraciones con SQL manual, `tiempo.ts`, `permisos.ts`, auditoría, auth y sesiones (US1).
2. **Agenda** (US2, US3, US6): consultorios, pacientes, grilla, crear/reprogramar/cancelar con manejo de 23P01, admin de usuarios.
3. **Atención** (US4, US5): mi-día con marcaciones, atenciones (ventana del mismo día, versiones, notas aclaratorias), historial con gráfica, indicadores.
4. **Negocio** (US7, US8): insumos, ventas/reposiciones, cobros con abonos por D/R/P, mis-movimientos y anulación del mismo día, finanzas, exportación a Google Sheets.
5. **Endurecimiento**: pruebas de carga (seed-carga), cabeceras de seguridad, revisión móvil 360 px, respaldos (flujo diario + simulacro de restauración), despliegue.

## Pendientes y riesgos

- **Doble cobro accidental**: al permitir abonos y tres roles cobrando, nada impide registrar dos veces el mismo pago. Mitigación: el formulario muestra cobros previos y la suma; el Dueño puede anular. Si se vuelve frecuente, evaluar un "valor de la terapia" por cita (hoy fuera de alcance).
- **Plan de Neon**: el plan gratuito no cubre la ventana de 7 días de PITR (FR-044a); confirmar el plan y la ventana de restauración al contratar.
- **Clave privada `age`**: si el Dueño la pierde, los dumps diarios son irrecuperables; guardarla en dos lugares fuera del sistema.
- **Constitución** sin ratificar: ejecutar `/speckit-constitution` y volver a pasar la compuerta.
- **Google OAuth**: la app debe publicarse en la consola de Google; en modo *Testing* el token caduca a los 7 días.
- **Vercel Hobby** no permite uso comercial: usar plan Pro para producción.

## Complexity Tracking

Sin violaciones que justificar.
