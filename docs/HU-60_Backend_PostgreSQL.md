# HU-60 · Backend PostgreSQL

11 de octubre de 2026. Estado: **En desarrollo**. Lectura de propiedades/contabilidad y una primera escritura acotada —cambio de nombre con auditoría— implementadas y probadas localmente. No se conectaron todas las pantallas ni hubo cambios en producción. Las vistas previas HTTP están desactivadas al finalizar los ensayos.

## Implementación

`GET /api/properties` y `GET /api/accounting` pueden obtener datos desde PostgreSQL cuando la autenticación es Supabase y se habilita explícitamente `REHAB_POSTGRES_READ_PREVIEW=1`. Esta opción exige la API local `http://127.0.0.1:54321` y origen de aplicación localhost/127.0.0.1. Sin ella las solicitudes autenticadas continúan devolviendo 503. El modo Sites conserva su backend D1 actual.

La opción estuvo activa únicamente durante las pruebas y se retiró al terminar. No se suben archivos `.env` ni claves. Para reproducir el ensayo, añadir temporalmente esa variable a `.env.local`, iniciar el servidor con `./node_modules/.bin/vite --host 127.0.0.1 --port 3000 --strictPort` y ejecutar el script HTTP indicado abajo; retirar la variable y reiniciar el servidor al finalizar (la configuración se carga al arrancar). La portada sigue redirigiendo a Cuenta: este bloque prueba los contratos HTTP, todavía no ofrece una interfaz de operación con PostgreSQL.

El servidor verifica la cuenta con `getUser()` y consulta la RPC `owner_workspace_snapshot()` usando la sesión del usuario y la clave publicable. No utiliza `service_role` en solicitudes de la aplicación. La RPC no recibe un propietario del cliente: aplica `auth.uid()` y RLS. Usa SECURITY INVOKER, `search_path` vacío, permiso EXECUTE solo para authenticated y ningún permiso nuevo de escritura.

Una sola sentencia SQL estable reúne propiedades, libro, cabeceras, líneas, distribuciones, historial de clasificación y saldos iniciales bajo la misma instantánea de lectura. Evita mezclar versiones al ejecutar consultas REST separadas y evita recortar el libro al límite de 1.000 filas de Data API. Devuelve un objeto JSON agregado; se deberá evaluar memoria/latencia con el volumen real en HU-65.

El adaptador `lib/postgres/workspace.ts` mantiene libros heredados incrustados y reconstruye los normalizados (`invoiceStorage=1`) con líneas y distribuciones. Usa los IDs y la propiedad de las columnas relacionales, conserva el historial, toma las versiones de las columnas temporales y calcula el resumen de preservación. Las propiedades conservan la proyección existente de ejecución de obra. No modifica la instantánea recibida.

La respuesta HTTP incluye `readOnly: true` y encabezados sin caché. El middleware deja pasar estas dos lecturas y la ruta acotada de cambio de nombre hacia sus verificaciones locales. PUT/DELETE de propiedades, POST contable, rutas restantes y consultas de colaboradores con `grantId` permanecen bloqueadas; una identidad Supabase nunca llega a escrituras D1.

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

El siguiente bloque debe extender la escritura y auditoría atómicas al resto de operaciones y conservar los tokens de versión heredados detectados en HU-59. El corte productivo también depende del respaldo íntegro, identidades verificadas y conciliación real de HU-53/57/59.


## Segunda entrega · Cambio de nombre transaccional

`PATCH /api/properties/name` admite únicamente `id`, `version`, `name`, `reason` y `requestId`. Verifica la sesión, el origen exacto y la opción local `REHAB_POSTGRES_WRITE_PREVIEW=1`. No recibe actor ni propietario del cliente. El motivo es obligatorio. Las versiones deben tener zona explícita y se envían sin redondear microsegundos.

La RPC `rename_owned_property` llama una función interna en `access_private`: obtiene el propietario de `auth.uid()`, bloquea la fila propia, comprueba versión y registro de eliminación, preserva el respaldo/saldos iniciales cuando todavía no existe proyecto, cambia únicamente el nombre, agrega el historial de identidad y registra la auditoría. Todo ocurre en una transacción. No acepta JSON arbitrario ni modifica importes, aprobación, pagos o presupuesto. No se conceden permisos DML directos.

La función interna usa SECURITY DEFINER con alcance explícito para permitir únicamente esa operación y su auditoría sin abrir las tablas a modificaciones directas. No está en un esquema expuesto; EXECUTE está restringido, `search_path` es vacío, la zona horaria es UTC y la función pública usa SECURITY INVOKER. La protección de propietario y la validación también se ejecutan dentro de PostgreSQL, por lo que llamar la RPC directamente no permite omitirlas. La opción de vista previa limita el endpoint HTTP; no sustituye los permisos de la RPC, que existe en la base local una vez aplicada la migración.

El identificador de solicitud queda ligado al propietario y al comando en el registro de auditoría. Reintentar el mismo comando devuelve el resultado original sin duplicarlo; reutilizarlo con datos distintos causa conflicto. Un bloqueo por solicitud y otro por propiedad resuelven envíos simultáneos. Una edición con versión antigua responde 409. El actor y la fecha se generan en la base. El respaldo previo ya existente se conserva; si se crea por primera vez desde PostgreSQL, contiene su JSON canónico, no pretende reconstruir los bytes originales de D1 que debe conservar HU-53/59.

Validación de esta entrega:

- 15 pruebas HTTP/API aprobadas: origen, identidad, motivo, actualización, repetición con zona equivalente, conflicto por solicitud/versión, carreras de edición y de reintento, auditoría única, respaldo/saldo, importes intactos, RPC anónima y escritura directa bloqueadas.
- 13 comprobaciones SQL nuevas, incluidas auditoría y respaldo atómicos. Un trigger temporal provocó un fallo de auditoría y se comprobó que el nombre y la creación del respaldo/proyecto se revierten por completo; el trigger desaparece con el rollback del ensayo.
- 58 comprobaciones SQL locales y las mismas 58 al reconstruir las migraciones. TypeScript aprobado y advisors sin advertencias ni errores.
- Con la opción retirada y el servidor reiniciado, el endpoint autenticado devuelve 503: la vista previa HTTP queda apagada.

Migración local: `20261011172554_hu60_property_name_transaction.sql`. No hay cambio de interfaz todavía: el editor general sigue usando PUT y permanece bloqueado con Supabase. Para probar esta operación se usa el endpoint acotado, no la pantalla de edición.

```sh
# Con REHAB_POSTGRES_WRITE_PREVIEW=1 en .env.local y servidor local reiniciado:
npm exec --yes --package=supabase@2.120.0 -- node scripts/migration/test-hu60-write.mjs
# Retirar la opción, reiniciar el servidor y comprobar el bloqueo:
npm exec --yes --package=supabase@2.120.0 -- node scripts/migration/test-hu60-write.mjs --expect-disabled
```

HU-60 sigue En desarrollo. Esta transacción no equivale a haber portado el guardado completo de propiedades, facturas o pagos, y no resuelve todavía los tokens `fecha-UUID` heredados de HU-59. Producción no fue modificada.
