# HU-60 · Backend PostgreSQL

11 de octubre de 2026. Estado: **En desarrollo**. Primer bloque: lectura de propiedades y contabilidad del propietario, implementada y probada en un ensayo local. No se habilitaron escrituras, no se conectaron todas las pantallas y no hubo cambios en producción.

## Implementación

`GET /api/properties` y `GET /api/accounting` pueden obtener datos desde PostgreSQL cuando la autenticación es Supabase y se habilita explícitamente `REHAB_POSTGRES_READ_PREVIEW=1`. Esta opción exige la API local `http://127.0.0.1:54321` y origen de aplicación localhost/127.0.0.1. Sin ella las solicitudes autenticadas continúan devolviendo 503. El modo Sites conserva su backend D1 actual.

La opción estuvo activa únicamente durante las pruebas y se retiró al terminar. No se suben archivos `.env` ni claves. Para reproducir el ensayo, añadir temporalmente esa variable a `.env.local`, iniciar el servidor con `./node_modules/.bin/vite --host 127.0.0.1 --port 3000 --strictPort` y ejecutar el script HTTP indicado abajo; retirar la variable y reiniciar el servidor al finalizar (la configuración se carga al arrancar). La portada sigue redirigiendo a Cuenta: este bloque prueba los contratos HTTP, todavía no ofrece una interfaz de operación con PostgreSQL.

El servidor verifica la cuenta con `getUser()` y consulta la RPC `owner_workspace_snapshot()` usando la sesión del usuario y la clave publicable. No utiliza `service_role` en solicitudes de la aplicación. La RPC no recibe un propietario del cliente: aplica `auth.uid()` y RLS. Usa SECURITY INVOKER, `search_path` vacío, permiso EXECUTE solo para authenticated y ningún permiso nuevo de escritura.

Una sola sentencia SQL estable reúne propiedades, libro, cabeceras, líneas, distribuciones, historial de clasificación y saldos iniciales bajo la misma instantánea de lectura. Evita mezclar versiones al ejecutar consultas REST separadas y evita recortar el libro al límite de 1.000 filas de Data API. Devuelve un objeto JSON agregado; se deberá evaluar memoria/latencia con el volumen real en HU-65.

El adaptador `lib/postgres/workspace.ts` mantiene libros heredados incrustados y reconstruye los normalizados (`invoiceStorage=1`) con líneas y distribuciones. Usa los IDs y la propiedad de las columnas relacionales, conserva el historial, toma las versiones de las columnas temporales y calcula el resumen de preservación. Las propiedades conservan la proyección existente de ejecución de obra. No modifica la instantánea recibida.

La respuesta HTTP incluye `readOnly: true` y encabezados sin caché. El middleware solo deja pasar estas dos lecturas hacia su verificación local. PUT/DELETE de propiedades, POST contable, rutas restantes y consultas de colaboradores con `grantId` permanecen bloqueadas; una identidad Supabase nunca llega a escrituras D1.

## Verificación realizada

- **11 pruebas HTTP reales**: acceso anónimo, dos propietarios, aislamiento de cartera/libro, libro vacío, 1.201 facturas sin truncar, reconstrucción de centros, bloqueo de colaboradores y escrituras, y RPC anónima denegada.
- Pruebas puras del adaptador: libro vacío, heredado y normalizado; IDs relacionales, historial, distribuciones, centavos de saldos y ausencia de mutaciones del origen.
- **45 comprobaciones SQL locales y 45 al reconstruir las migraciones**, incluidas cuatro nuevas de aislamiento y privilegios de la RPC.
- **22 pruebas de autenticación** después de desactivar la vista previa y reiniciar el servidor: aprobadas, incluido bloqueo de datos sin migrar.
- TypeScript y regresiones de compras, permisos, aprobación/pago, clasificación y gastos recurrentes: aprobados.
- Advisors locales sin advertencias ni errores antes de generar la migración.
- Repetición del ensayo HU-59 con la nueva migración: importación idempotente, reversión, conflicto y restauración aprobados.

Los usuarios y registros de prueba son sintéticos y se eliminaron. La migración `20261011121615_hu60_owner_read_snapshot.sql` se generó con `db pull --local`; no modifica el proyecto Supabase de producción.

```sh
node scripts/test-stories.mjs lib/postgres/workspace.test.ts
python3 scripts/migration/test_hu55_local.py
# Con la vista previa local activa y el servidor en 127.0.0.1:3000:
npm exec --yes --package=supabase@2.120.0 -- node scripts/migration/test-hu60-read.mjs
```

## Pendiente

HU-60 no está completada. Faltan transacciones para guardar propiedades, facturas, distribuciones, pagos y auditoría; control de versiones y solicitudes repetidas; borrado y retención; todas las demás rutas; las vistas completas por rol de HU-58; y pruebas funcionales de todos los módulos. No se ampliaron los permisos DML para evitar saltar esas reglas mientras se portan.

El siguiente bloque debe implementar escritura y auditoría atómicas con pruebas de concurrencia y reversión, y conservar los tokens de versión heredados detectados en HU-59. El corte productivo también depende del respaldo íntegro, identidades verificadas y conciliación real de HU-53/57/59.
