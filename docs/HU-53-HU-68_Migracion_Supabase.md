# HU-53 a HU-68 · Migración a Supabase

Fecha: 10 de octubre de 2026. Estado: HU-53 y HU-54 en desarrollo; HU-55 en verificación local; HU-56 a HU-68 pendientes. Producción reservada; ensayos locales. No se han movido datos productivos ni cambiado la autenticación. [Avance y bloqueos](HU-53-HU-54_Inicio_migracion.md).

## Objetivo y alcance

Usar Supabase PostgreSQL para los datos, Supabase Storage para archivos y Supabase Auth para las cuentas. Permitir al administrador consultar la base desde el Dashboard con tablas y consultas legibles. Mantener los módulos y cálculos existentes.

Origen revisado: `db/schema.ts`, `db/index.ts`, `app/chatgpt-auth.ts`, `lib/server.ts`, `lib/files.ts`, `lib/documents.ts`, `lib/team.ts` y `lib/expense-access-server.ts`. La revisión fue de código, no una lectura de la base productiva. El repositorio GitHub incluye cambios locales posteriores a Sites v14; debe verificarse qué esquema y datos existen realmente antes de migrar.

## Arquitectura propuesta

| Componente | Actual | Destino |
| --- | --- | --- |
| Interfaz | React + TypeScript + Vinext | Conservar, validar integración SSR |
| Datos | D1 / SQLite + Drizzle y SQL directo | Supabase PostgreSQL con migraciones y transacciones |
| Archivos | Cloudflare R2 | Bucket privado en Supabase Storage |
| Identidad | Encabezados de Sites/ChatGPT | Supabase Auth + sesiones verificadas en servidor |
| Permisos | Controles del servidor y concesiones del equipo | Controles del servidor + RLS y políticas de Storage |
| Administración | Sin panel directo de BD en la app | Supabase Dashboard y consultas documentadas |
| Alojamiento | Sites / Cloudflare Workers | Decidir en HU-54; Supabase no sustituye por sí solo el alojamiento del frontend |

Modelo inicial: una cartera por propietario, manteniendo colaboradores por propiedad/tarea/centro. No añadir multiorganización en esta migración. Los documentos serán privados. No habrá registro público indiscriminado de usuarios. No se implementan IA de facturas ni nuevas funciones de negocio dentro de esta ampliación.

## Inventario local: 20 tablas

- Expediente: `properties`, `property_documents`, `analysis_scenarios`, `analysis_baselines`, `property_baselines`, `investment_projects`, `opening_balances`.
- Contabilidad y trazabilidad: `accounting_books`, `audit_events`, `workbook_imports`.
- Equipo: `team_members`, `team_contributions`.
- Gastos: `expense_invoices`, `expense_lines`, `expense_allocations`, `expense_classification_history`, `expense_legacy_backup`, `expense_drafts`, `expense_reports`.
- Eliminación: `property_deletions`.

Muchos registros conservan payload JSON, incluso facturas normalizadas parcialmente. Proveedores, pagos y otras entidades del libro requieren mapeo interno, no solo copiar tablas. Se recomienda trasladar primero con fidelidad, normalizando columnas necesarias para permisos y consulta y manteniendo snapshots históricos. HU-63 convierte esa información en consultas útiles para el administrador.

## Decisiones previas al desarrollo

HU-53/HU-54 deben resolver: proyecto Supabase y región, ambientes, acceso a exportación productiva de Sites, alojamiento y dominio/callback, método de alta, SMTP, volumen de datos/archivos, presupuesto del servicio, ventana de corte, retención y objetivos RPO/RTO. Estas decisiones no impiden crear este plan; sí condicionan la ejecución y el corte.

## Orden de entrega

1. Diagnóstico y entorno: HU-53–54.
2. Modelo, acceso e identidad: HU-55–58.
3. Datos y backend: HU-59–60.
4. Archivos y administración: HU-61–64.
5. Ensayo y operación: HU-65 y preparación HU-67.
6. Corte: HU-66, activación HU-67 y cierre HU-68.

P0 significa necesario antes del corte; P1 es entrega operativa, también requerida para cerrar la migración. Las dependencias prevalecen sobre el orden numérico.

