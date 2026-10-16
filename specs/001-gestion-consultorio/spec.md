# Feature Specification: Gestión de consultorio de Quiropraxia / Fisioterapia

**Feature Branch**: `spec`

**Created**: 2026-10-14

**Status**: Draft

**Input**: User description: "Aplicación web (responsive, uso en computador y celular) para la gestión general de un consultorio de Quiropraxia / Fisioterapia: agenda de citas, historial de atenciones por paciente, control de tiempos de atención, inventario de insumos y registro financiero. Solo la usa el personal del consultorio (Dueño, Recepcionista, Profesional); los pacientes no ingresan. Volumen estimado ~50 citas por día." (ver descripción completa en el mensaje original de `/speckit-specify`).

## Clarifications

### Session 2026-10-14

- Q: ¿Quién puede registrar los cobros de terapia y las ventas de insumos? → A: Cualquier rol registra cobros de terapia (el Profesional solo de sus citas); las ventas de insumos las registran el Dueño y la Recepcionista. Recepcionista y Profesional no ven el historial, totales, egresos ni exportación financiera.
- Q: ¿Una cita puede tener varios cobros (abonos o pagos parciales) o solo un cobro? → A: Varios cobros por cita (abonos), cada uno con su propio valor y medio de pago.
- Q: Una vez guardado un registro de atención, ¿se puede editar después? → A: El autor o el Dueño pueden editarlo hasta el fin del día de la atención (hora de Colombia); después solo se pueden agregar notas aclaratorias. Todo cambio guarda la versión anterior, quién y cuándo.
- Q: ¿Qué tan seguido se debe respaldar la información y cuánta pérdida de datos es aceptable si falla el servidor? → A: Respaldo automático diario con retención de 30 días, más restauración a cualquier punto de los últimos 7 días; pérdida máxima aceptable ≈5 minutos.
- Q: Si alguien se equivoca al registrar un cobro de terapia o una venta de insumo, ¿quién lo puede anular? → A: Quien lo registró puede anularlo el mismo día (hora de Colombia) con motivo; después solo el Dueño.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acceso del personal con permisos por rol (Priority: P1)

Una persona del personal ingresa con su número de cédula y contraseña. Según su rol (Dueño, Recepcionista o Profesional) ve únicamente los módulos y acciones que le corresponden. Sin sesión activa no puede ver ni modificar nada.

**Why this priority**: Es la base de todo lo demás y protege los datos personales y de salud de los pacientes (Ley 1581 de 2012). Sin control de acceso ningún otro módulo puede ponerse en uso.

**Independent Test**: Crear un usuario por cada rol, iniciar sesión con cada uno y verificar qué menús, pantallas y acciones están disponibles y cuáles son rechazadas.

**Acceptance Scenarios**:

1. **Given** un usuario activo con rol Recepcionista, **When** ingresa su cédula y contraseña correctas, **Then** accede a la agenda y a pacientes, y no ve el módulo de finanzas ni el de administración.
2. **Given** una persona sin sesión activa, **When** intenta abrir cualquier pantalla interna (por ejemplo, el historial de un paciente), **Then** es enviada a la pantalla de inicio de sesión y no se muestra ningún dato.
3. **Given** un usuario con rol Profesional, **When** intenta acceder directamente a una pantalla de finanzas, **Then** el sistema le niega el acceso con un mensaje claro.
4. **Given** un usuario desactivado por el Dueño, **When** intenta iniciar sesión, **Then** el acceso se rechaza.
5. **Given** credenciales incorrectas, **When** se intenta iniciar sesión, **Then** se muestra un mensaje genérico que no revela si la cédula existe.

---

### User Story 2 - Registrar paciente y agendar cita sin colisiones (Priority: P1)

La Recepcionista (o el Dueño) recibe una solicitud de cita por WhatsApp, llamada o en persona. Selecciona consultorio y fecha en un calendario, ve la grilla de bloques de 30 minutos (7:30 a.m. – 5:00 p.m.) marcados como Disponibles u Ocupados, y crea la cita indicando paciente, motivo, zona corporal, profesional, hora de inicio y duración. Si el paciente es nuevo, registra todos sus datos; si ya existe, solo digita el documento y el motivo, y los demás datos se cargan solos.

