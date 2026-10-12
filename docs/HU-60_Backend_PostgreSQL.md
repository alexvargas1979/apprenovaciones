# HU-60 · Backend PostgreSQL

11 de octubre de 2026. Estado: **En desarrollo**. Lectura de propiedades/contabilidad y escrituras acotadas de cambio de nombre, guardado calculado y duplicación de escenarios con auditoría implementadas y probadas localmente. No se conectaron todas las pantallas ni hubo cambios en producción. Las vistas previas HTTP están desactivadas al finalizar los ensayos.

## Implementación

`GET /api/properties` y `GET /api/accounting` pueden obtener datos desde PostgreSQL cuando la autenticación es Supabase y se habilita explícitamente `REHAB_POSTGRES_READ_PREVIEW=1`. Esta opción exige la API local `http://127.0.0.1:54321` y origen de aplicación localhost/127.0.0.1. Sin ella las solicitudes autenticadas continúan devolviendo 503. El modo Sites conserva su backend D1 actual.

La opción estuvo activa únicamente durante las pruebas y se retiró al terminar. No se suben archivos `.env` ni claves. Para reproducir el ensayo, añadir temporalmente esa variable a `.env.local`, iniciar el servidor con `./node_modules/.bin/vite --host 127.0.0.1 --port 3000 --strictPort` y ejecutar el script HTTP indicado abajo; retirar la variable y reiniciar el servidor al finalizar (la configuración se carga al arrancar). La portada sigue redirigiendo a Cuenta: este bloque prueba los contratos HTTP, todavía no ofrece una interfaz de operación con PostgreSQL.

El servidor verifica la cuenta con `getUser()` y consulta la RPC `owner_workspace_snapshot()` usando la sesión del usuario y la clave publicable. No utiliza `service_role` en solicitudes de la aplicación. La RPC no recibe un propietario del cliente: aplica `auth.uid()` y RLS. Usa SECURITY INVOKER, `search_path` vacío, permiso EXECUTE solo para authenticated y ningún permiso nuevo de escritura.

Una sola sentencia SQL estable reúne propiedades, libro, cabeceras, líneas, distribuciones, historial de clasificación y saldos iniciales bajo la misma instantánea de lectura. Evita mezclar versiones al ejecutar consultas REST separadas y evita recortar el libro al límite de 1.000 filas de Data API. Devuelve un objeto JSON agregado; se deberá evaluar memoria/latencia con el volumen real en HU-65.

El adaptador `lib/postgres/workspace.ts` mantiene libros heredados incrustados y reconstruye los normalizados (`invoiceStorage=1`) con líneas y distribuciones. Usa los IDs y la propiedad de las columnas relacionales, conserva el historial, toma las versiones de las columnas temporales y calcula el resumen de preservación. Las propiedades conservan la proyección existente de ejecución de obra. No modifica la instantánea recibida.

La respuesta HTTP incluye `readOnly: true` y encabezados sin caché. El middleware deja pasar estas dos lecturas y las rutas acotadas de cambio de nombre y duplicación de escenarios hacia sus verificaciones locales. PUT/DELETE de propiedades, POST contable, rutas restantes y consultas de colaboradores con `grantId` permanecen bloqueadas; una identidad Supabase nunca llega a escrituras D1.

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

Migración local: `20261011172554_hu60_property_name_transaction.sql`. En esa segunda entrega no había cambio de interfaz: el editor general sigue usando PUT y permanece bloqueado con Supabase. Para probar esta operación se usa el endpoint acotado, no la pantalla de edición.

```sh
# Con REHAB_POSTGRES_WRITE_PREVIEW=1 en .env.local y servidor local reiniciado:
npm exec --yes --package=supabase@2.120.0 -- node scripts/migration/test-hu60-write.mjs
# Retirar la opción, reiniciar el servidor y comprobar el bloqueo:
npm exec --yes --package=supabase@2.120.0 -- node scripts/migration/test-hu60-write.mjs --expect-disabled
```

HU-60 sigue En desarrollo. Esta transacción no equivale a haber portado el guardado completo de propiedades, facturas o pagos, y no resuelve todavía los tokens `fecha-UUID` heredados de HU-59. Producción no fue modificada.

## Tercera entrega · Duplicación transaccional de escenarios

