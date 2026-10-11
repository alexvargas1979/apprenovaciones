# HU-57 · Vincular identidades y conservar propiedad/autores

10 de octubre de 2026. **En verificación local**. Implementación de correspondencia y conciliación probada; ninguna identidad real vinculada ni dato productivo importado. Dependencias abiertas: HU-53, HU-55 y HU-56.

## Entrega

Migración `20261011010228_hu57_identity_mapping.sql` aplicada únicamente al contenedor `apprenovaciones-local`. El prefijo corresponde al 11 de octubre UTC, todavía 10 de octubre en Atlanta. La CLI registra el historial local aunque su mensaje use la palabra “remote”.

Cuatro tablas en `migration_private`, fuera de los esquemas expuestos por la API:

| Tabla | Finalidad |
|---|---|
| identity_sources | Origen/cohorte y hash de la instantánea aprobada |
| identity_inventory | ID anterior, roles observados y cantidad de referencias |
| identity_links | Correspondencia uno a uno a auth.users, evidencia administrativa y revocación |
| identity_link_events | Historial automático de verificaciones y revocaciones |

RLS activado y sin acceso de `anon`, `authenticated` ni `service_role`. Las funciones de control son SECURITY INVOKER, con search_path vacío, sin permiso EXECUTE público. No se añadieron endpoints, llaves privilegiadas al sitio ni permisos de negocio. El administrador local puede consultar `migration_private` desde Studio; su permiso de administración es distinto de una cuenta de Auth.

## Reglas

- Solo puede vincularse un ID presente en el inventario de ese origen. No se busca por correo, nombre, metadatos del usuario ni dirección de la propiedad.
- Un ID anterior tiene una cuenta destino; una cuenta no puede absorber dos IDs del mismo origen. Una duplicidad requiere resolución administrativa, nunca fusión automática.
- La cuenta destino debe existir, tener correo confirmado, no ser anónima ni estar eliminada o bloqueada al registrar el vínculo.
- Se exige referencia a evidencia del control de la identidad anterior y de la nueva, hash SHA-256 del acta, responsable y hora de revisión. La evidencia debe estar vigente al insertar; ventana máxima de 24 horas desde la revisión.
- Los identificadores y la evidencia quedan fijos. Solo se permite pasar de `verified` a `revoked`, con responsable/motivo y fecha del servidor. No se admite borrar, reasignar ni reactivar silenciosamente el vínculo. Corregir una vinculación equivocada necesita una intervención específica revisada, no editarla en la app.
- Fuentes, inventario y eventos son inmutables por los flujos ordinarios. Los triggers no pretenden resistir a un administrador PostgreSQL que pueda deshabilitarlos: es el límite de confianza administrativo.
- Vincular identidad no concede acceso al libro o a una propiedad. HU-58 debe autorizar cada acción y validar cuenta/concesiones vigentes; una revisión antigua no sustituye esa validación.
- El autor histórico permanece con su ID original en el respaldo/JSON. La correspondencia es auxiliar: no reescribir autores como si toda la operación la hubiese hecho el dueño actual.

## Revisión administrativa antes de un vínculo real

Este bloque implementa un **proceso administrativo**, no una prueba automática de doble sesión. Campos y hashes por sí solos no prueban pertenencia. El administrador debe reunir y revisar la evidencia por canales controlados antes de insertar una correspondencia:

1. Obtener la instantánea completa de HU-53, confirmar su manifiesto/hash y generar el inventario. Una captura parcial del conector no sirve.
2. Verificar el control de la identidad anterior mediante la sesión/origen autenticado o evidencia administrativa equivalente verificable. No aceptar un ID escrito por el solicitante, un encabezado enviado por él o una coincidencia de correo como prueba.
3. Verificar el control de la nueva cuenta mediante una sesión Supabase validada en servidor. Correo confirmado en auth.users es necesario, pero por sí solo no prueba que ambas cuentas pertenezcan a la misma persona.
4. Registrar en un acta privada origen/hash, ambos IDs, método, referencias a ambas evidencias, responsable, fecha y vencimiento. No incluir contraseñas, cookies, JWT o enlaces de recuperación. Guardar el acta en almacenamiento administrativo restringido y calcular su hash.
5. En una transacción administrativa, registrar fuente e inventario y después el vínculo con las referencias del acta. Las restricciones y triggers validan consistencia, vigencia y unicidad; no hacen la revisión humana del acta.
6. Exportar los vínculos mediante JOIN con identity_sources para incluir snapshot_sha256. Conciliar cobertura. Un faltante o vínculo revocado es una excepción bloqueante para esa identidad; no asignar un UUID al azar ni usar el dueño por defecto.