**Why this priority**: Es el flujo diario principal del consultorio (~50 citas/día) y el mayor riesgo operativo es la doble asignación de un consultorio o profesional.

**Independent Test**: Con dos sesiones abiertas a la vez, intentar reservar el mismo bloque del mismo consultorio (o del mismo profesional en otro consultorio): solo una reserva debe quedar confirmada y la otra debe recibir un mensaje de error claro.

**Acceptance Scenarios**:

1. **Given** un documento no registrado, **When** el personal lo digita al crear la cita, **Then** el sistema pide el registro completo del paciente (documento, nombre completo, teléfono, fecha de nacimiento, dirección, departamento, ciudad y barrio) antes de continuar.
2. **Given** un paciente ya registrado, **When** el personal digita su documento, **Then** los datos del paciente se cargan automáticamente y solo se requiere el motivo de la terapia (y los datos propios de la cita).
3. **Given** el consultorio 1 con bloques 9:00 y 9:30 libres, **When** se crea una cita de 60 minutos a las 9:00, **Then** ambos bloques pasan a Ocupado en la grilla.
4. **Given** dos personas preparando a la vez una cita para el mismo consultorio y hora, **When** ambas confirman, **Then** solo la primera se guarda y la segunda recibe un mensaje indicando que el horario ya fue tomado.
5. **Given** un profesional con cita a las 10:00 en el consultorio 1, **When** se intenta asignarle otra cita a las 10:00 en el consultorio 2, **Then** el sistema la rechaza indicando que el profesional no está disponible.
6. **Given** una cita de 90 minutos, **When** se intenta iniciar a las 4:00 p.m., **Then** el sistema la rechaza porque terminaría después de las 5:00 p.m.
7. **Given** una fecha pasada, **When** el personal registra una cita, **Then** la cita queda guardada e identificada visiblemente como registro retroactivo.

---

### User Story 3 - Control de estados de citas (Priority: P2)

El personal marca cada cita como Asistida o Cancelada. Al cancelar, debe escribir obligatoriamente el motivo. Puede consultar la lista de citas filtrando por fecha, consultorio, profesional y estado.

**Why this priority**: Permite saber qué ocurrió con cada cita, libera los horarios cancelados y alimenta los indicadores y el historial.

**Independent Test**: Crear varias citas, cancelar una sin motivo (debe fallar), cancelarla con motivo, marcar otra como asistida y verificar que los filtros devuelven las citas correctas.

**Acceptance Scenarios**:

1. **Given** una cita Programada, **When** se intenta cancelar sin escribir observación, **Then** el sistema no permite la cancelación.
2. **Given** una cita Programada, **When** se cancela con observación, **Then** el estado pasa a Cancelada, se guarda quién y cuándo la canceló, y sus bloques vuelven a quedar Disponibles.
3. **Given** citas en distintos estados, consultorios y profesionales, **When** se filtra por profesional y estado Asistida en un rango de fechas, **Then** solo se listan las citas que cumplen todos los filtros, con el conteo total.

---

### User Story 4 - Registro de atención e historial del paciente (Priority: P2)

Cuando una cita es asistida, el profesional registra la atención: zona corporal tratada, motivo, técnica aplicada, escala de dolor (0 a 10) y notas de evolución. El personal autorizado consulta el historial completo del paciente ordenado por fecha y ve una gráfica de la evolución del dolor en el tiempo por zona corporal.

**Why this priority**: Es el valor clínico central del consultorio y permite mostrar al paciente su evolución.

**Independent Test**: Registrar tres atenciones en fechas distintas para un paciente con diferentes niveles de dolor en la zona lumbar y verificar el listado ordenado y la gráfica.

**Acceptance Scenarios**:

1. **Given** una cita marcada como Asistida, **When** el profesional diligencia los campos de la atención, **Then** queda registrada en el historial del paciente asociada a esa cita, al profesional y a la fecha.
2. **Given** una escala de dolor fuera del rango 0–10, **When** se intenta guardar, **Then** el sistema la rechaza.
3. **Given** un paciente con varias atenciones, **When** se abre su historial, **Then** se ven ordenadas por fecha y una gráfica de dolor en el tiempo separada por zona corporal.
4. **Given** un Profesional, **When** busca el historial de un paciente que nunca ha tenido cita con él, **Then** no puede verlo.
5. **Given** una atención registrada hoy, **When** su autor corrige la escala de dolor, **Then** el cambio se guarda y la versión anterior queda en el registro de auditoría.
6. **Given** una atención registrada ayer, **When** su autor intenta editarla, **Then** el sistema no lo permite y solo ofrece agregar una nota aclaratoria.

---

### User Story 5 - Marcación de tiempos e indicadores de atención (Priority: P2)

El profesional marca con un solo toque, por cada cita: llegada del paciente, ingreso a terapia y fin de terapia. El Dueño consulta un panel con tiempo de espera, duración real, puntualidad y citas programadas vs. asistidas vs. canceladas, por día, semana o mes, por profesional y por consultorio.

**Why this priority**: Permite medir y mejorar la operación, pero el consultorio puede funcionar sin él al inicio.

**Independent Test**: Marcar los tres tiempos en varias citas y verificar que los indicadores calculados coinciden con cálculos manuales.

**Acceptance Scenarios**:

1. **Given** una cita del día asignada al profesional, **When** pulsa "Llegada", **Then** se registra la hora actual (America/Bogota) y el siguiente botón disponible es "Ingreso a terapia".
2. **Given** una cita sin marca de llegada, **When** el profesional intenta marcar "Fin de terapia", **Then** el sistema no lo permite (las marcas siguen el orden llegada → ingreso → fin).
3. **Given** una cita programada a las 8:00 con llegada 7:55, ingreso 8:10 y fin 8:40, **When** se consulta el panel, **Then** muestra espera de 15 min, duración real de 30 min y retraso de 10 min respecto a la hora programada.
4. **Given** el filtro "semana" y un consultorio, **When** se consulta el panel, **Then** los indicadores consideran solo las citas de ese consultorio en esa semana.

---

### User Story 6 - Administración de usuarios y consultorios (Priority: P2)

El Dueño crea, edita y desactiva usuarios (asignando rol) y consultorios. El sistema arranca con 3 consultorios.

**Why this priority**: Necesario para incorporar personal y ajustar la capacidad sin depender de cambios técnicos.

**Independent Test**: Crear un cuarto consultorio y verificar que aparece en la agenda; desactivarlo y verificar que no admite nuevas citas.

**Acceptance Scenarios**:

1. **Given** el Dueño, **When** crea un usuario con cédula, nombre, rol y contraseña inicial, **Then** esa persona puede iniciar sesión con ese rol.
2. **Given** un consultorio desactivado, **When** se intenta crear una cita en él, **Then** no aparece como opción; sus citas históricas se conservan.
3. **Given** una cédula ya usada por otro usuario, **When** se intenta crear un usuario con ella, **Then** el sistema lo rechaza.

---

### User Story 7 - Insumos e inventario (Priority: P3)

El Dueño mantiene el catálogo de insumos (nombre, costo, precio de venta, stock y mínimo). Cada venta descuenta stock y genera un ingreso; cada compra/reposición aumenta stock y genera un egreso. Los insumos bajo el mínimo se resaltan.

**Why this priority**: Aporta control económico, pero no bloquea la atención de pacientes.

**Independent Test**: Registrar una venta y una reposición y verificar stock resultante, movimientos financieros generados y alerta de stock bajo.

**Acceptance Scenarios**:

1. **Given** un insumo con stock 10, **When** se registra la venta de 3 unidades, **Then** el stock queda en 7 y se genera un ingreso por la venta con su medio de pago.
2. **Given** un insumo con stock 2, **When** se intenta vender 3 unidades, **Then** el sistema rechaza la venta por stock insuficiente.
3. **Given** una reposición de 20 unidades, **When** se registra, **Then** el stock aumenta en 20 y se genera un egreso en la categoría "compra de insumos".
4. **Given** un insumo con mínimo 5, **When** su stock baja a 4, **Then** aparece con alerta visual de stock bajo.

---

### User Story 8 - Registro financiero y exportación (Priority: P3)