11 de octubre de 2026. `POST /api/scenarios/duplicate` admite `propertyId`, `sourceId`, `version`, `bookVersion` (null si no existe libro), `label` y `requestId`. Se verifica la cuenta, el origen y la misma opción local `REHAB_POSTGRES_WRITE_PREVIEW=1`. No admite un resultado calculado ni un snapshot enviado por el cliente.

La RPC `duplicate_owned_scenario` copia directamente el JSON del escenario existente de la misma propiedad y propietario, conserva `source_id`, motor y resultados históricos, y registra la auditoría en la misma transacción. No recalcula rentabilidad ni modifica la base aprobada. La función interna está en `access_private`, con SECURITY DEFINER acotado, identidad obtenida de `auth.uid()`, `search_path` vacío, zona UTC y EXECUTE restringido; la envoltura pública es SECURITY INVOKER. No se concedieron permisos INSERT directos sobre escenarios.

Bloquea la propiedad para comprobar su versión y el límite de 50 escenarios. Verifica la versión contable y bloquea en lectura un libro existente. La solicitud repetida se serializa por propietario/requestId y devuelve el mismo ID; cambiar su contenido causa conflicto. La futura escritura general del libro debe coordinar el caso de creación de un libro que todavía no existe: hoy esas escrituras siguen bloqueadas y duplicar copia un resultado histórico, no un cálculo que dependa de ese libro nuevo.

Validación:

- 13 pruebas SQL nuevas: copia íntegra, base aprobada intacta, auditoría, repetición, conflictos de solicitud/propiedad/libro, fuente ajena, límite, permisos y reversión completa ante un fallo provocado en auditoría.
- 13 pruebas HTTP/API: origen, identidad, etiqueta, rechazo de snapshot inyectado, creación/repetición, concurrencia, conservación de fuente/resultados y escritura directa bloqueada. Con 49 escenarios, dos solicitudes simultáneas producen una creación y un conflicto; total final 50.
- 71 comprobaciones SQL locales y las mismas 71 sobre una base reconstruida. TypeScript aprobado. Advisors sin advertencias ni errores.
- La opción de escritura HTTP se retiró al concluir y se reinició el servidor para comprobar respuesta 503 con una sesión válida.

Migración: `20261011173336_hu60_scenario_duplicate.sql`. Las pruebas usan únicamente cuentas y registros sintéticos, eliminados al terminar. No hubo publicación ni migración productiva.

```sh
# Con vista previa local de escritura activa:
npm exec --yes --package=supabase@2.120.0 -- node scripts/migration/test-hu60-scenarios.mjs
# Después de quitarla y reiniciar:
npm exec --yes --package=supabase@2.120.0 -- node scripts/migration/test-hu60-scenarios.mjs --expect-disabled
```

La tercera entrega todavía no conectaba el botón de duplicar de la interfaz a la nueva ruta ni porta guardar, aprobar o calcular pruebas de estrés. El POST general de escenarios permanece bloqueado en modo Supabase. HU-60 continúa En desarrollo; faltan también guardado general de propiedades, facturas y pagos, tokens de versión heredados y validación integral de módulos.


## Cuarta entrega · Pantalla de ensayo local

11 de octubre de 2026. Se agregó `/ensayo`, accesible desde Mi cuenta únicamente con `REHAB_POSTGRES_READ_PREVIEW=1`, proveedor Supabase y los orígenes locales ya establecidos. El indicador de escritura exige además `REHAB_POSTGRES_WRITE_PREVIEW=1`. Cada endpoint conserva sus propios controles; ocultar botones no sustituye autorización.

La pantalla permite seleccionar una propiedad, cambiar su nombre con motivo y duplicar un escenario mediante las transacciones anteriores. Muestra carga, cuenta vacía, confirmación, errores y límites; mantiene los campos al fallar y reutiliza el identificador del mismo comando ante un reintento sin recarga. Recargar descarta los campos sin guardar. Un guardado confirmado se indica aunque falle la lectura posterior. Las funciones generales pendientes se identifican en pantalla.

`GET /api/preview/scenarios` exige propietario mediante la lectura protegida y RLS. Devuelve únicamente metadatos, base aprobada y tokens de versión; consulta hasta 51 filas y rechaza más de 50 para evitar una lista truncada. La lectura de cartera y la de escenarios son consultas separadas: el listado no representa una instantánea conjunta; duplicar vuelve a verificar las versiones dentro de su transacción. Renombrar usa la versión de la propiedad efectivamente mostrada, sin sustituirla por un token de otra lectura posterior.

Validación de esta entrega:

