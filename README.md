# Consultorio

Aplicación web para un consultorio de quiropraxia y fisioterapia: agenda por consultorio sin choques, estados de citas, historial clínico con evolución del dolor, marcación de tiempos e indicadores, inventario de insumos y registro financiero con exportación a Google Sheets. La usa solo el personal (Dueño, Recepcionista, Profesional), en computador o celular.

- Especificación, plan y tareas: [`specs/001-gestion-consultorio/`](specs/001-gestion-consultorio/)
- Guía de validación completa: [`quickstart.md`](specs/001-gestion-consultorio/quickstart.md)
- Respaldos y restauración: [`docs/respaldos.md`](docs/respaldos.md)

**Tecnología:** Next.js 16 (App Router, Server Actions), React 19, TypeScript, Prisma 7 + PostgreSQL 16, Zod 4, Tailwind CSS 4 + shadcn/ui, Recharts, Vitest y Playwright. Producción: Vercel + Neon.

## Requisitos

- Node.js 22 LTS y pnpm 9+ (`corepack enable`)
- PostgreSQL 16 local: con Docker (`docker compose up -d db`) o instalado en el sistema. Se necesitan las bases `consultorio` y `consultorio_test` y un rol con permiso `CREATEDB` (las pruebas recrean la base de prueba).
- Para exportar a Google Sheets: un proyecto de Google Cloud con Sheets API y Drive API activas y un cliente OAuth "Aplicación web" con URI de retorno `http://localhost:3000/api/google/oauth/callback`.

## Puesta en marcha local

```powershell
pnpm install
docker compose up -d db              # o usa tu PostgreSQL 16 local
Copy-Item .env.example .env          # completa las variables (ver abajo)
pnpm prisma migrate dev              # aplica migraciones, restricciones y triggers
pnpm db:seed                         # consultorios, categorías de egreso y Dueño inicial (pide cédula y contraseña)
pnpm db:seed:demo                    # opcional: datos ficticios; todos los usuarios con clave demo12345
pnpm dev                             # http://localhost:3000
```

Usuarios de demostración: `1000000009` Dueño, `1000000001` Recepcionista, `1000000002` y `1000000003` Profesionales.

## Variables de entorno

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión de la aplicación (en Neon, la cadena *pooled*). |
| `DIRECT_URL` | Conexión directa para migraciones y respaldos (en Neon, sin `-pooler`). |
| `DATABASE_URL_TEST` | Base exclusiva de las pruebas de integración; **se borra en cada corrida**. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cliente OAuth de Google para la exportación. |
| `GOOGLE_TOKEN_KEY` | 32 bytes en base64 para cifrar el token de Google: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `APP_URL` | URL pública sin barra final (`http://localhost:3000` en local). |

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Desarrollo, compilación (incluye `prisma migrate deploy`) y producción. |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | ESLint, TypeScript y Prettier. |
| `pnpm test` | Pruebas unitarias (Vitest). |
| `pnpm test:integration` | Pruebas contra PostgreSQL real. **Recrea `DATABASE_URL_TEST` desde cero.** |
| `pnpm test:e2e` | Playwright en escritorio, Pixel 7 e iPhone 14 contra `pnpm dev` y los datos demo. |
| `pnpm db:seed` / `db:seed:demo` / `db:seed:carga` | Semilla base, datos de demostración y datos de carga (≈ 1 año) para medir rendimiento. |

## Despliegue (Vercel + Neon)

1. Crea el proyecto en Vercel ligado al repositorio y agrega Neon desde Vercel Marketplace (región `us-east-1`; funciones en `iad1`).
2. Configura en Vercel las variables de entorno de producción de la tabla anterior (sin `DATABASE_URL_TEST`).
3. El build ejecuta `prisma migrate deploy && next build`.
4. Ejecuta `pnpm db:seed` una sola vez contra producción para crear el Dueño inicial. Las *previews* usan una rama de Neon con datos ficticios, **nunca** datos reales de pacientes.
5. Agrega `https://<dominio>/api/google/oauth/callback` al cliente OAuth y publica la pantalla de consentimiento (en modo de prueba el token vence a los 7 días).
6. Configura los respaldos según [`docs/respaldos.md`](docs/respaldos.md) y haz el simulacro de restauración **antes** de cargar datos reales.

## Datos personales (Ley 1581 de 2012)

- Cada servicio verifica el rol antes de tocar datos; el menú solo oculta opciones.
- Contraseñas con Argon2id, sesiones con expiración por inactividad y bloqueo tras intentos fallidos.
- Toda acción sobre citas, atenciones, inventario y finanzas queda en un registro de auditoría de solo inserción.
- Los registros de errores (`src/lib/log.ts`) nunca incluyen mensajes ni datos de entrada, solo códigos y pila.
- El consultorio debe publicar su política de tratamiento de datos.