El personal registra cobros de terapias (valor variable por cita, efectivo o transferencia; ver permisos en FR-037). El Dueño ve los ingresos por venta de insumos, registra egresos por categoría y consulta el historial con filtros y totales. Puede exportar a Google Sheets lo que tiene filtrado.

**Why this priority**: Importante para la revisión periódica del negocio, pero depende de que la agenda y los insumos estén operando.

**Independent Test**: Registrar ingresos y egresos variados, aplicar filtros, verificar totales y exportar a Google Sheets comparando filas y totales.

**Acceptance Scenarios**:

1. **Given** una cita Asistida, **When** se registra su cobro con valor y medio de pago, **Then** se crea un ingreso de tipo terapia asociado a la cita; **When** se registra un segundo abono con otro medio de pago, **Then** se crea un ingreso adicional y la cita muestra la suma de sus cobros.
2. **Given** el formulario de egreso, **When** se registra uno, **Then** se exige categoría de la lista, fecha, valor y descripción.
3. **Given** filtros por rango de fechas y medio de pago "transferencia", **When** se consulta el historial, **Then** se muestran solo los movimientos que cumplen y los totales de ingresos, egresos y balance de ese conjunto.
4. **Given** un historial filtrado, **When** el Dueño exporta a Google Sheets, **Then** la hoja contiene exactamente los movimientos filtrados y sus totales.
5. **Given** un usuario Recepcionista o Profesional, **When** intenta ver o exportar finanzas, **Then** se le niega el acceso.
6. **Given** un Profesional con una cita Asistida asignada a él, **When** registra el cobro de esa cita, **Then** se crea el ingreso; **When** intenta registrar el cobro de una cita de otro profesional, **Then** se le niega.

---

### Edge Cases

- **Reserva simultánea**: dos usuarios confirman la misma franja (o franjas parcialmente superpuestas) al mismo tiempo; solo una se guarda y la otra recibe un error claro, sin dejar citas parciales.
- **Profesional en dos consultorios**: un profesional no puede tener citas superpuestas aunque sean en consultorios distintos.
- **Límite de las 5:00 p.m.**: la última cita de 30 minutos inicia a las 4:30 p.m.; una de 60 minutos no puede iniciar después de las 4:00 p.m.
- **Cita cancelada**: sus bloques se liberan y pueden reasignarse; la cita cancelada sigue visible en el historial de citas con su motivo.
- **Cita retroactiva**: aplica la misma validación de choque (consultorio y profesional) que una cita futura.
- **Consultorio o profesional desactivado con citas futuras Programadas**: el sistema advierte al Dueño de las citas pendientes antes de desactivar; las citas existentes se conservan para que el personal las reasigne o cancele.
- **Documento ya registrado al crear paciente nuevo**: el sistema no permite duplicados y carga el paciente existente.
- **Datos de paciente desactualizados**: en citas posteriores el personal puede corregir teléfono, dirección u otros datos; el documento identifica al paciente.
- **Marcaciones fuera de orden o repetidas**: no se permite marcar ingreso antes de llegada ni fin antes de ingreso; una marcación errónea solo la puede corregir el Dueño, dejando registro del cambio.
- **Cita sin marcaciones completas**: se excluye del cálculo del indicador que le falte (por ejemplo, sin llegada no cuenta para tiempo de espera).
- **Cambio de estado de una cita Asistida o Cancelada**: no se puede volver a Programada salvo por el Dueño, dejando registro del cambio.
- **Venta con stock insuficiente**: se rechaza; el stock nunca queda negativo.
- **Anulación tardía de cobro o venta**: si la Recepcionista o el Profesional intenta anular un movimiento propio de un día anterior, se rechaza y se indica que debe solicitarlo al Dueño; al anular una venta se repone el stock.
- **Exportación fallida o sin conexión con Google**: se informa el error al Dueño y no se pierde ningún dato; una exportación sin resultados genera una hoja con encabezados y totales en cero.
- **Cambio de día por zona horaria**: todas las fechas, el "hoy" y los cortes de día/semana/mes se calculan en hora de Colombia (America/Bogota).

## Requirements *(mandatory)*

### Functional Requirements

