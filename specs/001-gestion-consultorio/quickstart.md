# Quickstart: validación de la funcionalidad

Guía para levantar el proyecto en local y comprobar de punta a punta que la funcionalidad cumple la spec. No contiene implementación; los detalles están en [data-model.md](./data-model.md) y [contracts/](./contracts/).

## Prerrequisitos

- Node.js 22 LTS y pnpm 9+ (`corepack enable`)
- Docker Desktop (PostgreSQL 16 local para desarrollo y pruebas de integración)
- Para la exportación: un proyecto de Google Cloud con Sheets API y Drive API habilitadas y un cliente OAuth "Aplicación web" con URI de redirección `http://localhost:3000/api/google/oauth/callback`

## Puesta en marcha

```powershell
pnpm install
docker compose up -d db              # postgres:16 en localhost:5432
Copy-Item .env.example .env          # completar DATABASE_URL, DIRECT_URL, GOOGLE_*, GOOGLE_TOKEN_KEY, APP_URL
pnpm prisma migrate dev              # incluye btree_gist, restricciones EXCLUDE/CHECK y trigger de auditoría
pnpm db:seed                         # 3 consultorios, categorías de egreso; pide cédula y contraseña del Dueño inicial
pnpm db:seed:demo                    # (opcional) recepcionista, 2 profesionales, pacientes e insumos ficticios
pnpm dev                             # http://localhost:3000
```

## Pruebas automatizadas

```powershell
pnpm test                 # Vitest unitarias: horario, zona horaria, indicadores, matriz de permisos
pnpm test:integration     # Vitest contra Postgres real: choques, concurrencia, stock, auditoría
pnpm test:e2e             # Playwright: escritorio + celular (Pixel 7, iPhone 14)
pnpm lint; pnpm typecheck
```

Resultado esperado: todo en verde. Las pruebas de integración deben incluir como mínimo:

| Prueba | Criterio |
|---|---|
| Dos `crearCita` simultáneas (`Promise.all`) mismo consultorio y hora | exactamente 1 éxito, 1 `CONFLICTO_CONSULTORIO` (SC-001) |
| Citas parcialmente superpuestas (09:00–10:00 vs 09:30–10:00) | rechazada |
| Mismo profesional, consultorios distintos, misma hora | `CONFLICTO_PROFESIONAL` |
| Cita cancelada → nueva cita en el mismo bloque | permitida |
| Cita de 90 min a las 16:00 / inicio 07:00 / inicio 09:15 | `FUERA_DE_HORARIO` (también vía SQL directo → la BD la rechaza) |
| Venta mayor al stock | `STOCK_INSUFICIENTE`; stock sin cambios |
| Invariante de stock tras ventas, reposiciones y anulaciones aleatorias | `stock = Σ movimientos vigentes` y cada venta/reposición con su financiero (SC-007) |
| `UPDATE`/`DELETE` sobre `registro_auditoria` | error de la BD |
| Matriz rol × acción (todas las acciones de [server-actions.md](./contracts/server-actions.md)) | 100 % de accesos fuera de rol → `SIN_PERMISO` (SC-005) |
| Indicadores con el ejemplo 08:00 / 07:55 / 08:10 / 08:40 | espera 15, duración 30, retraso 10 |
| Dos cobros (abonos) en la misma cita, efectivo + transferencia | ambos vigentes; `sumaVigente` = suma |
| Profesional cobra cita de otro profesional | `SIN_PERMISO` |
| Anular cobro/venta propio: mismo día vs. con `ahora` inyectado al día siguiente (23:59 → 00:00 Bogotá) | éxito / `FUERA_DE_VENTANA`; Dueño puede en ambos casos; venta anulada repone stock |
| Editar atención el mismo día vs. día siguiente; también `UPDATE atencion` por SQL directo al día siguiente | éxito con `antes` en auditoría / `FUERA_DE_VENTANA` y error de la BD |
| `UPDATE`/`DELETE` sobre `nota_aclaratoria` | error de la BD |

## Validación manual por historia de usuario

Usar los datos demo. Abrir dos navegadores (uno en modo incógnito) y el modo de dispositivo móvil de DevTools a 360 px.

