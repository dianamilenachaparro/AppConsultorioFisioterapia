# Respaldos y restauración

La base de datos tiene datos de salud y financieros. Se protegen con dos mecanismos complementarios (FR-044a, SC-011, [research R-16](../specs/001-gestion-consultorio/research.md)):

| Mecanismo | Cubre | Retención | Pérdida máxima |
|---|---|---|---|
| Recuperación a un momento (PITR) de Neon | errores recientes (borrados, cambios equivocados) | ≥ 7 días | segundos |
| Respaldo lógico diario cifrado (GitHub Actions → bucket S3) | errores antiguos, pérdida de la cuenta o del proveedor | 30 días | 1 día |

## Requisitos (una sola vez)

1. **Neon en plan de pago** con ventana de restauración (history retention) de **7 días o más**. El plan gratuito solo guarda horas: confírmalo en la consola de Neon → *Settings → Storage*.
2. **Bucket privado compatible con S3** (por ejemplo Cloudflare R2) con una **regla de ciclo de vida que borre los objetos de más de 30 días** bajo el prefijo `respaldos/`. Crea una llave de acceso con permiso solo de escritura sobre ese bucket.
3. **Par de claves `age`** generado en un computador de confianza, nunca en el servidor:

   ```powershell
   age-keygen -o consultorio-respaldos.key   # imprime la clave pública: age1...
   ```

   - La **clave pública** (`age1…`) va como secreto del repositorio.
   - La **clave privada** (`consultorio-respaldos.key`) la guarda el Dueño **en dos lugares fuera del sistema**, por ejemplo un gestor de contraseñas y una memoria USB guardada en la caja fuerte del consultorio. Sin ella los respaldos no se pueden leer; si se filtra, cualquiera con acceso al bucket podría leerlos.
4. **Secretos de GitHub** (*Settings → Secrets and variables → Actions*): `DIRECT_URL` (cadena de Neon **sin** `-pooler`), `AGE_PUBLIC_KEY`, `S3_ENDPOINT`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
5. Ejecuta el flujo una vez a mano (*Actions → respaldo-diario → Run workflow*) y comprueba que aparece `respaldos/consultorio-AAAA-MM-DD.dump.age` en el bucket.

> **Versión de PostgreSQL.** El flujo instala `postgresql-client-16`. `pg_dump` no puede volcar un servidor de versión mayor que la suya: si el proyecto de Neon es PostgreSQL 17, cambia el paquete a `postgresql-client-17` (repositorio de PGDG).

El flujo `.github/workflows/respaldo-diario.yml` corre todos los días a las 03:00 (Bogotá). Si el volcado, el cifrado o la subida fallan, el job queda en rojo y GitHub envía un correo. Revisa esas notificaciones.

## Restaurar a un momento reciente (PITR de Neon)

Para deshacer un error de los últimos 7 días:

1. En la consola de Neon: *Branches → Create branch*, origen `main`, opción **Point in time**, con la hora **anterior** al error (hora de Bogotá = UTC − 5).
2. Conéctate a la rama nueva y verifica los datos, por ejemplo con `psql "<cadena de la rama>"`.
3. Cuando confirmes que es la versión correcta, usa *Restore* sobre `main` con ese mismo instante, o cambia temporalmente `DATABASE_URL`/`DIRECT_URL` en Vercel para que apunten a la rama.
4. Todo lo registrado después de ese instante se pierde: avisa al personal para que lo vuelva a ingresar.

## Restaurar desde un respaldo diario

```powershell
aws s3 cp "s3://<bucket>/respaldos/consultorio-AAAA-MM-DD.dump.age" . --endpoint-url "<S3_ENDPOINT>"
age -d -i consultorio-respaldos.key -o consultorio.dump consultorio-AAAA-MM-DD.dump.age
createdb -h localhost -U consultorio consultorio_restaurada
pg_restore --no-owner --no-privileges -h localhost -U consultorio -d consultorio_restaurada consultorio.dump
```

Borra `consultorio.dump` (sin cifrar) en cuanto termines.

## Simulacro de restauración (obligatorio antes de producción y luego cada trimestre)

Sigue el procedimiento de [quickstart.md → Simulacro de restauración](../specs/001-gestion-consultorio/quickstart.md#simulacro-de-restauración-sc-011--obligatorio-antes-de-producción):

1. Registra una cita de prueba y anota la hora `T`; unos minutos después cancélala.
2. Crea una rama PITR a `T + 1 min`: la cita debe aparecer Programada (pérdida ≤ 5 min).
3. Restaura el último respaldo diario en un PostgreSQL local y compara con producción a la hora del respaldo:

   ```sql
   SELECT (SELECT count(*) FROM cita) AS citas,
          (SELECT count(*) FROM atencion) AS atenciones,
          (SELECT count(*) FROM movimiento_financiero) AS movimientos;

   -- Invariante de stock (SC-007): no debe devolver filas.
   SELECT i.nombre, i.stock, COALESCE(SUM(CASE WHEN m.tipo = 'VENTA' THEN -m.cantidad ELSE m.cantidad END), 0) AS esperado
   FROM insumo i LEFT JOIN movimiento_inventario m ON m.insumo_id = i.id AND NOT m.anulado
   GROUP BY i.id HAVING i.stock <> COALESCE(SUM(CASE WHEN m.tipo = 'VENTA' THEN -m.cantidad ELSE m.cantidad END), 0);
   ```

4. Comprueba en el bucket que hay un respaldo por día y ninguno de más de 30 días.
5. Anota la fecha del simulacro y el resultado.