- TypeScript y compilación de producción aprobados.
- 6 comprobaciones HTTP nuevas: autenticación, propietario ajeno, metadatos y tokens, enlace desde cuenta, renderizado de la pantalla y redirección de visitantes.
- Repetidas con éxito las 15 comprobaciones de renombrado y 13 de duplicación.
- 3 comprobaciones con las opciones retiradas y el servidor reiniciado: API 503, pantalla deshabilitada y enlace ausente en Mi cuenta.
- La prueba Playwright de formularios, reintento tras respuesta perdida, conflicto, cuenta vacía y diseño móvil está preparada pero **no validada**: Chrome abortó al iniciar en el entorno restringido (SIGABRT/EPERM). No se obtuvieron capturas ni se afirma validación visual o de interacción en navegador.
- Sólo se usaron usuarios y registros sintéticos, eliminados al terminar. No se cambiaron esquema, producción ni permisos SQL. Las opciones temporales se retiraron al concluir.

Prueba reproducible (servidor local con ambas opciones activadas):

```sh
# SUPABASE_CLI puede indicar el ejecutable local instalado.
node scripts/migration/test-hu60-preview.mjs --http-only
# Con Playwright disponible; PLAYWRIGHT_MODULE y CHROME_PATH admiten rutas explícitas:
node scripts/migration/test-hu60-preview.mjs
# Tras retirar opciones y reiniciar el servidor:
node scripts/migration/test-hu60-preview.mjs --http-only --expect-disabled
```

HU-60 permanece En desarrollo. Próximo paso: ejecutar la validación de interacción pendiente y continuar las escrituras del expediente y las operaciones financieras; todavía no están portados guardar/aprobar escenarios, pruebas de estrés, facturas, pagos ni todos los tokens heredados.


## Quinta entrega · Interacciones y reintentos del formulario

11 de octubre de 2026. Se ejecutó el componente real en React con jsdom 26.1.0 y API simulada. Las 12 comprobaciones cubren carga de propiedad/base aprobada, renombrado con el token mostrado, duplicación, respuesta perdida, conflicto y recarga, consulta sin escritura, cuenta vacía, ausencia de escenarios, límite de 50, cambio de propiedad y fallo de lectura posterior a una escritura confirmada.

Se reprodujo un defecto adicional: después de perder la respuesta de una duplicación, editar y enviar otro comando y volver al original generaba un requestId nuevo, con riesgo de crear otra copia. La pantalla ahora conserva un identificador por comando no resuelto durante su montaje y lo elimina al recibir confirmación. La prueba primero falló con cuatro escenarios en lugar de tres; después de la corrección pasa y verifica el mismo requestId al volver al comando original. Se reforzó además la comprobación de modo de escritura, carga y propiedad seleccionada antes de enviar.

Estas pruebas usan transporte simulado: validan el comportamiento del componente, no sustituyen las pruebas HTTP/RLS anteriores ni prueban presentación visual. No hubo nuevos cambios SQL, conexión a producción ni modificación de datos. La comprobación visual y la prueba integral en Chrome siguen pendientes. HU-60 continúa En desarrollo.

Reproducción desde la raíz de la aplicación, con jsdom 26.1.0 disponible (sin cambiar las dependencias de producción):

```sh
# JSDOM_MODULE puede ser la ruta absoluta a jsdom/lib/api.js.
node scripts/migration/test-hu60-preview-dom.mjs
```

Validación: 12 pruebas de interacción aprobadas, TypeScript y build aprobados. Los identificadores de reintento se conservan sólo mientras esta pantalla permanece montada; cerrar o recargar la página requiere revisar la lista antes de volver a crear una copia. Pendientes siguientes: revisión visual y escrituras completas del expediente, escenarios y contabilidad.


## Sexta entrega · Consulta de cifras históricas de escenarios

11 de octubre de 2026. Cada escenario de `/ensayo` ofrece «Ver detalle». La consulta muestra compra, ARV, remodelación, intereses, cargos financieros, costo total, utilidad, margen, fecha de guardado y observaciones/datos pendientes registrados. También funciona en modo de sólo lectura.

El detalle usa `GET /api/preview/scenarios?propertyId=…&id=…`. Mantiene la autorización del propietario, RLS, restricción al entorno local y `no-store`; exige que el escenario pertenezca a la propiedad solicitada. Devuelve una proyección acotada del JSON histórico, sin enviar el expediente completo ni recalcular el resultado. Los campos ausentes, no numéricos o no finitos se muestran como «No registrado», conservando correctamente ceros y cantidades negativas. Si no existe una revisión histórica de datos pendientes, se indica expresamente. La fecha se muestra en la zona de Atlanta.