1. **US1 – Acceso**: entrar como Recepcionista → ve Agenda y Pacientes, no Finanzas ni Admin; abrir `/finanzas` a mano → 403. Cerrar sesión y abrir `/pacientes/<id>/historial` → redirige a `/login` sin datos. 5 contraseñas malas → sexto intento rechazado aunque la contraseña sea correcta (esperar 15 min o desbloquear vía Dueño). Mensaje siempre genérico.
2. **US2 – Agendar**: `/agenda`, Consultorio 1, mañana. Documento nuevo → pide los 8 campos. Documento existente → carga datos. Cita 60 min 09:00 → bloques 09:00 y 09:30 Ocupados. En los dos navegadores preparar la misma cita y confirmar casi a la vez → una confirmada, la otra con "El consultorio ya está ocupado en ese horario". Cita de ayer → etiqueta "Retroactiva".
3. **US3 – Estados**: cancelar sin observación → bloqueado; con observación → bloques libres. `/citas` filtrando profesional + Asistida + rango → conteos correctos.
4. **US5 – Marcación** (celular, como Profesional): `/mi-dia` → Llegada → Ingreso (la cita pasa a Asistida) → Fin; cada toque < 5 s. Como Dueño, corregir una marca y verificar en `/admin/auditoria` el valor anterior.
5. **US4 – Atención**: registrar atención en la cita asistida (dolor 11 → rechazado). Corregir el dolor el mismo día → se guarda y aparece "Editada" con la versión anterior. Sobre una atención de un día anterior (datos demo) → solo se ofrece "Agregar nota aclaratoria". Crear 3 atenciones lumbares en fechas distintas → historial ordenado y gráfica por zona. Como otro Profesional, abrir ese historial → 403.
6. **US6 – Admin**: crear Consultorio 4 → aparece en la agenda; desactivarlo → ya no se ofrece para nuevas citas; sus citas siguen visibles. Crear usuario con cédula repetida → rechazado.
7. **US7 – Insumos**: stock 10 → venta 3 → 7 y nuevo ingreso; venta de 8 → rechazada; reposición 20 → 27 y egreso "Compra de insumos"; bajar bajo el mínimo → distintivo "Stock bajo".
8. **US8 – Finanzas**: como Profesional, registrar un abono en su cita asistida; como Recepcionista, un segundo abono por transferencia en la misma cita → el formulario muestra el cobro previo y la suma. En `/mis-movimientos` (R y P) se ven solo los propios de hoy, sin totales; anular uno con motivo. Un cobro de un día anterior no es anulable por R/P ("Solicítalo al Dueño"). Como Dueño, filtrar por rango + Transferencia y comparar totales. Conectar Google en `/finanzas/google`, exportar → abrir la hoja: mismas filas y totales que en pantalla (SC-008). Exportar con filtro sin resultados → hoja con encabezados y totales en 0.

## Rendimiento (SC-003, SC-009)

Con `pnpm db:seed:carga` (≈ 1 año de datos: 18 000 citas, un paciente con 100 atenciones): la grilla de `/agenda` debe cargar en < 2 s y `/pacientes/<id>/historial` en < 3 s, medido en la pestaña Network con caché desactivada, tanto en local como en la preview de Vercel.

## Despliegue (Vercel + Neon)

1. Crear proyecto en Vercel ligado al repositorio; agregar Neon desde Vercel Marketplace (región `us-east-1`; funciones en `iad1`).
2. Variables de entorno de producción: `DATABASE_URL` (pooled), `DIRECT_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_KEY` (32 bytes base64), `APP_URL`.
3. Comando de build: `prisma migrate deploy && next build`.
4. Ejecutar la semilla una sola vez contra producción para crear el Dueño inicial; las previews usan una rama de Neon con datos ficticios.
5. Agregar `https://<dominio>/api/google/oauth/callback` al cliente OAuth y publicar la pantalla de consentimiento.
6. Respaldos ([research R-16](./research.md)): plan de pago de Neon con ventana de restauración ≥ 7 días; configurar el flujo programado `respaldo-diario` de GitHub Actions con los secretos `DIRECT_URL`, credenciales del bucket y la clave pública `age`; regla de ciclo de vida de 30 días en el bucket.

## Simulacro de restauración (SC-011) — obligatorio antes de producción

1. Registrar una cita de prueba y anotar la hora `T`. Esperar unos minutos y cancelarla.
2. Crear en Neon una rama restaurada a `T + 1 min` → la cita aparece Programada (pérdida ≤ 5 min verificada).
3. Descargar el último dump del bucket, descifrarlo con la clave privada `age` y restaurarlo con `pg_restore` en el Postgres local de Docker → los conteos de `cita`, `atencion` y `movimiento_financiero` coinciden con producción a la hora del dump, y `stock = Σ movimientos vigentes` para cada insumo.
4. Comprobar en el bucket que existe un respaldo por día y ninguno de más de 30 días.