**Autenticación, usuarios y permisos**

- **FR-001**: El sistema MUST exigir inicio de sesión con número de cédula (usuario) y contraseña para acceder a cualquier información o acción.
- **FR-002**: El sistema MUST soportar tres roles: Dueño, Recepcionista y Profesional, y restringir vistas y acciones según la matriz de permisos de este documento, tanto en lo que se muestra como en lo que se permite ejecutar.
- **FR-003**: El Dueño MUST poder crear, editar, desactivar y reactivar usuarios, asignar su rol y restablecer su contraseña.
- **FR-004**: El sistema MUST impedir el inicio de sesión de usuarios desactivados y cerrar la sesión tras un periodo de inactividad.
- **FR-005**: El sistema MUST almacenar las contraseñas de forma que no puedan ser leídas por nadie, y bloquear temporalmente una cuenta tras intentos fallidos consecutivos.
- **FR-006**: Los pacientes MUST NOT tener cuentas ni acceso a la aplicación.

**Consultorios y agenda**

- **FR-007**: El sistema MUST iniciar con 3 consultorios y permitir al Dueño crear, editar, desactivar y reactivar consultorios.
- **FR-008**: El sistema MUST manejar una agenda independiente por consultorio, todos los días de 7:30 a.m. a 5:00 p.m., en bloques de 30 minutos (19 bloques por día).
- **FR-009**: El sistema MUST mostrar, al seleccionar consultorio y fecha en un calendario, la grilla de bloques indicando Disponible u Ocupado, y para los ocupados el paciente, profesional y estado de la cita (según permisos del rol).

**Pacientes**

- **FR-010**: El sistema MUST identificar a cada paciente por su número de documento, único.
- **FR-011**: El sistema MUST registrar del paciente: documento, nombre completo, teléfono, fecha de nacimiento, dirección, departamento, ciudad y barrio, todos obligatorios en el primer registro.
- **FR-012**: Al crear una cita para un documento existente, el sistema MUST cargar automáticamente los datos del paciente y solo exigir los datos propios de la cita.
- **FR-013**: Recepcionista y Dueño MUST poder buscar pacientes por documento o nombre y editar sus datos.

**Citas**

- **FR-014**: El personal (Recepcionista o Dueño) MUST poder crear citas con: paciente, motivo de la terapia, zona corporal, consultorio, profesional, fecha, hora de inicio y duración en múltiplos de 30 minutos.
- **FR-015**: Al confirmar una cita, el sistema MUST re-validar en ese momento que todos los bloques sigan libres tanto en el consultorio como para el profesional; si alguno fue tomado, MUST rechazar la cita completa con un mensaje claro, garantizando que nunca queden dos citas no canceladas superpuestas en el mismo consultorio o para el mismo profesional, incluso ante confirmaciones simultáneas.
- **FR-016**: El sistema MUST rechazar citas que terminen después de las 5:00 p.m. o empiecen antes de las 7:30 a.m.
- **FR-017**: El sistema MUST permitir que un paciente tenga varias citas activas a la vez (sin superposición entre ellas para el mismo paciente).
- **FR-018**: El sistema MUST permitir registrar citas en fechas u horas pasadas, marcándolas como registro retroactivo de forma visible.
- **FR-019**: Cada cita MUST tener un estado: Programada, Asistida o Cancelada; las citas nuevas futuras inician en Programada.
- **FR-020**: Al cancelar una cita, el sistema MUST exigir una observación con el motivo y liberar sus bloques.
- **FR-021**: El personal MUST poder reprogramar una cita Programada (cambiar fecha, hora, duración, consultorio o profesional) aplicando las mismas validaciones de FR-015 y FR-016.
- **FR-022**: El sistema MUST ofrecer un listado de citas con filtros por rango de fechas, consultorio, profesional y estado, mostrando conteos por estado.
- **FR-023**: El Profesional MUST ver su propia agenda (sus citas en todos los consultorios).

**Registro de atenciones**