## Historias y criterios de aceptación

### HU-53 · Inventariar y respaldar la información actual

Como **administrador**, quiero **conocer y respaldar datos, usuarios y archivos antes de migrar**, para operar la plataforma con continuidad y control.

Estado: **En desarrollo**. Prioridad: **P0**. Dependencias: Ninguna.

- [ ] Inventario separado de producción (última publicación confirmada v14) y código local/GitHub: tablas, filas, versiones, propietarios, archivos y bytes. Las 20 tablas del esquema local no se asumen iguales a producción.
- [ ] Exportación autorizada de D1 y R2 con manifiesto, fecha de corte y hashes; restauración de una muestra en entorno aislado.
- [ ] Documentar acceso real a exportaciones de Sites; si no está disponible, marcar bloqueo antes de importar. No usar la base local de prueba como origen productivo.
- [ ] Detectar registros huérfanos, JSON inválido, IDs repetidos y campos sensibles; definir tratamiento sin eliminación silenciosa. Respaldos y datos reales fuera de GitHub.

### HU-54 · Preparar Supabase y validar el alojamiento

Como **administrador**, quiero **disponer de un entorno de prueba y una ruta viable de despliegue**, para operar la plataforma con continuidad y control.

Estado: **En desarrollo**. Prioridad: **P0**. Dependencias: HU-53.

- [ ] Registrar proyecto, región, ambientes de prueba/producción y responsable; confirmar plan, límites y costos antes de contratar recursos.
- [ ] Probar conexión HTTPS desde el runtime elegido, cookies, callback y refresco de Auth. Mantener React/TypeScript y comprobar Vinext; no asumir compatibilidad completa por parecer Next.js.
- [ ] Decidir alojamiento: probar si Sites permite Auth propio sin doble acceso; si no, documentar y preparar otra ruta de alojamiento como condición de salida. El bloqueo de publicación de Sites no se resuelve solo creando Supabase.
- [ ] Secretos solo en configuración del servidor; clave publicable en cliente, nunca secret/service_role. Versiones de SDK fijadas y lockfile. Entornos sin datos reales por defecto.

### HU-55 · Diseñar el modelo PostgreSQL y las migraciones

Como **administrador**, quiero **tener una estructura documentada y consultable**, para operar la plataforma con continuidad y control.

Estado: **En verificación**. Prioridad: **P0**. Dependencias: HU-53, HU-54.

- [x] Matriz para cada tabla origen: tabla/columna destino, tipo, clave, relación y transformación. Conservar IDs de negocio como texto salvo conversión validada; usar UUID de Auth para identidades nuevas.
- [x] Fechas en timestamptz con zona explícita, importes exactos numeric y reglas de redondeo/moneda; convertir JSON operativo a jsonb cuando corresponda y preservar respaldos originales como texto o archivo exacto.
- [x] Definir claves foráneas, unicidad e índices por propietario, propiedad, factura y fecha, incluyendo facturas distribuidas entre propiedades. No exponer libros completos a colaboradores.
- [x] Migraciones versionadas recrean una base vacía; diccionario de datos y diagrama aprobados técnicamente. ATTOM no se reactiva ni se importan sus credenciales.

Evidencia técnica local: [modelo, diccionario y pruebas](HU-55_Modelo_PostgreSQL.md). Criterios implementados para el esquema del código; cierre condicionado a contrastar la exportación íntegra de HU-53 y resolver HU-54. No implica aprobación de producción.

### HU-56 · Ingresar con Supabase Auth

Como **usuario**, quiero **iniciar y cerrar sesión sin depender de mi cuenta de ChatGPT**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-54.

- [ ] Flujo inicial propuesto: correo y contraseña, verificación de correo, recuperación y cierre de sesión; altas por invitación por defecto. Google queda como ampliación opcional.
- [ ] Validación de identidad en servidor, sesiones SSR con cookies y renovación; probar expiración, enlace usado/caducado, cambio de contraseña, callback inválido y retorno seguro.
- [ ] Sustituir getChatGPTUser y encabezados oai-authenticated-* como fuente de identidad en todas las rutas, páginas y descargas; petición sin sesión válida recibe 401.
- [ ] Configurar dominio/callback de prueba y producción y entrega de correo/SMTP; probar envío real con destinatarios autorizados antes de producción. Roles nunca desde user_metadata editable.