La vista permite cerrar o reintentar la consulta. Al cambiar de propiedad se desmonta el detalle; una respuesta anterior tardía no puede poblar la nueva selección. No se añadieron escrituras, permisos SQL ni migraciones.

Validación:

- 13 comprobaciones HTTP locales aprobadas (7 nuevas para detalle): visitante sin sesión, propietario ajeno, datos históricos, escenario inexistente, ID vacío, cruce de propiedades del mismo dueño y conservación del resultado.
- 16 comprobaciones React/jsdom aprobadas (4 nuevas): detalle en modo de consulta, cierre, error/reintento y respuesta tardía tras cambiar de propiedad. Transporte simulado; no equivalen a inspección visual.
- Prueba de proyección aprobada: ceros, negativos, campos inválidos/ausentes, observaciones incompletas y preservación del objeto original.
- TypeScript y compilación aprobados. Con las opciones retiradas y servidor reiniciado, 4 comprobaciones HTTP de desactivación aprobadas, incluida la nueva consulta de detalle.
- Cuentas y datos sintéticos eliminados. Opciones de ensayo retiradas. Producción intacta.

HU-60 continúa En desarrollo. Esta consulta no porta guardar/aprobar escenarios, pruebas de estrés ni escrituras generales del expediente y la contabilidad. La revisión visual en navegador sigue pendiente.


## Séptima entrega · Guardado de escenarios calculados por el servidor

11 de octubre de 2026 (migración generada el 12 de octubre UTC). La pantalla local incorpora «Guardar nuevo escenario», a partir del análisis de inversión ya almacenado en la propiedad. No crea ni edita los supuestos del análisis y no aprueba la base. Un análisis sin configurar devuelve un mensaje; un análisis válido pero incompleto conserva sus avisos y datos pendientes, como en el flujo original.

`POST /api/scenarios/save` admite únicamente propiedad, versiones de propiedad/libro, nombre y requestId. Exige usuario confirmado mediante getUser(), origen exacto, ambas opciones de ensayo y Supabase local. Lee la cartera con la sesión del propietario y calcula en el servidor con el motor existente y los gastos conciliados. El navegador no puede proporcionar actor, snapshot ni resultados financieros.

