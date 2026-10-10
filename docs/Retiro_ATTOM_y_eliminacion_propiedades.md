# Retiro de ATTOM y eliminación de propiedades

Fecha: 9 de octubre de 2026. Estado: implementado y probado localmente; publicación pendiente. El sitio alojado continúa en la versión 14.

## Cambios

- Retirada la consulta ATTOM, su API, configuración de clave, botones, estado de conexión y referencias de la interfaz. La identificación de la propiedad se completa manualmente.
- Conservados dirección, APN, superficie, habitaciones, baños y demás valores existentes. Los respaldos históricos originales no se reescriben; las respuestas actuales eliminan metadatos de la integración retirada.
- La migración 0010 elimina las tablas de credenciales y recibos de ATTOM y crea el registro de eliminación. Aplicada únicamente en la base local; se aplicará al publicar. La credencial del entorno alojado no se ha modificado mientras continúa la versión anterior.
- Botones Eliminar en la tarjeta y Eliminar propiedad en la ficha guardada. El diálogo exige escribir el nombre exacto, explica el alcance y permite cancelar.
- Solo el propietario puede eliminar. Se verifica la versión para evitar borrar sobre cambios recientes. Se conserva un registro mínimo de eliminación y auditoría que impide que un cliente antiguo vuelva a crear la ficha.
- Se eliminan ficha, presupuesto, escenarios, documentos y borradores exclusivos. Se conservan proveedores y otras propiedades; se retira esta propiedad del acceso de colaboradores.
- Los expedientes con registros financieros vinculados deben archivarse desde Expediente. También se bloquea el borrado si un documento o borrador está compartido con otra propiedad.
- Si falla la eliminación física de un adjunto, queda pendiente para reintento en la siguiente carga de propiedades; el documento deja de estar accesible por la aplicación.

## Validación

Pruebas de API con SQLite y almacenamiento simulado: confirmación incorrecta, usuario ajeno, origen inválido, versión desactualizada, modificación concurrente, referencias financieras y borradores compartidos, eliminación de dependencias, aislamiento de proveedores y otras propiedades, revocación del alcance, reintento de adjuntos y bloqueo de recreación accidental. Sin infracciones de claves foráneas.

Pasaron también las pruebas de conservación, modelo, historias y compras/permisos (HU-47, HU-48, HU-51 y HU-52), TypeScript y compilación de producción. Revisión visual del diálogo: botón deshabilitado hasta introducir el nombre exacto y cancelación funcional. No se eliminó ninguna propiedad del usuario durante la revisión visual.

## Pendiente de entrega

El flujo oficial de sincronización de fuentes fue rechazado por la revisión automática de aprobaciones porque la aprobación de ejecución está deshabilitada. No se publicó ni se migró la base alojada. Tras resolver ese bloqueo quedan publicar mediante Sites y verificar el entorno alojado.