### HU-57 · Vincular usuarios existentes y conservar sus datos

Como **propietario**, quiero **recuperar mis propiedades al entrar con Supabase**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-53, HU-55, HU-56.

- [ ] Tabla de correspondencia privada entre ID anterior e ID de auth.users; cobertura del 100% de propietarios y colaboradores migrados o excepción bloqueante documentada.
- [ ] Validar pertenencia mediante sesión anterior autenticada y sesión nueva verificada o proceso administrativo verificable. No asignar propiedades por coincidencia de correo sin prueba.
- [ ] Conservar autor histórico y propietario; no migrar contraseñas o sesiones de ChatGPT que la app no posee. Reemitir invitaciones pendientes con autorización y caducidad.
- [ ] Probar cuenta sin vínculo, vínculo duplicado, colaborador revocado y dos propietarios; ninguno puede reclamar los datos del otro.

### HU-58 · Conservar roles y aislamiento de datos

Como **propietario**, quiero **controlar qué puede ver y modificar cada integrante**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-55, HU-57.

- [ ] Matriz por rol, propiedad, tarea, centro de costo y acción que reproduzca permisos actuales; concesiones consultadas en base para revocación efectiva.
- [ ] RLS en tablas expuestas y permisos mínimos de Data API; políticas SELECT/INSERT/UPDATE/DELETE, incluyendo USING y WITH CHECK para impedir cambiar de propietario.
- [ ] Probar por API directa como anónimo, propietario A/B, colaborador limitado y revocado. RLS por fila no oculta columnas: separar/proyectar datos sensibles y el JSON compartido.
- [ ] Vistas con security_invoker cuando se expongan; funciones privilegiadas solo si son necesarias, con alcance y EXECUTE restringidos. Revisar advisors sin hallazgos críticos pendientes.

### HU-59 · Migrar y conciliar los datos de D1

Como **administrador**, quiero **trasladar el historial sin perder ni duplicar registros**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-53, HU-55, HU-57, HU-58.

- [ ] Importación por lotes, reanudable e idempotente; registrar ejecución y cuarentena de errores. Repetir importación no duplica facturas, pagos, escenarios ni auditoría.
- [ ] Incluir propiedades, respaldos, escenarios, presupuestos, libro contable, proveedores, equipo, facturas normalizadas o heredadas, borradores, reportes y registros de eliminación existentes.
- [ ] Conciliar cantidades por tabla y propietario, sumas de presupuesto/gasto/pagos/saldo por propiedad a precisión monetaria definida; cero diferencias no justificadas y cero huérfanos.
- [ ] Conservar claves y trazabilidad de cada origen; ensayar restauración completa y documentar duración. No dar por completada con solo importar una muestra.

### HU-60 · Adaptar las operaciones del backend a PostgreSQL

Como **usuario**, quiero **seguir usando los módulos sin cambios en sus resultados**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-55, HU-58, HU-59.

- [ ] Reemplazar rawDb/D1 y SQL SQLite: placeholders, funciones JSON, batch y lecturas; escoger acceso HTTP/RPC compatible con el runtime y documentar la capa de persistencia.
- [ ] Factura, líneas, distribuciones, pagos y auditoría se guardan en una transacción; un conjunto de llamadas REST separadas no se considera equivalente a batch atómico.
- [ ] Preservar control de versiones, conflictos, idempotencia y protección ante edición concurrente o recreación de propiedad eliminada; probar fallo intermedio con rollback.
- [ ] Las operaciones normales usan identidad del usuario y permisos efectivos; no ejecutar todo con una clave privilegiada. Pruebas de contratos de todas las rutas y cálculos sin diferencias.

### HU-61 · Guardar archivos nuevos en Supabase Storage

Como **usuario**, quiero **adjuntar y consultar documentos desde Supabase**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-54, HU-58, HU-60.

