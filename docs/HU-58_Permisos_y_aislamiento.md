# HU-58 · Permisos y aislamiento

Fecha local: 10 de octubre de 2026. Estado: **En desarrollo**. Este bloque implementa y prueba aislamiento de lectura en Supabase local. No cierra la historia ni activa el backend PostgreSQL de la aplicación. Producción permanece intacta; no se importaron identidades, propiedades ni documentos reales.

## Alcance implementado

Las 20 tablas públicas conservan RLS. `authenticated` puede consultar únicamente sus propias filas mediante `auth.uid()` verificado por Supabase; los colaboradores no pueden leer directamente libros, propiedades, facturas, documentos ni concesiones ajenas. No se confía en metadatos editables del usuario.

Las tablas modificables tienen políticas de propietario para INSERT, UPDATE y DELETE; UPDATE verifica tanto la fila original como la resultante. **No se conceden permisos directos de escritura**, ni siquiera al propietario. Auditoría, líneas base, respaldos históricos, historial de clasificación y registros de eliminación no reciben políticas de modificación. Las operaciones financieras seguirán bloqueadas hasta implementar las transacciones y validaciones correspondientes en HU-60.

Dos RPC públicas, `shared_property_summary` y `shared_invoice_summary`, entregan campos expresamente seleccionados. Sus funciones internas consultan la concesión activa en cada solicitud; revocarla corta la siguiente consulta con el mismo token. Las invitaciones pendientes no conceden acceso. La fecha de vencimiento conserva su significado actual de vencimiento de invitación; no se introduce una caducidad nueva de concesiones activas.

| Perfil o permiso | Lectura disponible en este bloque | Pendiente para cerrar la historia |
| --- | --- | --- |
| Propietario | Filas propias en las tablas públicas | Operaciones del backend con validación transaccional |
| Contratista | Datos básicos de la propiedad y únicamente tareas asignadas | Integración de pantalla y acciones autorizadas |
| Responsable de obra | Datos básicos y tareas de propiedades asignadas | Presupuesto y resto de la proyección actual |
| Analista | Datos básicos de propiedades asignadas | Análisis y proyección completa del rol |
| Administración | Datos básicos de propiedades asignadas | Resúmenes contables y proyección completa del rol |
| Permisos explícitos de gastos | Resumen limitado de factura, sujeto a propiedad y centro de costo | Acciones `upload`, `draft`, `classify`, `review`, `approve` y `pay` |
| Anónimo, invitación pendiente o revocado | Sin acceso compartido | Recorridos integrales de interfaz |

La consulta de facturas requiere al menos un permiso de gastos reconocido y valida **todas** las líneas. Una factura multipropiedad con una sola línea fuera de alcance se rechaza completa. `allCenters` amplía centros, nunca propiedades. Sin ese permiso, se valida la clasificación vigente del historial normalizado antes de considerar las asignaciones originales. Un crédito hereda los centros de su línea de origen; referencias rotas, ciclos o clasificaciones malformadas no conceden acceso. El centro vacío representa una línea sin clasificar y requiere autorización explícita.

El resumen de factura incluye identificador, número, fechas, total de subtotal más impuesto y líneas limitadas. No es un estado de cuenta ni calcula pagos o saldo neto de créditos. No entrega referencias de adjuntos, cuentas de pago, contactos privados ni libros completos. Storage y sus políticas corresponden a HU-61.

## Implementación y límites de seguridad

Migración generada con Supabase CLI local: `20261011011103_hu58_read_isolation.sql` (marca UTC). Las funciones públicas usan SECURITY INVOKER. Las dos funciones internas de lectura compartida usan SECURITY DEFINER en `access_private`, fuera de los esquemas expuestos, con `search_path` vacío, comprobación de `auth.uid()`, concesión activa y selección limitada de campos. Este privilegio es necesario para inspeccionar las filas del propietario sin otorgar acceso directo al colaborador. EXECUTE se revoca de PUBLIC y roles API y se concede únicamente a `authenticated` para las funciones necesarias. El ayudante de centros no es invocable por ese rol. No se crearon vistas.

La correspondencia privada de HU-57 no concede permisos por sí sola. No se implementaron aún límites monetarios, separación de funciones, controles de presupuesto ni aprobación/pago en PostgreSQL. Esas reglas existentes en TypeScript deberán conservarse dentro de las transacciones de HU-60; la falta de permisos DML evita saltarlas desde Data API mientras tanto.

## Validación

- 18 pruebas contra Data API y Auth locales: anónimo, dos propietarios, colaborador, tareas, campos sensibles, factura multipropiedad, reclasificación, créditos, centros, revocación con el mismo token y bloqueo de escritura.
- 8 comprobaciones SQL de HU-58, además de las anteriores de esquema e identidades: 41 comprobaciones locales y 41 al reconstruir todas las migraciones en una base temporal nueva.
- Prueba transaccional de UPDATE USING y WITH CHECK con permiso temporal revertido al terminar.
- Advisors locales sin errores ni advertencias después de aplicar el bloque.

Los datos y usuarios de prueba son sintéticos y se eliminan al finalizar. No se probó todavía la matriz completa de acciones ni las pantallas con todos los roles. No hubo cambios de interfaz en esta entrega.

Comandos reproducibles desde la raíz del proyecto, con Docker y Supabase local iniciados:

```sh
python3 scripts/migration/test_hu55_local.py
npm exec --yes --package=supabase@2.120.0 -- node scripts/migration/test-hu58-rls.mjs
```

## Trabajo pendiente

Completar las proyecciones por rol equivalentes a `lib/team.ts`, conectar las vistas y comprobar todos sus campos; implementar las acciones de gastos con las reglas de `lib/expense-access.ts` dentro de las transacciones de HU-60; ampliar las pruebas por acción y rol antes de cerrar HU-58. La migración real HU-59 también depende de completar el respaldo de HU-53 y la vinculación de identidades de HU-57. Ninguna prueba local sustituye esos requisitos.

## Avance del 11 de octubre de 2026

Se reforzaron también las funciones de autorización de la aplicación actual: un rol desconocido ya no cae en la vista de Analista; una factura con clasificación vacía no satisface el permiso de centros por una comprobación sobre un arreglo vacío. Se rechazan créditos con referencias rotas/circulares y consultas con concesiones pendientes, revocadas o sin permisos de gastos. `allCenters` sigue limitado a las propiedades autorizadas.

Pasaron 25 comprobaciones de lógica que cubren los cuatro roles, los seis permisos de gastos y casos de denegación. La suite contra Auth/Data API local pasó **28 pruebas**, ampliando las 18 anteriores con todos los roles, rol nulo/desconocido, invitaciones pendientes y permisos ausentes/desconocidos. Pasaron asimismo TypeScript y las regresiones de clasificación, compras, aprobación, pagos delegados y gastos recurrentes.

Las proyecciones completas de `teamProperty` se verificaron en TypeScript; las RPC de PostgreSQL siguen entregando los resúmenes limitados descritos arriba. **La equivalencia de las pantallas y las acciones transaccionales todavía no está implementada: HU-58 continúa En desarrollo**, coordinada con HU-60. No se publicaron estos cambios en Sites.
