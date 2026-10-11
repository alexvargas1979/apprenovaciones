# HU-59 · Importación y conciliación

Fecha: 11 de octubre de 2026. Estado: **En desarrollo**. Se implementó el plan de transferencia y un ensayo completo con datos sintéticos en bases desechables de Supabase local. No se importó información real ni se modificó producción. El backend de la app continúa pendiente de HU-60.

## Entrega

`transfer_plan.py` lee una copia SQLite inmutable y su manifiesto HU-53, comprueba SHA-256, repite la auditoría y exige correspondencia completa de identidades HU-57. No asocia cuentas por correo. Valida nombres de tablas/columnas contra el diccionario HU-55 y prepara las 20 tablas en orden de dependencias.

Conserva los IDs de negocio y los textos originales de los respaldos; los actores históricos dentro de JSON conservan sus IDs de origen. Convierte únicamente las columnas de identidad previstas a UUID y deriva el propietario de saldos iniciales desde el respaldo padre. No carga `settings` ni `attom_receipts`. Los tokens de invitación se reemplazan por valores inutilizables y las concesiones no revocadas quedan **Por aprobar**; las revocadas permanecen revocadas. Las concesiones requieren revisión del propietario antes de activarse.

El plan registra cantidades por tabla y propietario, sumas decimales de subtotal más impuesto por propiedad, tablas ausentes y filas en cuarentena. Rechaza JSON con claves duplicadas, fechas sin zona, valores nulos obligatorios, columnas inesperadas, claves primarias duplicadas e importes incompatibles con las columnas monetarias del esquema. Si hay cuarentena no genera una carga ejecutable. Las restricciones PostgreSQL completan la validación de claves y relaciones durante el ensayo.

Los planes y reportes se guardan exclusivamente dentro de `migration-private/`, ignorado por Git, con permisos 0600 y sin sobrescribir archivos anteriores. Contienen datos privados: no se incluyen en el repositorio. Los mensajes de consola no imprimen filas ni errores SQL que puedan revelar datos.

## Ensayo local y conciliación

`rehearse_transfer.py` solo usa el contenedor `supabase_db_apprenovaciones-local`. Crea bases con nombres aleatorios `hu59_rehearsal_…`, aplica las migraciones existentes y elimina esas bases al terminar. No recibe URL remota, referencia de proyecto ni destino configurable. Las identidades en esas bases son un soporte mínimo de FK para el ensayo, no cuentas Auth nuevas ni una comprobación de identidad real.

La carga divide las inserciones en grupos de hasta 250 filas dentro de una única transacción. Repetirla después de un fallo es seguro. Un conflicto se admite únicamente si todas las columnas coinciden; nunca hace UPDATE para ocultar una diferencia. Compara todas las filas y columnas importadas con `EXCEPT ALL`, incluidos el JSON anidado y los textos de respaldo. También detecta filas adicionales en el destino de ensayo. No es todavía un importador productivo con checkpoints por lote.

Evidencia del ensayo sintético del 11 de octubre:

| Comprobación | Resultado |
| --- | --- |
| Importación de 20 tablas, 20 registros sintéticos | Aprobada |
| Fallo provocado antes del commit | Reversión completa, cero filas residuales |
| Segunda carga de los mismos datos | Sin duplicados |
| Cambio de una propiedad en destino | Importación rechazada, sin sobrescribirla |
| Suma decimal por propietario y propiedad | Sin diferencias |
| `pg_dump`, restauración en otra base y comparación completa | Sin diferencias |
| Duración del ensayo con esta muestra mínima | 1,334 segundos; no estima duración productiva |

Además pasaron 15 pruebas unitarias nuevas del plan; junto con auditoría e identidades, 26 pruebas Python. Las migraciones existentes superaron 41 comprobaciones locales y las mismas 41 al reconstruir una base vacía.

## Uso

Desde la raíz del proyecto, con Docker y Supabase local funcionando:

```sh
python3 -m unittest discover -s scripts/migration -p 'test_*.py' -q
python3 scripts/migration/rehearse_transfer.py --output migration-private/hu59-nuevo-ensayo.json
```

Sin argumentos de origen utiliza exclusivamente datos sintéticos. Para preparar un origen auditado, proporcionar `--snapshot`, `--manifest`, `--source-id`, `--links` y `--output` a `transfer_plan.py`. El ensayo también admite esos cuatro argumentos de origen y siempre crea una base desechable. Los vínculos deben provenir de la exportación administrativa verificada de HU-57; el plan no sustituye esa verificación. Cada ejecución requiere un nombre de reporte nuevo.

## Pendiente para cerrar HU-59

1. Obtener y auditar el respaldo íntegro de D1 de HU-53. Las páginas truncadas del conector no son una fuente aceptable. No se usó la base local como sustituto de producción.
2. Completar la vinculación real de usuarios HU-57 y la matriz de permisos HU-58. Un plan no habilita acceso a colaboradores.
3. Resolver tokens de versión como `fecha-UUID` en `team_members.updated_at`: la aplicación actual puede generarlos y HU-55 espera `timestamptz`. Se ponen en cuarentena; no se recortan. Diseñar conservación del token y control de concurrencia con HU-60 antes de importar ese origen.
4. Conciliar resultados funcionales completos por propiedad: presupuesto, pagos, créditos, retenciones y saldo, incluidos libros heredados. La suma bruta de líneas y la igualdad de JSON aquí probadas no sustituyen esos cálculos.
5. Implementar checkpoints y registro persistente de ejecuciones para la carga real por lotes, resolver excepciones y medir restauración con el volumen completo. La muestra sintética no demuestra cobertura del contenido real ni capacidad productiva.
6. Migrar archivos y comprobar bytes por separado en HU-62; conservar referencias de documentos no equivale a migrar archivos de R2.

No se añade una migración SQL de esquema en esta entrega: el ensayo utiliza las migraciones HU-55 a HU-58 existentes. No se habilita escritura directa desde Data API.