- **FR-024**: Para cada cita Asistida, el sistema MUST permitir registrar una atención con: zona corporal tratada, motivo de la terapia, técnica aplicada, escala de dolor (entero de 0 a 10) y notas de evolución; la zona y el motivo se precargan desde la cita.
- **FR-025**: El registro de atención MUST poder crearlo el profesional asignado a la cita o el Dueño, y queda asociado al paciente, la cita, el profesional y la fecha.
- **FR-025a**: El autor de la atención o el Dueño MUST poder editarla solo hasta las 11:59 p.m. (America/Bogota) del día en que se registró; después la atención MUST quedar inmutable y solo se le pueden agregar notas aclaratorias (con autor y fecha), que no reemplazan el contenido original. Cada edición MUST conservar la versión anterior con quién y cuándo la modificó.
- **FR-026**: El sistema MUST mostrar el historial completo de atenciones de un paciente ordenado por fecha y una gráfica de evolución de la escala de dolor en el tiempo, separada por zona corporal.
- **FR-027**: El Profesional MUST poder consultar el historial solo de pacientes con los que tiene o ha tenido al menos una cita; Recepcionista y Dueño pueden consultar el historial de cualquier paciente.

**Marcación de tiempos e indicadores**

- **FR-028**: El profesional asignado a una cita MUST poder registrar, con un solo toque cada una y en este orden: llegada del paciente, ingreso a la terapia y fin de la terapia; el sistema toma la hora actual de Colombia.
- **FR-029**: Registrar el ingreso a terapia MUST marcar la cita como Asistida si aún estaba Programada.
- **FR-030**: El Dueño MUST poder corregir una marcación, dejando registro del valor anterior, quién y cuándo.
- **FR-031**: El sistema MUST mostrar indicadores por día, semana o mes, filtrables por profesional y por consultorio: tiempo de espera promedio (llegada → ingreso), duración real promedio (ingreso → fin), puntualidad (ingreso real vs. hora programada, promedio de diferencia y % de citas iniciadas a tiempo) y cantidad de citas programadas, asistidas y canceladas.
- **FR-032**: El panel de indicadores MUST estar disponible para el Dueño; el Profesional MUST poder ver los indicadores de sus propias citas.

**Insumos e inventario**

- **FR-033**: El Dueño MUST poder crear, editar, desactivar y reactivar insumos con: nombre, costo, precio de venta, cantidad en stock y stock mínimo.
- **FR-034**: Cada venta de insumo MUST descontar del stock la cantidad vendida y generar automáticamente un ingreso de tipo "venta de insumos" con su medio de pago; si el stock es insuficiente, MUST rechazarse.
- **FR-035**: Cada compra o reposición MUST aumentar el stock y generar automáticamente un egreso en la categoría "compra de insumos".
- **FR-036**: El sistema MUST mostrar una alerta visual en los insumos cuyo stock esté por debajo de su mínimo.

**Registro financiero**

- **FR-037**: El sistema MUST permitir registrar uno o varios cobros (abonos) por cita, cada uno con su propio valor variable y medio de pago (efectivo o transferencia), generando por cada cobro un ingreso de tipo "terapia" asociado a la cita. El cobro de terapia lo pueden registrar el Dueño, la Recepcionista y el Profesional (este último solo para citas asignadas a él). Las ventas de insumos (FR-034) las pueden registrar el Dueño y la Recepcionista. Registrar un cobro o una venta MUST NOT dar acceso al historial, totales, egresos ni exportación financiera (FR-041).
- **FR-038**: El Dueño MUST poder registrar egresos eligiendo la categoría de una lista desplegable (arriendo, servicios públicos, compra de insumos, nómina, mantenimiento, otros), con fecha, valor y descripción.
- **FR-039**: El sistema MUST mostrar al Dueño el historial de ingresos y egresos con filtros por rango de fechas, categoría, tipo (ingreso/egreso y subtipo) y medio de pago, con totales de ingresos, egresos y balance del conjunto filtrado.
- **FR-040**: El Dueño MUST poder exportar el historial financiero filtrado directamente a una hoja de Google Sheets, con las mismas filas y totales que ve en pantalla.
- **FR-041**: Solo el Dueño MUST poder ver, editar o exportar la información financiera agregada (historial, totales, egresos).

**Reglas transversales**