Para evitar que un cliente invoque una RPC con resultados inventados, `save_computed_scenario` sólo concede EXECUTE a `service_role` (y al administrador PostgreSQL). Usa una envoltura SECURITY INVOKER y una función interna en `access_private`, con search_path vacío, verificación de identidad activa/confirmada y comprobación de propietario. La cuenta de servidor no recibe INSERT directo sobre escenarios. La ruta utiliza exclusivamente una clave de servidor en `SUPABASE_SECRET_KEY`, nunca una clave enviada al cliente. Se comprobó que no aparezca en los archivos compilados. Referencia: [claves de servidor de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

La RPC guarda escenario y auditoría de forma atómica, conserva la base aprobada, bloquea la propiedad y un libro existente, comprueba versiones y respeta el máximo concurrente de 50 escenarios. Un recibo por actor/requestId permite responder al reintento antes de recalcular, incluso cuando la propiedad ya cambió. Un comando distinto con el mismo requestId se rechaza. Sigue pendiente coordinar la creación de libros antes inexistentes cuando se implementen las escrituras contables generales; actualmente permanecen bloqueadas.

Migración: `20261012001332_hu60_scenario_save.sql`, generada mediante `db pull --local` después de aplicar y revisar el SQL local. Advisors sin incidencias y lista de migraciones local sincronizada. No se ejecutó ninguna operación remota.

Validación de la entrega:

- 10 comprobaciones SQL nuevas: permisos de función, recibo/repetición, conflictos de comando y versiones, identidad, auditoría única, reversión ante fallo de auditoría y ausencia de INSERT directo. Total 81 locales y las mismas 81 sobre una base reconstruida.
- 14 pruebas HTTP de guardado: identidad/origen, rechazo de actor y resultados inyectados, propietario, versión, resultado calculado, reintento después de edición, RPC directa denegada, auditoría y concurrencia. Dos guardados distintos con 49 escenarios terminan en 201/409 y exactamente 50 filas.
- 13 regresiones HTTP de duplicación aprobadas; 18 pruebas de interacción React/jsdom aprobadas, incluidas las del nuevo formulario. Estas últimas simulan la API; revisión visual en navegador pendiente.
- TypeScript/build aprobados. Ensayo HU-59 de 20 tablas/20 filas, repetición sin duplicados, conflicto, fallo/reversión e importación/restauración aprobado con la nueva migración.
- Tras retirar opciones y clave temporal y reiniciar el servidor, guardado autenticado devuelve 503. Datos y usuarios sintéticos eliminados. Producción intacta.

Para ensayar localmente, configurar las dos opciones de vista previa y `SUPABASE_SECRET_KEY` del Supabase **local** en el archivo ignorado `.env.local`; nunca en `VITE_*`, componentes ni configuración versionada. El emulador de Workers carga el secreto desde ese archivo, sin añadirlo a las variables públicas de Vite. Ejecutar `scripts/migration/test-hu60-save.mjs` con el CLI local disponible; `--expect-disabled` comprueba el bloqueo al retirar las opciones. Al concluir esta entrega se retiraron esos tres valores temporales.

HU-60 sigue En desarrollo. Pendientes: guardar/editar el expediente y sus supuestos de inversión, aprobar escenarios, pruebas de estrés, escrituras contables, versiones heredadas e integración completa. Esta entrega habilita guardar una nueva instantánea de un análisis previamente almacenado; no completa toda la migración.


## Octava entrega · Aprobación de la base del análisis

11 de octubre de 2026 (migración del 12 UTC). La pantalla local ofrece «Fijar la base del análisis» cuando no existe una base. Requiere nombre y confirmación explícita. Calcula una nueva versión con el análisis actual, igual que la aprobación del flujo original; no convierte automáticamente un escenario histórico seleccionado. Después de aprobar, el formulario desaparece y se identifica la base conservada. Se pueden seguir guardando versiones de pronóstico.

`POST /api/scenarios/approve` reutiliza el servicio de cálculo de guardado, con `confirm: true` obligatorio y controles de sesión, origen, modo local, versiones y propietario. No acepta actor ni resultados del navegador. Rechaza los datos pendientes del motor y los errores de comparación de salidas antes de escribir.

`approve_computed_scenario` sólo puede ejecutarse con la cuenta de servidor. Su función privada verifica además que el resultado registre `missing: []` y que la comparación, si existe, no tenga errores. En una transacción crea escenario, base y auditoría. El bloqueo de propiedad serializa las aprobaciones; una base existente causa conflicto y nunca se reemplaza. El recibo permite reintentos del mismo comando sin crear otro escenario, incluso después de una edición posterior. Los permisos directos de las tablas no se ampliaron.

Migración `20261012002140_hu60_scenario_approve.sql`, generada localmente después de revisar advisors (sin incidencias). El servicio compartido está en `lib/postgres/computed-scenario-server.ts`; guardado y aprobación conservan sus endpoints separados.

Validación:

- 9 comprobaciones SQL nuevas: función restringida, análisis/comparación incompletos, fallo de auditoría con reversión de escenario y base, recibo, protección de base existente, auditoría única y falta de INSERT directo. Total 90 locales y 90 al reconstruir las migraciones.
- 17 pruebas HTTP de aprobación: confirmación, datos pendientes, identidad/origen, inyección de actor/resultados, versiones, cálculo, reintento, RPC directa, base única y aprobaciones concurrentes.
- 14 regresiones HTTP de guardado y 20 comprobaciones React/jsdom aprobadas. Estas últimas simulan el transporte; revisión visual y flujo integral de navegador aún pendientes.
- TypeScript/build y ensayo HU-59 de 20 tablas/20 filas, reversión, repetición y restauración aprobados. Se verificó que la clave del servidor no aparezca en el build.
- Opciones y clave temporal retiradas; después de reiniciar, la aprobación autenticada devuelve 503. Se eliminaron cuentas y datos ficticios. Producción no fue modificada.

Prueba reproducible: `node scripts/migration/test-hu60-approve.mjs` con el servidor y las opciones locales de la entrega anterior; `--expect-disabled` verifica el bloqueo final. La aprobación usa la misma clave local de servidor, nunca una clave pública ni configuración enviada al navegador.

HU-60 permanece En desarrollo. Siguiente bloque: pruebas de estrés de escenarios; siguen pendientes edición general del expediente/supuestos, escrituras contables, tokens heredados y validación visual completa.