El origen identifica una cohorte/instantánea congelada, por ejemplo `sitio:cohorte-corte`. Si cambia la instantánea, requiere una nueva revisión/cohorte; no sobrescribir el hash. HU-59/66 deberá conciliar los cambios del corte con la cohorte aprobada. Ningún acta, inventario real ni exportación debe subirse a GitHub.

## Informe previo a la migración

`scripts/migration/identity_plan.py` abre los bytes exactos de una instantánea SQLite auditada, verifica SHA-256, integridad y tablas declaradas. Extrae propietarios, miembros y campos `actor` anidados, incluidos respaldos originales. Excluye `settings` y `attom_receipts` sin leer sus filas. JSON con claves duplicadas, miembros activos sin identidad o tablas desconocidas bloquean el informe.

El informe contiene IDs y referencias de columna, no credenciales ni datos financieros completos. No modifica SQLite/PostgreSQL, no aplica vínculos, no invita usuarios y no importa propiedades. Solo escribe dentro de una carpeta `migration-private`, con permisos 0600 desde la creación y sin sobrescribir archivos.

```sh
python3 scripts/migration/identity_plan.py \
  --snapshot migration-private/copia-verificada.sqlite \
  --manifest migration-private/copia-verificada.sqlite.manifest.json \
  --source-id sitio:cohorte-corte \
  --output migration-private/identidades-pendientes.json
```

Con un archivo administrativo de vínculos, añadir `--links migration-private/vinculos.json`. Cada fila debe contener `source_id`, `snapshot_sha256`, `legacy_user_id`, `auth_user_id` y `status`. Este archivo es un export administrativo confiable, no una entrada que la aplicación acepte de usuarios finales. Alterarlo solo altera el informe: no concede permisos ni modifica la base.

`identity_coverage_complete` indica únicamente cobertura del inventario por vínculos no revocados. `production_ready` permanece falso incluso al llegar al 100%: faltan importación, conciliación, permisos y corte.

## Equipo e invitaciones

- `Revocado`: conservar revocación; no emitir invitación ni reactivar por haber vinculado la identidad.
- `Invitación` / `Por aprobar`: bloquear uso del token antiguo. Preparar una invitación nueva solo después de autorización del propietario, con expiración y token nuevos; nunca copiar token_hash del sistema anterior. HU-56 ya ensaya la aceptación por Supabase; el envío real aún no se hace.
- `Activo`: conservar el estado del origen en el informe y requerir validación de permisos HU-58 antes de otorgar acceso. Vincular un miembro no lo convierte en propietario.
- Roles, propiedades, tareas y centros se conservan en la instantánea; su reproducción y revocación efectiva se prueban en HU-58. No se migran contraseñas ni sesiones de ChatGPT.

## Validación

- 7 pruebas Python del inventario/informe: sin vínculo, coincidencia de correo ignorada, autores históricos, tablas retiradas excluidas, cobertura, duplicados/fusión, origen/hash/ID ajenos, vínculo revocado, instantánea alterada, JSON ambiguo, miembro activo sin ID, archivo privado y no sobrescritura.
- 18 comprobaciones PostgreSQL: propietarios separados, cuenta sin vínculo, doble reclamo/fusión, origen desconocido, cuenta sin confirmar, evidencia caducada, reasignación, motivo de revocación, auditoría, no reactivación/borrado, fuente inmutable, RLS y rechazo de anon/authenticated/service_role.
- Las 18 comprobaciones se repitieron después de reconstruir las dos migraciones desde una base vacía, además de las 15 comprobaciones de HU-55: 33 en local y 33 en la reconstrucción. El destino auth.users mínimo de la base desechable solo resuelve dependencias; la primera ejecución usa Auth local real.
- Las 4 pruebas anteriores de respaldo también pasaron. Advisors sin errores ni advertencias. Datos sintéticos revertidos y base de ensayo desechable eliminada.

```sh
python3 -m unittest discover -s scripts/migration -p 'test_*.py'
python3 scripts/migration/test_hu55_local.py
```

## Pendiente

Respaldar el origen real; completar evidencia de control de ambas identidades; registrar correspondencias reales mediante administración verificada; resolver todas las excepciones de autores/propietarios/miembros; autorizar y reemitir invitaciones pendientes; integrar el mapeo en HU-59 y probar acceso funcional con HU-58/60. Hasta entonces HU-57 no está completada y el bloqueo de API de HU-56 continúa.

Referencia: [esquemas privados de Supabase](https://supabase.com/docs/guides/database/tables#schemas).
