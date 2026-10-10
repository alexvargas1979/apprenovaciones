# HU-53 y HU-54 · Inicio de migración

Fecha: 10 de octubre de 2026. Estado: en desarrollo; no completadas.

## Decisión del propietario

Reservar el proyecto Supabase `apprenovaciones` para producción y ensayar localmente. No se han creado tablas, usuarios ni buckets en el proyecto remoto.

## HU-53: evidencia del origen real

Se inspeccionó la base productiva de Sites por el conector de solo lectura. Tiene 14 tablas, frente a 20 tablas en el código actual de GitHub. Las tablas de gastos locales no están en producción; no se deben aplicar los supuestos del esquema local a la exportación productiva.

Se observaron 2 propiedades, 2 proyectos de inversión, 2 eventos de auditoría, 1 respaldo original y 1 documento. El libro contable, escenarios, líneas base de análisis, saldos iniciales, contribuciones/equipo e importaciones Excel no devolvieron filas. Son lecturas en instantes sucesivos, no una instantánea transaccional. No se consultaron las tablas retiradas `settings` y `attom_receipts`, para no recuperar credenciales innecesarias.

La herramienta recortó 2 valores de propiedades y 1 de auditoría. Por tanto, estas lecturas NO son un respaldo restaurable. El resumen sin datos personales está en `docs/migration/inventario-produccion-resumen.json`. No contiene nombres, direcciones, identificadores de usuarios ni contenido de facturas.

### Trabajo realizado

- Auditor SQLite en `scripts/migration/audit_snapshot.py`: abre el origen en modo lectura, usa la API de backup para capturar una copia consistente, reabre la copia y comprueba integridad, claves foráneas y JSON. Genera manifiesto con SHA-256, fecha, entorno, columnas y conteos, sin contenido de filas.
- Validación auxiliar de páginas del conector: rechaza campos truncados, tablas ausentes, saltos de paginación y exportaciones incompletas.
- Cuatro pruebas automáticas: copia/restauración fiel con datos ficticios, prohibición de sobrescritura, JSON inválido/referencias huérfanas y páginas incompletas/truncadas.
- Exportaciones y estados locales excluidos de Git mediante `.gitignore`.

### Pendiente para cerrar HU-53

Obtener una exportación completa autorizada de D1 y el archivo real de R2, verificar su hash y restaurarlos en ensayo aislado. La herramienta actual de lectura de Sites no ofrece una exportación íntegra ni descarga de objetos R2. Debe habilitarse una exportación soportada desde la administración de Sites o un endpoint de exportación autorizado; este último necesita despliegue, actualmente bloqueado. No sustituir el origen por los datos ficticios de desarrollo ni importar campos recortados.

La conciliación financiera, el mapeo de identidades y los objetos huérfanos siguen pendientes de ese respaldo. Las dos tablas retiradas se documentan por separado; nunca migrar su clave de ATTOM a Supabase.

## HU-54: destino confirmado

El conector Supabase respondió correctamente. Proyecto `apprenovaciones`, región `us-east-2`, PostgreSQL 17.11, estado activo. Una consulta de solo lectura confirmó 0 tablas de aplicación en public, 0 usuarios de Auth, 0 buckets y 0 objetos. El asesor de seguridad no devolvió avisos; esto no demuestra seguridad de un esquema que todavía no existe.

[Dashboard del proyecto de producción](https://supabase.com/dashboard/project/slxcjatghmsrkxiyinkw)

Se inicializó configuración local con Supabase CLI 2.120.0, PostgreSQL 17, identificador `apprenovaciones-local`, sin vínculo con producción. Las nuevas tablas requieren GRANT explícito; las altas públicas están deshabilitadas y se exige confirmar correo. Los callbacks locales apuntan a `/auth/callback`; aún no está implementado ese flujo en la app.

### Alojamiento e identidad

La app actual usa Sites/Workers, y Sites controla la autenticación exterior. Supabase Auth requiere validar cookies, callback, refresco y protección del servidor en Vinext. No se ha confirmado que pueda reemplazarse la puerta de acceso de Sites sin doble inicio de sesión. Mantener Sites sin modificar mientras se ensaya; la selección de alojamiento externo requiere decisión y configuración posterior. GitHub aloja el código y no sustituye el backend.

### Pendiente para cerrar HU-54

Verificar arranque local, consultas, Auth/Storage, cookies y sesión desde el runtime de la app; definir alojamiento y dominio de producción, SMTP, costos/límites, RPO/RTO y retención. No se ha contratado ningún plan ni importado datos de producción.

## Ensayo reproducible

Desde la raíz del proyecto:

```sh
python3 -m unittest discover -s scripts/migration -p 'test_*.py'
npm exec --yes --package=supabase@2.120.0 -- supabase start
```

Docker Desktop debe estar funcionando. La CLI puede necesitar descargar imágenes. No ejecutar `supabase link`, `db push` o `db reset --linked` contra producción en este bloque.

Cuando exista una exportación SQLite completa, guardarla en `migration-private/` (ignorado por Git), y ejecutar:

```sh
python3 scripts/migration/audit_snapshot.py \
  --source migration-private/origen.sqlite \
  --destination migration-private/copia-verificada.sqlite \
  --environment production-export
```

La marca `production_ready` permanece falsa: este auditor no verifica los bytes de R2, la autenticación, totales contables ni el corte. Es un control previo, no una autorización de migración. No publicar manifiestos con datos privados sin revisar su contenido.

## Referencias

- [SSR y sesiones](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
- [Supabase local](https://supabase.com/docs/guides/local-development).
- [Control por filas](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Resultado del ensayo local

Supabase local arrancó correctamente con PostgreSQL 17.11, Auth, Storage y Studio. Se ejecutó `node scripts/migration/smoke-local-supabase.mjs` con SDK `@supabase/supabase-js` fijado en 2.117.3. Diez comprobaciones pasaron: registro público denegado, contraseña incorrecta denegada, login correcto, identidad validada en servidor, renovación de sesión, descarga anónima denegada, descarga sin permiso denegada, SHA-256 idéntico, descarga firmada y cierre de sesión.

La prueba usa credenciales locales obtenidas en memoria y se niega a operar fuera de `127.0.0.1:54321`. Crea únicamente un usuario y un bucket sintéticos con nombre aleatorio; los elimina al terminar. La consulta posterior confirmó 0 usuarios, 0 buckets y 0 objetos. No envía correos externos. Aún no prueba la matriz de permisos de negocio, el flujo SSR de Vinext ni producción.

Se corrigió la configuración de Auth: el proveedor de correo debe estar activo (`auth.email.enable_signup=true`) mientras el registro público queda bloqueado a nivel global (`auth.enable_signup=false`); el ensayo comprobó ambas condiciones. La descarga inicial de imágenes tuvo límites temporales del registro, pero completó el arranque.

Studio local: http://127.0.0.1:54323. La base está vacía de datos de aplicación; el esquema de negocio corresponde a HU-55. Se mantiene el entorno local disponible para continuar. Para detener solo este entorno conservando los datos:

```sh
npm exec --yes --package=supabase@2.120.0 -- supabase stop --project-id apprenovaciones-local
```

Las cuatro pruebas del auditor SQLite también pasaron. No se produjo un respaldo de producción ni se deben marcar estas dos historias como completadas.
