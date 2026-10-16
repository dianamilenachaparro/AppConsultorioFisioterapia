# Contrato: Rutas de la interfaz y permisos

Todas las rutas, salvo `/login`, exigen sesión válida. Sin sesión → redirección a `/login?siguiente=<ruta>` sin mostrar datos (US1-2). Con sesión pero sin permiso → página 403 "No tienes permiso para ver esta sección" (US1-3). Leyenda: **D** = Dueño, **R** = Recepcionista, **P** = Profesional.

| Ruta | Propósito | D | R | P |
|---|---|---|---|---|
| `/login` | Inicio de sesión (cédula + contraseña) | público | público | público |
| `/cambiar-password` | Cambio obligatorio tras creación/restablecimiento | ✔ | ✔ | ✔ |
| `/` | Redirige: D → `/agenda`, R → `/agenda`, P → `/mi-dia` | ✔ | ✔ | ✔ |
| `/agenda?consultorio=&fecha=` | Calendario + grilla de 19 bloques por consultorio | ✔ todas | ✔ todas | ✘ (usa `/mi-agenda`) |
| `/agenda/nueva?consultorio=&fecha=&hora=` | Crear cita (buscar documento → cargar o registrar paciente) | ✔ | ✔ | ✘ |
| `/citas` | Listado con filtros (rango, consultorio, profesional, estado) y conteos | ✔ | ✔ | solo propias |
| `/citas/[id]` | Detalle; acciones según rol y estado | ✔ | ✔ | solo propias |
| `/citas/[id]/reprogramar` | Reprogramar cita PROGRAMADA | ✔ | ✔ | ✘ |
| `/citas/[id]/atencion` | Registrar atención (cita ASISTIDA); editar solo el mismo día; después, agregar nota aclaratoria | ✔ | ✘ | solo propias (editar/nota: las que registró) |
| `/citas/[id]/cobro` | Registrar cobro o abono de terapia (cita ASISTIDA); muestra cobros previos y su suma | ✔ | ✔ | solo propias |
| `/mis-movimientos` | Cobros y ventas que registré hoy, con opción de anular (sin totales) | ✔ (redirige a `/finanzas`) | ✔ | ✔ |
| `/mi-dia` | Citas de hoy del profesional con botones Llegada / Ingreso / Fin | ✔ si atiende | ✘ | ✔ |
| `/mi-agenda?fecha=` | Agenda propia en todos los consultorios | ✔ si atiende | ✘ | ✔ |
| `/pacientes?q=` | Búsqueda por documento o nombre | ✔ | ✔ | solo sus pacientes |
| `/pacientes/nuevo` | Registro completo | ✔ | ✔ | ✘ |
| `/pacientes/[id]` | Datos del paciente (editar D/R) | ✔ | ✔ | solo sus pacientes, lectura |
| `/pacientes/[id]/historial` | Atenciones ordenadas por fecha, con notas aclaratorias e indicador "Editada" (ver versiones) + gráfica de dolor por zona | ✔ | ✔ | solo sus pacientes |
| `/indicadores?periodo=&fecha=&profesional=&consultorio=` | Panel de tiempos y conteos | ✔ todos | ✘ | solo propios (filtro de profesional fijo) |
| `/insumos` | Catálogo con alerta de stock bajo | ✔ | ✔ solo lectura para vender | ✘ |
| `/insumos/nuevo`, `/insumos/[id]` | Crear/editar/desactivar insumo, historial de movimientos | ✔ | ✘ | ✘ |
| `/insumos/[id]/reponer` | Registrar compra/reposición | ✔ | ✘ | ✘ |
| `/insumos/venta` | Registrar venta de insumo(s) | ✔ | ✔ | ✘ |
| `/finanzas?desde=&hasta=&tipo=&subtipo=&categoria=&medio=` | Historial con filtros y totales | ✔ | ✘ | ✘ |
| `/finanzas/egresos/nuevo` | Registrar egreso | ✔ | ✘ | ✘ |
| `/finanzas/google` | Conectar/desconectar cuenta Google | ✔ | ✘ | ✘ |
| `/admin/usuarios`, `/admin/usuarios/[id]` | CRUD usuarios, restablecer contraseña | ✔ | ✘ | ✘ |
| `/admin/consultorios` | CRUD consultorios | ✔ | ✘ | ✘ |
| `/admin/auditoria` | Consulta (solo lectura) del registro de auditoría | ✔ | ✘ | ✘ |

## Route Handlers (HTTP)

| Método y ruta | Uso | Rol |
|---|---|---|
| `GET /api/google/oauth/iniciar` | Redirige al consentimiento de Google (scope `drive.file`, `state` firmado en cookie) | D |
| `GET /api/google/oauth/callback?code=&state=` | Valida `state`, guarda refresh token cifrado, redirige a `/finanzas/google` | D |
| `POST /api/sesion/cerrar` | Cierra la sesión (borra cookie y fila) | todos |

## Requisitos transversales de la UI

- Sin desplazamiento horizontal a 360 px de ancho en: login, agenda, crear cita, mi-día, atención (SC-010).
- Fechas/horas mostradas con `es-CO` en `America/Bogota`; citas retroactivas con etiqueta visible "Retroactiva".
- Insumos con `stock < stock_minimo` con distintivo "Stock bajo" (color + texto, no solo color).
