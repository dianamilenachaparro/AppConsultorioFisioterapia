# Contrato: Exportación del historial financiero a Google Sheets

Integración externa (FR-040, SC-008). Decisión técnica en [research.md R-10](../research.md#r-10--exportación-a-google-sheets-fr-040-sc-008).

## Conexión (una vez)

1. Dueño abre `/finanzas/google` → "Conectar cuenta de Google".
2. `GET /api/google/oauth/iniciar`: genera `state` aleatorio (cookie firmada, 10 min) y redirige a Google con:
   - `scope=https://www.googleapis.com/auth/drive.file openid email`
   - `access_type=offline`, `prompt=consent`, `redirect_uri={APP_URL}/api/google/oauth/callback`
3. `GET /api/google/oauth/callback`: valida `state` y que la sesión sea del Dueño; intercambia `code`; guarda `refresh_token` cifrado y `email` en `conexion_google`. Auditado (`GOOGLE_CONECTAR`).
4. "Desconectar" revoca el token en Google y borra la fila.

## Exportación

**Entrada**: el mismo `FiltroFinanzas` aplicado en pantalla.

**Proceso**:
1. Ejecutar `consultarFinanzas(filtro)` sin paginar (misma función que usa la pantalla).
2. `spreadsheets.create` con título `Finanzas Consultorio {desde} a {hasta} – exportado {YYYY-MM-DD HH:mm}` (hora Bogotá).
3. `spreadsheets.values.batchUpdate` (`valueInputOption=USER_ENTERED`) escribiendo:

| Fila | Contenido |
|---|---|
| 1 | `Filtros:` + descripción legible de los filtros aplicados |
| 3 | Encabezados: `Fecha`, `Tipo`, `Subtipo / Categoría`, `Descripción`, `Medio de pago`, `Valor (COP)`, `Paciente / Insumo`, `Registrado por`, `ID` |
| 4…n | Una fila por movimiento, mismo orden que en pantalla; `Valor` positivo para ingresos y negativo para egresos |
| n+2 | `Total ingresos` · valor |
| n+3 | `Total egresos` · valor |
| n+4 | `Balance` · valor |

Los totales se escriben como **números calculados en el servidor** (no fórmulas), idénticos a los mostrados en pantalla (SC-008). Sin resultados → solo encabezados y totales en 0.

**Salida**: `{ ok: true, data: { urlHoja } }` → la UI muestra el enlace "Abrir hoja". Auditado (`FINANZAS_EXPORTAR`, con filtros y número de filas).

## Errores

| Situación | Respuesta | Datos locales |
|---|---|---|
| Sin conexión de Google | `ERROR_GOOGLE` "Conecta tu cuenta de Google para exportar" + enlace | sin cambios |
| Token revocado/expirado (`invalid_grant`) | `ERROR_GOOGLE` "La conexión con Google expiró; vuelve a conectarla"; se borra la conexión | sin cambios |
| Fallo de red / cuota / 5xx de Google | `ERROR_GOOGLE` con mensaje genérico; se reintenta 1 vez con backoff | sin cambios |
| Usuario no Dueño | `SIN_PERMISO` | sin cambios |

## Prueba de contrato

Con el cliente de Google simulado (inyección de dependencia en `src/server/google/sheets.ts`): para un conjunto de movimientos y filtros dados, verificar que las filas enviadas y los tres totales coinciden exactamente con `consultarFinanzas(filtro)`; y que un error del cliente no modifica ninguna tabla. Prueba manual real descrita en [quickstart.md](../quickstart.md).