- **FR-042**: Todas las fechas y horas MUST registrarse y mostrarse en la zona horaria America/Bogota.
- **FR-043**: Toda creación, modificación, cambio de estado, cancelación o anulación sobre citas, atenciones, movimientos financieros e inventario MUST guardar quién la realizó y cuándo, y este registro no puede ser editado por los usuarios.
- **FR-044**: Los movimientos financieros y de inventario MUST NOT eliminarse; los errores se corrigen anulándolos con motivo (dejando la reversión del stock o del valor correspondiente). Un cobro de terapia o una venta de insumo MUST poder anularlo quien lo registró solo durante el mismo día del registro (America/Bogota); después, solo el Dueño puede anularlo. Recepcionista y Profesional MUST ver únicamente los movimientos que ellos mismos registraron ese día, para poder anularlos.
- **FR-044a**: Toda la información MUST respaldarse automáticamente al menos una vez al día, conservando los respaldos 30 días, y MUST poder restaurarse a cualquier momento de los últimos 7 días.
- **FR-045**: La interfaz MUST ser usable en computador y en celular, incluyendo agenda, creación de citas y botones de marcación.

**Matriz de permisos**

| Módulo / acción | Dueño | Recepcionista | Profesional |
|---|---|---|---|
| Agenda: ver | Todas (y la suya si atiende) | Todas | Solo la suya |
| Citas: crear, reprogramar, cancelar | Sí | Sí | No |
| Pacientes: registrar, editar, buscar | Sí | Sí | Solo consultar sus pacientes |
| Atenciones: registrar | Sí | No | Sí (sus citas) |
| Atenciones: editar (mismo día) / agregar nota aclaratoria | Sí | No | Sí (las que registró) |
| Historial de atenciones: consultar | Todos | Todos | Sus pacientes |
| Marcación de tiempos | Sí (sus citas, si atiende) y corregir | No | Sí (sus citas) |
| Indicadores de tiempos | Todos | No | Los propios |
| Cobro de terapia: registrar | Sí | Sí | Sí (sus citas) |
| Insumos: registrar venta | Sí | Sí | No |
| Anular cobro / venta | Siempre | Los propios, mismo día | Los propios, mismo día |
| Insumos: catálogo y reposiciones | Sí | No | No |
| Finanzas: historial, egresos, exportación | Sí | No | No |
| Usuarios y consultorios | Sí | No | No |

### Key Entities

- **Usuario**: persona del personal. Cédula (única, usada para iniciar sesión), nombre, rol, estado activo/inactivo. Un usuario con rol Profesional (o el Dueño, si atiende) puede ser asignado a citas.
- **Consultorio**: espacio de atención con agenda propia. Nombre, estado activo/inactivo.
- **Paciente**: persona atendida. Documento (único), nombre completo, teléfono, fecha de nacimiento, dirección, departamento, ciudad, barrio.
- **Cita**: reserva de uno o varios bloques consecutivos de 30 minutos. Paciente, profesional, consultorio, fecha, hora de inicio, duración, motivo, zona corporal, estado, indicador de registro retroactivo, observación de cancelación.
- **Marcación de tiempos**: horas de llegada, ingreso y fin de terapia de una cita, con quién las registró.
- **Atención**: registro clínico de una cita asistida. Zona corporal, motivo, técnica, escala de dolor (0–10), notas de evolución, profesional, fecha; editable solo el mismo día. Puede tener notas aclaratorias posteriores (texto, autor, fecha).
- **Insumo**: artículo de inventario. Nombre, costo, precio de venta, stock, stock mínimo, estado.
- **Movimiento de inventario**: venta o reposición de un insumo con cantidad, fecha y responsable; enlazado al movimiento financiero que genera.
- **Movimiento financiero**: ingreso (terapia o venta de insumos) o egreso (por categoría), con fecha, valor, medio de pago, descripción y referencias a la cita o movimiento de inventario relacionado.
- **Categoría de egreso**: lista de categorías disponibles para egresos.
- **Registro de auditoría**: quién hizo qué acción, sobre qué elemento, cuándo y con qué valores anteriores.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cero citas superpuestas (mismo consultorio o mismo profesional) en el sistema, incluso en pruebas de confirmaciones simultáneas.
- **SC-002**: El personal agenda una cita para un paciente ya registrado en menos de 1 minuto y para un paciente nuevo en menos de 3 minutos.
- **SC-003**: La grilla de disponibilidad de un consultorio y fecha se muestra en menos de 2 segundos con el volumen normal de operación (~50 citas/día, varios usuarios simultáneos).
- **SC-004**: Cada marcación de tiempo requiere un único toque y se completa en menos de 5 segundos desde un celular.
- **SC-005**: El 100% de los intentos de acceso a información fuera del rol (por ejemplo, finanzas desde Recepcionista o Profesional) son rechazados.
- **SC-006**: El 100% de las acciones sobre citas, finanzas e inventario tienen registrado quién y cuándo.
- **SC-007**: El stock de cada insumo coincide en todo momento con la suma de sus movimientos registrados, y cada venta o reposición tiene su movimiento financiero correspondiente.
- **SC-008**: Los totales exportados a Google Sheets coinciden exactamente con los totales mostrados en pantalla para los mismos filtros.
- **SC-009**: El historial de un paciente con hasta 100 atenciones, incluida su gráfica de evolución, se visualiza en menos de 3 segundos.
- **SC-010**: Las tareas principales (iniciar sesión, consultar agenda, crear cita, marcar tiempos, registrar atención) se pueden completar sin desplazamiento horizontal en un celular estándar.
- **SC-011**: Ante una falla del servidor o de la base de datos se pierden como máximo 5 minutos de datos registrados, verificado con al menos una prueba de restauración a un momento específico antes de salir a producción.