- [ ] Bucket privado con rutas vinculadas a propietario/propiedad/documento/versión; no usar nombres proporcionados por el usuario como autorización.
- [ ] Mantener validación de contenido, MIME, límite de 10 MB, SHA-256, categorías, enlaces y versiones; subida y descarga autorizadas por los mismos permisos de la factura o expediente.
- [ ] URLs firmadas de duración limitada tras autorizar; no guardar enlaces temporales como referencia permanente. Definir que enlaces ya emitidos vencen al terminar su TTL; usar descarga mediada si se exige revocación inmediata.
- [ ] Pruebas negativas de lectura/escritura/borrado cruzado y acceso directo al bucket; manejar huérfanos con compensación/reintento porque DB y Storage no comparten transacción.

### HU-62 · Migrar documentos históricos de R2

Como **usuario**, quiero **seguir abriendo todas mis facturas y fotos anteriores**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-53, HU-59, HU-61.

- [ ] Copiar cada versión mediante APIs de almacenamiento; conservar documentId, groupId, versión, nombre, MIME y hash, con mapa de clave anterior a ruta nueva.
- [ ] Comparar cantidad, tamaño y SHA-256 de todos los objetos; registrar faltantes, duplicados y objetos sin referencia antes de cambiar enlaces.
- [ ] Proceso reanudable sin sobrescribir versiones; probar PDF, fotos, Office, archivos repetidos y adjuntos compartidos autorizados.
- [ ] Cero archivos referenciados sin resolver al corte; mantener R2 como respaldo durante la ventana acordada, sin borrado inmediato del origen.

### HU-63 · Consultar la información desde el panel de Supabase

Como **administrador**, quiero **ver claramente propiedades, facturas, gastos y pagos en la base de datos**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P1**. Dependencias: HU-55, HU-58, HU-59, HU-60.

- [ ] Table Editor/SQL Editor permiten localizar una propiedad por ID o dirección y consultar proveedor, factura, fecha, categoría, centro de costo, estimado, real, pagado y saldo.
- [ ] Extraer campos de consulta a columnas/tablas o vistas legibles desde JSON conservado; documentar la fuente canónica y evitar cifras duplicadas inconsistentes.
- [ ] Entregar diccionario y consultas de solo lectura para gastos por propiedad/categoría/centro, facturas pendientes y comparación presupuestaria; valores coinciden con la app.
- [ ] Acceso al Dashboard solo para administradores autorizados, separado de usuarios de Auth; equipo operativo entra por la app. Correcciones contables por flujo auditado, no edición directa libre.

### HU-64 · Mantener auditoría, archivo y eliminación segura

Como **propietario**, quiero **conservar la trazabilidad y las reglas de eliminación**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-60, HU-61, HU-62.

- [ ] Auditoría registra actor Supabase, identidad histórica vinculada, acción, fecha y expediente; el usuario común no modifica eventos anteriores.
- [ ] Eliminar exige nombre exacto y versión vigente; registros financieros vinculados obligan a archivar; no eliminar proveedores compartidos ni otras propiedades.
- [ ] Cola persistente e idempotente elimina objetos de Storage y reintenta fallos; el documento deja de ser accesible mientras se completa limpieza.
- [ ] Pruebas de borrado concurrente, revocación, fallo de Storage, restablecimiento y prohibición de recrear expedientes eliminados; conservar retención documentada.

### HU-65 · Validar la migración de extremo a extremo

Como **usuario**, quiero **comprobar que el sistema funciona antes de cambiar producción**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-56 a HU-64.

- [ ] Ejecutar en staging compra, hard money, presupuesto, factura, adjunto, distribución, aprobación, pago, reporte, venta, renta y refinanciamiento con casos de prueba.
- [ ] Comparar cálculos contra resultados actuales; pruebas de RLS y Storage incluyen API directa y colaboradores con acceso parcial a facturas multipropiedad.
- [ ] Probar 2.000 facturas y archivo de 10 MB; registrar tiempos frente a la referencia y fijar umbral antes de aprobar. Verificar índices y paginación.
- [ ] Checklist firmado con evidencia y cero defectos críticos; probar restauración de DB y objetos y ensayo del corte/reversión.

### HU-66 · Cambiar producción con un plan de reversión

Como **administrador**, quiero **activar Supabase sin perder las operaciones recientes**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P0**. Dependencias: HU-65.

- [ ] Programar ventana y responsables; congelar escrituras en el origen, exportar delta final de datos y archivos y conciliar antes de habilitar escrituras en destino.
- [ ] Activar Auth/DB/Storage juntos con ruta de despliegue viable; comprobar login real, propiedad, factura y descarga. Evitar dos sistemas aceptando escrituras simultáneamente.
- [ ] Si falla antes de aceptar escrituras nuevas, volver al origen validado. Si falla después, congelar destino y reconciliar/exportar sus cambios antes de reabrir origen: no basta cambiar una variable.
- [ ] Registrar release, hora de corte, conteos y aceptación; definir ventana de reversión y retención en HU-53. Sin exportación productiva ni alojamiento resuelto, esta historia permanece bloqueada.

### HU-67 · Administrar respaldos, capacidad y operación

Como **administrador**, quiero **supervisar y recuperar el sistema**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P1**. Dependencias: HU-54, HU-61, HU-65; activar junto a HU-66.

- [ ] Definir RPO/RTO y responsables antes del corte; seleccionar respaldos/PITR según plan disponible y presupuesto, sin asumir que están incluidos.
- [ ] Respaldar objetos de Storage por separado: un respaldo de PostgreSQL no contiene sus bytes. Probar restauración coordinada de base, identidades y archivos.
- [ ] Documentar alertas de errores Auth/API, tareas de limpieza, cuotas de DB/Storage y transferencia; registros sin tokens o contenido financiero innecesario.
- [ ] Guía administrativa con acceso al Dashboard, consultas, despliegue, rotación de secretos y recuperación; responsables y evidencia de ensayo.

### HU-68 · Retirar dependencias antiguas y cerrar la migración

Como **administrador**, quiero **mantener una sola plataforma de datos y autenticación**, para operar la plataforma con continuidad y control.

Estado: **Pendiente**. Prioridad: **P1**. Dependencias: HU-66, HU-67 y ventana de reversión vencida.

- [ ] Comprobar que no quedan lecturas/escrituras a D1, R2 ni autenticación por encabezados ChatGPT; retirar adaptadores y bindings solo después de estabilizar.
- [ ] Archivar scripts e inventarios sin secretos; conservar respaldos según política. Borrado definitivo del origen es una acción separada con autorización explícita.
- [ ] Actualizar README, arquitectura y seguimiento en GitHub, y cerrar las historias solo con evidencia del entorno entregado.
- [ ] No declarar completas HU-45, HU-49 y HU-50 por migrar infraestructura; siguen su propio alcance.

## Definición de terminado y seguimiento

Cada historia registra: responsable, inicio, PR/commit, pruebas y evidencia, entorno entregado, incidencias, estado y fecha de cierre. “Implementada” no equivale a “migrada en producción”. La ampliación termina con conciliación completa, usuarios vinculados, archivos íntegros, aislamiento probado, recuperación ensayada y entrega productiva verificada.

No se requiere abrir invitaciones, comprar planes, crear proyectos ni ejecutar migraciones para aprobar este documento. La ejecución se realizará por historias; cualquier acción irreversible sobre el origen se trata aparte.

## Referencias verificadas

- [Tablas y datos / Table Editor](https://supabase.com/docs/guides/database/tables): acceso administrativo a tablas.
- [Auth y SSR](https://supabase.com/docs/guides/auth/server-side): sesión por cookies; validar SDK y framework antes de implementar.
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): permisos por fila además de los privilegios de acceso.
- [Storage y control de acceso](https://supabase.com/docs/guides/storage/security/access-control): políticas de acceso a objetos.
- [Respaldos](https://supabase.com/docs/guides/platform/backups): alcance de los respaldos de base; archivos requieren estrategia propia.
- [Changelog](https://supabase.com/changelog): revisar versiones y cambios relevantes al iniciar cada implementación. El índice .md no pudo leerse con la herramienta web; se consultó la versión HTML. No se seleccionaron extensiones ni componentes en alpha.