## Assumptions

- "50" corresponde a ~50 citas por día en total entre todos los consultorios.
- Los estados de cita son solo Programada, Asistida y Cancelada; no se incluye "No asistió" en esta iteración (una inasistencia se registra como Cancelada con su motivo).
- Las marcaciones de tiempo se asocian a la cita y las hace el profesional que la atiende.
- El profesional queda asociado a cada cita y su disponibilidad se valida junto con la del consultorio.
- El Dueño también puede ser asignado como profesional de una cita si atiende pacientes.
- "Sus pacientes" (para el rol Profesional) son los pacientes con al menos una cita, de cualquier estado, asignada a ese profesional.
- Al iniciar el sistema existen 3 consultorios y una cuenta de Dueño inicial.
- La escala de dolor es un número entero de 0 a 10.
- La sesión se cierra tras 30 minutos de inactividad; la cuenta se bloquea 15 minutos tras 5 intentos fallidos; la contraseña tiene mínimo 8 caracteres. El Dueño restablece contraseñas (no hay recuperación por correo, pues no hay notificaciones externas).
- La zona corporal se elige de una lista predefinida (por ejemplo: cervical, dorsal, lumbar, hombro, codo, muñeca/mano, cadera, rodilla, tobillo/pie, otra) para que la gráfica de evolución pueda agrupar por zona.
- La puntualidad considera "a tiempo" un ingreso real de hasta 5 minutos después de la hora programada.
- La exportación a Google Sheets crea una hoja nueva en la cuenta de Google conectada por el Dueño en cada exportación.
- El recaudo puede registrarse en cualquier momento después de la cita; una cita puede quedar sin cobro registrado o tener varios abonos. No se registra un "valor total esperado" por cita en esta iteración.
- Los datos personales y de salud solo se almacenan; no hay consentimiento informado firmado en esta iteración. El acceso se restringe al personal autorizado conforme a la Ley 1581 de 2012.
- Los datos se conservan indefinidamente en esta iteración (no hay purga automática).
- Las decisiones de plataforma tecnológica y despliegue propuestas en la descripción original (despliegue web en la nube, base de datos relacional, autenticación propia) se definirán en la fase de planificación.

### Fuera de alcance (Non-Goals)

- Pagos en línea.
- Facturación electrónica e integración con la DIAN.
- Autoagendamiento y acceso de pacientes a la aplicación.
- Notificaciones externas (recordatorios o confirmaciones por correo, SMS o WhatsApp).
- Consentimiento informado firmado e historia clínica completa.
- Integración automática con WhatsApp para recibir solicitudes de citas.
