# Seguimiento del desarrollo de Rehab Atlanta

Documento maestro de avance. Última actualización: 10 de octubre de 2026.

Alcance y criterios detallados: [Plan de desarrollo](Plan_desarrollo_Rehab_Atlanta.md).
Aplicación: [Rehab Atlanta](https://rehab-atlanta-av.megan2908.chatgpt.site).

## Forma de trabajo

Trabajaremos una historia a la vez, siguiendo dependencias. Cada historia tendrá implementación, pruebas, entrega y actualización de este documento. Una historia no se marcará completada solo porque existe una pantalla o código; debe cumplir sus criterios y estar disponible en el entorno de entrega acordado. Si depende de un lender, credencial o decisión pendiente, se indicará concretamente.

Estados: Pendiente, En desarrollo, En verificación, Completada, Bloqueada y Retirada. La columna de revisión del usuario distingue entrega técnica de aceptación por uso; no requiere detener cada cambio para pedir aprobación de nuevo.

Al cerrar cada historia se registrará qué cambió, cómo se probó, dónde se entregó, limitaciones y la siguiente historia. Este documento se actualiza junto con cada entrega; no es un monitor automático ni avanza sin trabajo realizado.

## Resumen actual

- 68 historias en el plan: 40 del alcance original, 12 de gastos y 16 de migración a Supabase.
- 39 completadas; 12 en verificación; 5 en desarrollo; 11 pendientes; 1 retirada. El conteo no representa porcentaje de esfuerzo total.
- HU-08/HU-10/HU-11/HU-12 completadas, probadas y publicadas. HU-09/HU-13/HU-14/HU-15 completadas y publicadas. HU-16 a HU-20 completadas, probadas y publicadas. HU-21 a HU-23 completadas, probadas y publicadas. HU-24 a HU-28 completadas, probadas y publicadas. HU-29 a HU-33 completadas, probadas y publicadas. HU-34 a HU-38 completadas, probadas y publicadas. HU-39/HU-40 completadas, probadas y publicadas. HU-03 fue retirada por decisión del usuario; se conserva la ficha manual.
- Publicación privada confirmada: versión 14, el 14 de septiembre de 2026. Incluye navegación agrupada en el encabezado y conserva HU-01 a HU-40 con sus estados de validación.
- HU-41/HU-42/HU-43/HU-44/HU-46/HU-47/HU-48/HU-51/HU-52 tienen implementación local y pruebas. Publicación y validación alojada pendientes; consultar [entrega local](HU-47-HU-48-HU-51-HU-52.md). HU-45, HU-49 y HU-50 permanecen pendientes.
- Orden inicial: HU-01 → HU-02 → HU-38 → HU-03 → HU-05/HU-06 → resto de la entrega analítica según dependencias.
- La aplicación publicada inicialmente sigue aportando propiedades, presupuesto de 71 partidas, costos manuales, gastos de tenencia, CSV y configuración ATTOM. Estas funciones previas no significan que las historias ampliadas estén completas.

## Cambio adicional · Retiro de ATTOM y eliminación de propiedades

Implementado y probado localmente el 9 de octubre de 2026. La ficha queda manual y conserva los valores existentes. Se agrega eliminación con confirmación por nombre; los expedientes con registros financieros vinculados requieren archivo. Publicación pendiente por bloqueo del flujo autorizado de sincronización. [Detalle y pruebas](Retiro_ATTOM_y_eliminacion_propiedades.md).

## Registro de historias

| ID | Historia | Estado | Entrega | Revisión del usuario |
| --- | --- | --- | --- | --- |
| HU-01 | Conservar y migrar propiedades existentes | Completada | 0 | Pendiente de uso por Alexander |
| HU-02 | Administrar etapas y responsables | Completada | 0 | Pendiente de uso por Alexander |
| HU-03 | Consolidar ficha y datos ATTOM | Retirada | Retiro implementado localmente | Integración cancelada por el usuario; publicación pendiente |
| HU-04 | Guardar documentos por expediente | Completada | 2 | Pendiente de uso por Alexander |
| HU-05 | Sustentar ARV y renta con comparables | Completada | 1 | Pendiente de uso por Alexander |
| HU-06 | Elegir estimación rápida o detallada de obra | Completada | 1 | Pendiente de uso por Alexander |
| HU-07 | Crear versiones de análisis y escenarios | Completada | 1 | Pendiente de uso por Alexander |
| HU-08 | Capturar costo completo del flip | Completada | 1 | Pendiente de uso por Alexander |
| HU-09 | Oferta máxima y pruebas de estrés | Completada | 1 | Pendiente de uso por Alexander |
| HU-10 | Comparar términos de hard money | Completada | 1 | Pendiente de uso por Alexander |
| HU-11 | Proyectar intereses y deuda por fecha | Completada | 1 | Pendiente de uso por Alexander |
| HU-12 | Efectivo requerido y calendario de caja | Completada | 1 | Pendiente de uso por Alexander |
| HU-13 | Analizar la propiedad como renta | Completada | 1 | Pendiente de uso por Alexander |
| HU-14 | Factibilidad de refinanciamiento | Completada | 1 | Pendiente de uso por Alexander |
| HU-15 | Nuevo préstamo y brecha al refinanciar | Completada | 1 | Pendiente de uso por Alexander |
| HU-16 | Comparar venta y renta al mismo horizonte | Completada | 1 | Pendiente de uso por Alexander |
| HU-17 | Aprobar internamente una oferta | Completada | 2 | Pendiente de uso por Alexander |
| HU-18 | Gestionar diligencia antes del cierre | Completada | 2 | Pendiente de uso por Alexander |
| HU-19 | Registrar cierre real de adquisición | Completada | 2 | Pendiente de uso por Alexander |
| HU-20 | Aprobar y versionar presupuesto de obra | Completada | 2 | Pendiente de uso por Alexander |
| HU-21 | Administrar proveedores y contratos | Completada | 2 | Pendiente de uso por Alexander |
| HU-22 | Registrar facturas y gastos detallados | Completada | 2 | Pendiente de uso por Alexander |
| HU-23 | Registrar pagos y cuentas por pagar | Completada | 2 | Pendiente de uso por Alexander |
| HU-24 | Administrar draws y reembolsos de obra | Completada | 2 | Pendiente de uso por Alexander |
| HU-25 | Controlar cronograma y avance | Completada | 2 | Pendiente de uso por Alexander |
| HU-26 | Costo final previsto y desviaciones | Completada | 2 | Pendiente de uso por Alexander |
| HU-27 | Comercialización y ofertas de venta | Completada | 3 | Pendiente de uso por Alexander |
| HU-28 | Revisar a tiempo la activación de Plan B | Completada | 1 básica / 3 completa | Pendiente de uso por Alexander |
| HU-29 | Liquidar venta y medir resultado | Completada | 3 | Pendiente de uso por Alexander |
| HU-30 | Ejecutar y conciliar refinanciamiento | Completada | 3 | Pendiente de uso por Alexander |
| HU-31 | Preparar la propiedad para renta | Completada | 4 | Pendiente de uso por Alexander |
| HU-32 | Administrar contratos y cobros de renta | Completada | 4 | Pendiente de uso por Alexander |
| HU-33 | Gastos y mantenimiento de renta | Completada | 4 | Pendiente de uso por Alexander |
| HU-34 | Desempeño y venta futura de la renta | Completada | 4 | Pendiente de uso por Alexander |
| HU-35 | Liquidez y riesgo de cartera | Completada | 5 | Pendiente de uso por Alexander |
| HU-36 | Conciliar y exportar para contabilidad | Completada | 5 | Pendiente de uso por Alexander |
| HU-37 | Importar calculadora como escenario | Completada | 5 | Pendiente de uso por Alexander |
| HU-38 | Rastrear cambios, cálculos y decisiones | Completada | 0 transversal | Pendiente de uso por Alexander |
| HU-39 | Compartir funciones con el equipo | Completada | Cierre | Pendiente de uso por Alexander; activar invitados cuando los elija |
| HU-40 | Reportes de decisión y cierre | Completada | 5 | Pendiente de uso por Alexander |
| HU-41 | Administrar categorías y productos de gastos | En verificación | Ampliación A | Implementada localmente; pendiente de publicación |
| HU-42 | Distribuir presupuesto y gastos por centro de costo | En verificación | Ampliación A | Implementada localmente; pendiente de publicación |
| HU-43 | Capturar facturas detalladas y términos de pago | En verificación | Ampliación B · local | Pendiente de publicación y cierre de verificación |
| HU-44 | Adjuntar y gestionar PDF o fotos desde la factura | En verificación | Ampliación B · local | Pendiente de publicación y cierre de verificación |
| HU-45 | Crear un borrador de factura mediante imagen e IA | Pendiente | Ampliación C | Pendiente de desarrollo |
| HU-46 | Comparar presupuesto inicial, vigente y gastos reales | En verificación | Ampliación B · local | Pendiente de publicación y cierre de verificación |
| HU-47 | Vincular orden de compra, recepción y factura | En verificación | Implementación local y pruebas; [detalle](HU-47-HU-48-HU-51-HU-52.md). Publicación pendiente. | Pendiente de publicación y uso |
| HU-48 | Revisar y aprobar gastos con permisos por función | En verificación | Implementación local y pruebas; [detalle](HU-47-HU-48-HU-51-HU-52.md). Publicación pendiente. | Pendiente de publicación y uso |
| HU-49 | Gestionar vencimientos, descuentos y pagos planificados | Pendiente | Ampliación D | Pendiente de desarrollo |
| HU-50 | Controlar devoluciones y créditos de materiales | Pendiente | Ampliación D | Pendiente de desarrollo |
| HU-51 | Detectar sobrecostos y actualizar la previsión de cierre | En verificación | Implementación local y pruebas; [detalle](HU-47-HU-48-HU-51-HU-52.md). Publicación pendiente. | Pendiente de publicación y uso |
| HU-52 | Capturar gastos recurrentes y reembolsos de obra | En verificación | Implementación local y pruebas; [detalle](HU-47-HU-48-HU-51-HU-52.md). Publicación pendiente. | Pendiente de publicación y uso |
| HU-53 | Inventariar y respaldar la información actual | En desarrollo | Migración Supabase | [Avance y bloqueos](HU-53-HU-54_Inicio_migracion.md) |
| HU-54 | Preparar Supabase y validar el alojamiento | En desarrollo | Migración Supabase | [Avance y bloqueos](HU-53-HU-54_Inicio_migracion.md) |
| HU-55 | Diseñar el modelo PostgreSQL y las migraciones | En verificación | Migración Supabase | [20 tablas y 30 comprobaciones locales](HU-55_Modelo_PostgreSQL.md); pendiente contraste productivo |
| HU-56 | Ingresar con Supabase Auth | En verificación | Migración Supabase | [Acceso local y 22 pruebas](HU-56_Acceso_Supabase.md); pendiente SMTP, alojamiento e integración |
| HU-57 | Vincular usuarios existentes y conservar sus datos | En verificación | Migración Supabase | [Correspondencia privada y ensayo local](HU-57_Vinculacion_identidades.md); pendiente evidencia y cobertura reales |
| HU-58 | Conservar roles y aislamiento de datos | En desarrollo | Migración Supabase · local | [Lectura aislada probada; vistas completas y acciones pendientes](HU-58_Permisos_y_aislamiento.md) |
| HU-59 | Migrar y conciliar los datos de D1 | En desarrollo | Migración Supabase · ensayo local | [20 tablas sintéticas, repetición y restauración probadas; datos reales pendientes](HU-59_Importacion_y_conciliacion.md) |
| HU-60 | Adaptar las operaciones del backend a PostgreSQL | En desarrollo | Migración Supabase · ensayo local | [Pantalla local conectada a lecturas, cambio de nombre, guardado calculado, aprobación de base y duplicación; validación visual y operaciones financieras pendientes](HU-60_Backend_PostgreSQL.md) |
| HU-61 | Guardar archivos nuevos en Supabase Storage | Pendiente | Migración Supabase | Sin implementación |
| HU-62 | Migrar documentos históricos de R2 | Pendiente | Migración Supabase | Sin implementación |
| HU-63 | Consultar la información desde el panel de Supabase | Pendiente | Migración Supabase | Sin implementación |
| HU-64 | Mantener auditoría, archivo y eliminación segura | Pendiente | Migración Supabase | Sin implementación |
| HU-65 | Validar la migración de extremo a extremo | Pendiente | Migración Supabase | Sin implementación |
| HU-66 | Cambiar producción con un plan de reversión | Pendiente | Migración Supabase | Sin implementación |
| HU-67 | Administrar respaldos, capacidad y operación | Pendiente | Migración Supabase | Sin implementación |
| HU-68 | Retirar dependencias antiguas y cerrar la migración | Pendiente | Migración Supabase | Sin implementación |

## Ampliación Supabase

[HU-53 a HU-68: alcance, dependencias y aceptación](HU-53-HU-68_Migracion_Supabase.md). Inicio recomendado: HU-53 y HU-54. El código fuente está en GitHub; la preparación y el ensayo local de la migración están en curso; no hay cambios en producción.

## HU-01 · Conservación y migración

Estado: Completada y publicada el 7 de septiembre de 2026. Responsable de implementación: Codex. Revisión funcional por Alexander: pendiente.

### Resultado implementado

- Conserva propiedades originales, IDs, propietario, dirección/APN, presupuesto, cantidades, precios, referencias ATTOM y configuración.
- Crea una copia exacta de los datos existentes antes de su primera migración o edición con esta versión.
- Identifica los acumulados manuales de costo real como saldos iniciales, incluidos ceros explícitos y partidas desactivadas. No inventa facturas ni suma los saldos otra vez al presupuesto.
- La migración trabaja por usuario y puede repetirse o reanudarse sin duplicar datos.
- En propiedades anteriores muestra “Respaldo y saldos iniciales” y permite descargar una copia JSON del estado original.
- Las nuevas propiedades se identifican como nuevas. El registro de etapas y responsables corresponde a HU-02.

### Evidencia

- Pruebas con SQLite real: conservación exacta, conciliación de totales, repetición sin duplicados, aislamiento por usuario y conservación de credenciales.
- Casos de ceros, nulos, partidas desactivadas, datos ATTOM y campos adicionales preservados.
- Fallo simulado a mitad de proceso: el lote completo se revierte; luego se reanuda correctamente.
- Restauración ensayada únicamente con datos ficticios y condición de versión; lectura de la aplicación anterior conserva los totales.
- 23 propiedades procesadas en dos lotes, sin perder ni duplicar registros.
- Pruebas del estimador y comprobación TypeScript aprobadas.
- Compilación final y TypeScript: aprobados. Migración aplicada en D1 local; carga autenticada y descarga de respaldo responden correctamente; petición anónima rechazada y respaldo inexistente devuelve 404.
- Publicación privada confirmada en Rehab Atlanta, versión 2. La comprobación de la cartera alojada requiere la sesión autenticada del usuario; no se presenta como realizada mediante las pruebas locales. La migración se ejecutará para su cuenta al cargar esta versión.

### Límites de esta entrega

El respaldo es lógico y vive en la misma base, con descarga individual disponible. No sustituye una copia externa ante pérdida completa de la base. La migración de una cuenta se ejecuta al abrir la aplicación o antes de editar sus propiedades previas. Las pruebas de restauración usan datos ficticios; no se sobrescribieron propiedades del usuario para demostrar recuperación.

La facturación detallada todavía no existe. En HU-22/HU-23 habrá que conciliar los saldos iniciales con sus comprobantes para evitar duplicaciones. Los términos de hard money y la validación real de ATTOM pertenecen a historias posteriores.

## HU-02 · Etapas y responsables

Estado: Completada y publicada el 7 de septiembre de 2026. Revisión de uso por Alexander: pendiente.

- Doce etapas del ciclo de inversión, más Sin clasificar para propiedades anteriores.
- Filtro por etapa, responsable y evaluación de Plan B independiente de la etapa.
- Historial con fecha efectiva, fecha de registro, responsable, actor autenticado y motivo.
- Archivar conserva datos; Recuperar vuelve a la etapa previa después de guardar.
- No se marca una compra, venta o refinanciamiento a partir de una fecha prevista.
- Pruebas: todas las etapas, Plan B durante venta, archivo/recuperación, fechas inválidas/futuras, motivos, conflictos de versión, historial protegido, aislamiento de cuentas y conservación del presupuesto.
- Límites: el responsable no concede permisos de equipo; la etapa no registra un cierre financiero.

## HU-03 · Ficha y ATTOM

Estado: En verificación. Implementada y publicada el 7 de septiembre de 2026; pruebas simuladas aprobadas. Falta validar una consulta real con la suscripción del usuario.

- Consulta por dirección o APN/condado, revisión de múltiples coincidencias y mensajes de datos ausentes.
- Selección de campos con comparación actual/ATTOM, fuente, fecha de consulta, historial y valores anteriores.
- Lote y área habitable separados; baños completos, parciales y medios diferenciados; captura manual disponible.
- Detección de posibles duplicados por condado/APN, incluidas archivadas, sin fusionar automáticamente.
- Referencias privadas por usuario; clave cifrada, ausente de respuestas y reportes.
- Pruebas con handlers reales, SQLite y red ATTOM simulada: importación selectiva, ceros, nulos, edición manual posterior, consulta por dirección/APN, coincidencias múltiples, errores, protección de referencias e historiales y compatibilidad HU-01.
- Validación pendiente: configurar una clave con acceso a Property Detail en el sitio y consultar una propiedad de prueba por dirección y APN. Confirmar la coincidencia, guardar un campo seleccionado y revisar fuente/valor anterior al recargar. No compartir la clave en el documento o chat.
- Referencia técnica: [documentación oficial de ATTOM](https://api.developer.attomdata.com/docs), consultada el 7 de septiembre de 2026.

Entrega: publicación privada confirmada en Rehab Atlanta, versión 3. Compilación y TypeScript aprobados; endpoints locales autenticados responden HTTP 200. Se probaron los handlers con SQLite real y respuestas ATTOM simuladas. No se realizó prueba visual/interactiva en navegador ni consulta real a ATTOM.

Los historiales de estas historias no completan HU-38. El análisis de hard money, renta y refinanciamiento continúa pendiente en sus historias específicas.

## HU-04 · Documentos por expediente

Estado: Completada. Publicación privada confirmada el 7 de septiembre de 2026, hora de Atlanta (8 de septiembre UTC), versión 4. Revisión de uso por Alexander: pendiente.

- Archivos privados por propiedad, categorías, título, notas, fechas y versiones conservadas.
- Referencias manuales a préstamo, factura, tarea o comparable; no crean movimientos ni verifican su existencia. Los vínculos automáticos se integrarán al desarrollar esos módulos.
- Descarga de versiones anteriores y búsqueda de documentos. Retirar una referencia o comparable no elimina su comprobante.
- Almacenamiento R2 para archivos y D1 para metadatos; límite de 10 MB por archivo y 200 archivos/versiones por expediente.
- Formatos: PDF, JPG/JPEG, PNG, WEBP, DOCX, XLSX, XLSM y CSV. Validación de contenido y tamaño; descarga como adjunto; el sitio no ejecuta macros ni fórmulas.
- Pruebas aprobadas: versiones y bytes, permisos por cuenta, descargas anónimas rechazadas, formatos/tamaños, conflicto de versión, fallos de escritura y retención de archivos.
- Prueba HTTP con almacenamiento local real aprobada. Solo se retiraron la propiedad y los archivos temporales creados para esa prueba.
- Límites: no antivirus ni visor de archivos; la revisión de uso por el propietario queda pendiente.

## HU-05 · Comparables para ARV y renta

Estado: Completada. Publicación privada confirmada el 7 de septiembre de 2026, hora de Atlanta (8 de septiembre UTC), versión 4. Revisión de uso por Alexander: pendiente.

- Captura manual de ventas y rentas con dirección, importe, fechas de evento/consulta, estado, sqft, condición, distancia, fuente y enlace.
- Ajustes netos justificados, selección de evidencia y distinción entre precios solicitados y operaciones cerradas.
- Advertencias por datos incompletos y antigüedad; 180 días es un umbral inicial editable.
- Promedios y rangos ajustados separados para venta y renta. Referencia por sqft para venta, sin fijar automáticamente el ARV.
- ARV y renta elegidos con comparables completos y justificación. Copias del análisis y evidencia en cada guardado que lo modifica.
- Pruebas aprobadas: aritmética y unidades, estados/fechas/enlaces, evidencia requerida, advertencias e historial preservado.
- La captura manual funciona con la ficha actual aunque la consulta real de HU-03 siga pendiente. No se añadieron consultas pagadas de comparables a ATTOM.
- Límites: no evaluación del lender ni cálculo de préstamos; los supuestos se conectarán al análisis financiero en sus historias correspondientes.

## HU-06 · Estimación de obra

Estado: Completada y publicada el 8 de septiembre de 2026, versión 5. Revisión de uso por Alexander: pendiente.

- Modos excluyentes: Detallada, Rápida por sqft y Manual de obra directa.
- Conserva partidas y tarifas; identifica qué modo alimenta fondos y análisis. CSV distingue el modo usado del detalle conservado.
- Administración sobre obra directa y contingencia sobre obra más administración, una vez.
- Revisión de alcances superpuestos, paquetes, inspección y permisos.
- Ejemplo probado: 1,274 sqft × ($55 − $35) = $25,480 de cambio en obra directa.

## HU-07 · Versiones y base aprobada

Estado: Completada y publicada el 8 de septiembre de 2026, versión 5. Revisión de uso por Alexander: pendiente.

- Versiones privadas con compra, ARV, renta, medidas, presupuesto, préstamo estimado, fechas, costos y versión del motor.
- Duplicación independiente, carga al pronóstico y guardado de versiones conservadora/adversa desde estrés.
- Base analítica aprobada inmutable; no cambia la etapa ni confirma un lender.
- Comparación base/pronóstico. Cambios de presupuesto y supuestos actualizan el pronóstico; costos reales actúan como piso por partida o global según modo, sin sumarse dos veces.
- Pruebas: control de versión, base conservada, duplicados independientes, escenarios de estrés, cambios de ejecución, motor e inputs históricos, aislamiento y acceso por cuenta.
- Límite: el piso por ejecución no reemplaza el costo por terminar de HU-26; máximo 50 versiones.

## HU-08 · Costo completo del flip

Estado: Completada y publicada el 8 de septiembre de 2026, versión 6. Revisión de uso por Alexander: pendiente.

- Integra compra, obra, costos heredados/nuevos, interés, puntos/fees y venta.
- Costos con base, frecuencia, etapa y fecha; recurrencias por días. Incluye diligencia, título/abogado, assignment, impuestos, seguros, HOA, servicios, permisos, comercialización, comisión y concesiones.
- Conciliación de gastos heredados y cargos calculados; principal separado de gasto. Utilidad y margen antes de impuesto sobre la renta.
- Integra términos seleccionados del lender, múltiples draws, capitalización, pagos, interés retenido, mínimos, límites y extensiones. Conserva el modelo simple anterior para propiedades sin cotización seleccionada.
- Probados cargos una vez, préstamo frente a gasto, draw posterior a salida, reserva no desembolsada, horizontes y exclusiones.
- Dependencia contractual de HU-10/HU-11 completada y publicada; principal e interés concilian con el calendario de caja.

## HU-09 · Oferta máxima y estrés

Estado: Completada y publicada el 8 de septiembre de 2026, versión 7. Revisión de uso por Alexander: pendiente.

- Filtro porcentual separado de oferta del modelo por utilidad o margen objetivo.
- Recalcula costos y deuda ligados a compra en cada precio; detecta meta imposible y datos faltantes.
- Estrés combinado de ARV, obra, meses, tasa hard money, renta, vacancia y valor de refinanciamiento.
- Resultados calculados de utilidad, capital neto aportado, renta y aporte de conversión; explicación desde diferencias numéricas.
- Plan B completo con unidades, NOI, P&I, CapEx, equilibrio, DSCR analítico, estado de lender y conversión fechada. Tasa cero, amortización, tasación menor y fondos condicionados probados.
- Caja por fecha y pico de aportación integrados. Oferta respeta máximo, LTC/LTV y anticipo de earnest money; estrés recalcula calendario y vencimiento del préstamo.
- HU-13/HU-14/HU-15 ya integradas y probadas: el estrés recalcula payoff, renta, LTV, caja, vencimiento y condiciones; un cambio material invalida la confirmación previa.
- HU-09 completada al integrar y publicar HU-13 a HU-15. HU-16 es una historia posterior de comparación al mismo horizonte, no una dependencia de HU-09.
- El capital neto no es pico de caja; el cash-out potencial no se acredita como dinero disponible ni como aprobación convencional.

## HU-10 / HU-11 / HU-12 · Lenders, deuda y caja

Estado: Completadas y publicadas el 8 de septiembre de 2026, versión 6. Revisión de uso por Alexander: pendiente.

- **HU-10:** cotizaciones por propiedad, estados documentales, vigencia, compromiso y máximo, anticipo, reservas, LTC/LTV con bases, puntos/fees, vencimiento, extensiones, penalidad y garantías. Comparación de costo, payoff y pico de aporte; selección del lender para el pronóstico.
- **HU-11:** libro de deuda por fechas con varios draws y demoras, amortizaciones, interés pagado/capitalizado/retenido, base 360/365, mínimo contractual y payoff estimado. Conciliación de principal y comparación independiente con cotización oficial del lender.
- **HU-12:** horizonte de hasta 10 años, earnest money acreditado una vez, compra/obra/tenencia/salida, reservas restringidas, reembolsos y aportes. Brecha máxima antes de aportes, caja posterior y déficit restante. Refinanciamiento pendiente no se acredita como efectivo.
- Integración con HU-08, oferta y estrés, versiones inmutables y base aprobada. Se conservan el presupuesto, modelo simple anterior y archivos existentes.
- Pruebas aprobadas: conciliación de principal/interés/caja/utilidad, límites, múltiples draws, retrasos, retención, capitalización, mínimos, extensiones, aportes, horizonte de 24 meses y refinanciamiento condicionado. Persistencia con SQLite, validación del servidor, aislamiento entre cuentas y escenarios anteriores intactos.
- Alcance: proyección de adquisición/obra hasta salida. HU-13 a HU-16 desarrollarán renta, elegibilidad, hipoteca y comparación al mismo horizonte. Los estados y fondos confirmados se registran por el usuario; no constituyen una verificación automática del lender.
- TypeScript y compilación aprobados. Arranque local autenticado HTTP 200; ruta de escenarios responde 404 para expediente inexistente. No se realizó revisión visual/interactiva en navegador.
- Detalle, instrucciones y evidencia: [HU-10 a HU-12](HU-10-HU-12.md).

## HU-13 / HU-14 / HU-15 · Plan B completo

Estado: Completadas y publicadas el 8 de septiembre de 2026, versión 7. Revisión de uso por Alexander: pendiente.

- **HU-13:** renta por unidad, vacancia/incobrables, ingreso efectivo, gastos operativos, NOI, P&I, CapEx, DSCR analítico, renta de equilibrio y prueba adversa.
- **HU-14:** expediente del lender/programa, titularidad, fechas de compra/pagaré, crédito, ingresos/deudas calificados, reservas y documentación de renta. Reglas con fuente/vigencia; estados y motivos; fecha factible frente a vencimiento hard money. Confirmación explícita con referencia que pierde vigencia al cambiar datos materiales.
- **HU-15:** tasación, solicitado/aprobado, LTV, tasa, amortización, plazo contractual, puntos, costos financiados/pagados, anticipos y escrow. Payoff a fecha de conversión, cash-in, cash-out potencial/confirmado, capital aún invertido y tabla de cuotas con saldo global cuando corresponde.
- Caja utiliza la conversión completa cuando está activa; no acredita fondos pendientes o con confirmación desactualizada. Supuestos antiguos y escenarios/base aprobada se conservan.
- Pruebas de cálculo, integración, persistencia/recarga, validación de servidor, inmutabilidad y aislamiento aprobadas. TypeScript y compilación aprobados; sin revisión visual/interactiva ni consulta real a ATTOM.
- Alcance: tasa fija, reglas ingresadas y confirmación documental registrada por el usuario. No conexión automática de underwriting; ARM y excepciones no parametrizadas quedan documentadas como condiciones. La comparación al mismo horizonte se entregó después en HU-16, versión 8.
- Arranque local autenticado HTTP 200; escenarios devuelve 404 para expediente inexistente. Publicación privada confirmada, versión 7.
- Referencias oficiales, instrucciones y evidencia: [HU-13 a HU-15](HU-13-HU-15.md).

## HU-16 a HU-20 · Comparación, adquisición y obra

Estado: Completadas, probadas y publicadas el 8 de septiembre de 2026, hora de Atlanta (9 de septiembre UTC), versión 8. Revisión de uso por Alexander: pendiente.

- **HU-16:** comparación de venta y renta al mismo horizonte, flujos fechados, aportes/distribución, utilidad, margen, apreciación, amortización, capital remanente, cash-on-cash y XIRR con resultado no disponible cuando corresponde. Refinanciamiento hipotético etiquetado sin acreditar fondos en Caja.
- **HU-17:** ofertas/contraofertas vinculadas a versiones analíticas; términos, plazos, contingencias, capital disponible, criterios y excepciones documentadas. Decisiones internas conservadas, sin enviar ofertas.
- **HU-18:** tareas de diligencia configurables por expediente/condado, responsable, fechas, criticidad, evidencia y revisiones. Avisos por vencimiento; hallazgos aplicados mediante orden de cambio y revisión de decisión.
- **HU-19:** settlement real clasificado y conciliado, documento privado y confirmación explícita. Fecha/precio/deuda/aportes reales actualizan pronóstico y etapa; costos reemplazados y datos analíticos anteriores se conservan.
- **HU-20:** presupuesto base congelado, alcance, revisiones y contingencia disponible. Órdenes de cambio aprobadas modifican pronóstico sin crear facturas ni pagos.
- Pruebas de cálculo e integración aprobadas: XIRR, comparación, criterios, evidencia, conciliación del cierre, contingencia, escenarios, versiones, aislamiento y protección de historiales.
- Límites: la comparación es una proyección antes de impuestos; la revisión del lender y el cierre se registran según evidencia del usuario. El cierre confirmado no se sobrescribe; no incluye rectificación de settlement. Facturas/pagos corresponden a HU-22/HU-23; auditoría transversal HU-38 sigue pendiente.
- TypeScript y compilación aprobados. Arranque local autenticado HTTP 200; nueva ruta de operaciones rechaza un cuerpo inválido con HTTP 400. Sin revisión visual/interactiva.
- Detalle, instrucciones y evidencia: [HU-16 a HU-20](HU-16-HU-20.md).

## HU-21 a HU-23 · Contratos, facturas y pagos

Estado: Completadas, probadas y publicadas el 9 de septiembre de 2026, versión 9. Revisión de uso por Alexander: pendiente.

- **HU-21:** fichas de proveedores con versiones, cotizaciones comparables, alcance, partidas, documentos, hitos y retención; aceptación y revisiones de compromiso sin duplicar precio ni pagos.
- **HU-22:** comprobantes emitidos/aprobados, distribución conciliada entre propiedades y partidas, categorías/impuestos, evidencia, posibles duplicados y créditos/reversos históricos. Integra el costo aprobado al pronóstico y concilia saldos manuales/cierre sin duplicación.
- **HU-23:** cuentas pendientes, pagos parciales, anticipos y aplicaciones, retenciones/liberaciones, reembolsos y reversos. Aportes/desembolsos separados de gasto; evidencia por movimiento.
- Pruebas de servidor con SQLite, cálculos, conservación de historial, aislamiento y concurrencia aprobadas. Regresión de funciones previas, TypeScript y compilación aprobados. Arranque autenticado y rutas de lectura HTTP 200; escritura sin versión válida HTTP 409.
- Límite: registro de operaciones realizadas por el usuario; no transfiere dinero. Caja prevista y registro real se muestran por separado; draws/deuda se integraron después en HU-24; conciliación bancaria sigue pendiente en HU-36. No se realizó prueba visual/interactiva.
- Instrucciones, alcance y evidencia: [HU-21 a HU-23](HU-21-HU-23.md).

## HU-24 a HU-28 · Obra y salida

Estado: Completadas, probadas y publicadas el 10 de septiembre de 2026, versión 10. Revisión de uso por Alexander: pendiente.

- **HU-24:** solicitudes y estados del lender, reserva y respaldo por facturas, recepciones parciales/totales, neto bancario y deuda/interés una vez. Permite conciliar un desembolso ya registrado; solicitud/aprobación no son efectivo.
- **HU-25:** tareas, permisos, inspecciones, dependencias, avance/evidencia e historial. Retrasos amplían el pronóstico y reevaluación de Plan B, conservando fechas contractuales.
- **HU-26:** presupuesto, compromisos, incurrido, pagado, pendiente de contrato y restante aprobado. Incurrido + restante, sin duplicar contratos/facturas; efecto en utilidad, contingencia y capital.
- **HU-27:** publicaciones, broker, comisión/staging, ofertas y netos, contingencias, historial y reapertura interna tras oferta caída. No modifica ARV ni registra una venta cerrada.
- **HU-28:** umbrales y avisos de mercado, margen, liquidez y vencimiento; alternativas de precio/extensión/refinanciamiento y decisión documentada con resultados conservados.
- Pruebas de cálculo, servidor/SQLite, conservación, concurrencia y aislamiento aprobadas; regresión de funciones anteriores, TypeScript y compilación aprobados. Arranque autenticado y lecturas HTTP 200. No hubo transacciones externas ni prueba visual/interactiva.
- Límites: retenciones de draws conservadas como fondos restringidos sin devolución supuesta; recepciones confirmadas sin rectificación automatizada. Cronograma por días calendario; alertas al abrir/actualizar, no notificaciones externas. La extensión comparada sigue siendo hipotética.
- Instrucciones y evidencia: [HU-24 a HU-28](HU-24-HU-28.md).

## HU-29 a HU-33 · Cierres y operación de renta

Estado: completadas, probadas y publicadas el 11 de septiembre de 2026, versión 11. Revisión de uso por Alexander pendiente.

- **HU-29:** cierre conciliado, historial de correcciones, utilidad real/base/pronóstico, principal y capital separados, holdbacks y costos posteriores.
- **HU-30:** etapas, términos reales, cash-in/out, payoff confirmado por separado y primera cuota.
- **HU-31:** preparación por unidad, póliza landlord y requisitos documentados, disponibilidad/vacancia/ocupación.
- **HU-32:** contratos, cargos y cobros parciales, ajustes/reversos y depósitos de garantía restringidos.
- **HU-33:** órdenes con proveedor/facturas/pagos existentes, gasto operativo/CapEx, períodos, escrow, reserva y avisos.
- Instrucciones, pruebas y límites: [HU-29 a HU-33](HU-29-HU-33.md).

## HU-34 a HU-38 · Cartera y trazabilidad

Estado: completadas, probadas y publicadas el 13 de septiembre de 2026, versión 12. Revisión de uso por Alexander pendiente.

- **HU-34:** desempeño mensual, cuotas/amortización y escenarios de venta futura, conservando inversión histórica.
- **HU-35:** filtros, caja registrada/restringida, deuda, compromisos, necesidad prevista y concentración por lender.
- **HU-36:** CSV mapeado/deduplicado, asociación y conciliación por período, exportación de gastos/pagos/deuda/capital.
- **HU-37:** lectura segura del Excel original, celdas/fórmulas, H01/H02 y borrador sin duplicación.
- **HU-38:** auditoría de cambios, motivo para aprobaciones, cálculos de servidor y controles de privacidad/concurrencia.
- Instrucciones, pruebas y límites: [HU-34 a HU-38](HU-34-HU-38.md).

## HU-39 y HU-40 · Equipo y reportes

Completadas, probadas y publicadas el 13 de septiembre de 2026, versión 13. Detalle y límites: [HU-39-HU-40](HU-39-HU-40.md). Roles con propiedades/tareas autorizadas, invitación y aprobación de identidad, propuestas con revisión y revocación auditada. Reporte descargable con secciones seleccionables, cálculos del motor y resultados reales; sin documentos crediticios ni claves. No se enviaron invitaciones ni se cambió la audiencia.

## HU-41 a HU-52 · Facturas y control de gastos

Alcance incorporado el 7 de octubre de 2026. **HU-41/HU-42 en verificación**: implementadas y probadas localmente, publicación bloqueada por la revisión automática de la sincronización. **HU-43/HU-44/HU-46 implementadas localmente y en verificación**; HU-47/HU-48/HU-51/HU-52 implementadas localmente el 9 de octubre; HU-45/HU-49/HU-50 pendientes. [Detalle del bloque B](HU-43-HU-44-HU-46.md). Detalle y evidencia: [HU-41/HU-42](HU-41-HU-42.md). La aplicación alojada permanece en versión 14.

- HU-41/HU-42: categorías y productos configurables; centros de costo por propiedad y distribución presupuestaria.
- HU-43/HU-44/HU-45: factura por productos con terms, impuestos y descuentos; carga directa de PDF/fotos; extracción IA como borrador revisable.
- HU-46: presupuesto inicial y vigente frente a costo real, pagos, cuentas pendientes y pronóstico, con desglose y trazabilidad.
- HU-47 a HU-52: compras/recepciones, aprobación por funciones, vencimientos, devoluciones, sobrecostos y gastos recurrentes/reembolsos.

El código existente se revisó para identificar qué se reutiliza y qué falta. Investigación basada en documentación oficial de Buildertrend, QuickBooks, Procore, Amazon Textract y Microsoft Document Intelligence. Criterios de aceptación, dependencias, prueba por historia, fórmulas, fuentes y bloques de entrega: [HU-41 a HU-52 · Control de gastos](HU-41-HU-52_Control_de_gastos.md).

## Bitácora

| Fecha | Historia | Avance | Pendiente inmediato |
| --- | --- | --- | --- |
| 2026-09-07 | Organización | Registro de las 40 historias y definición del flujo de trabajo | Actualizar por entrega |
| 2026-09-07 | HU-01 | Implementación, pruebas y publicación privada completadas | Revisión de uso y HU-02 |
| 2026-09-07 | HU-02 / HU-03 | Implementación, pruebas y publicación privada completadas | Validación ATTOM real para cerrar HU-03; revisión de uso |
| 2026-09-07 | HU-04 / HU-05 | Implementación, pruebas y publicación privada completadas | Revisión de uso |
| 2026-09-08 | HU-06 a HU-09 | Publicación privada confirmada: HU-06/HU-07 completadas; avances de HU-08/HU-09 | Integrar dependencias financieras y revisión de uso |

| 2026-09-08 | HU-10 a HU-12 y cierre de HU-08 | Implementación, pruebas y publicación privada confirmadas | Revisión de uso; HU-13 a HU-15 |

| 2026-09-08 | HU-13 a HU-15 y cierre de HU-09 | Implementación, pruebas y publicación privada confirmadas | Revisión de uso; HU-16 |

| 2026-09-08 | HU-16 a HU-20 | Implementación, pruebas y publicación privada confirmadas, versión 8 | Revisión de uso; HU-21 a HU-23 |

| 2026-09-09 | HU-21 a HU-23 | Implementación, pruebas y publicación privada confirmadas, versión 9 | Revisión de uso; HU-24 a HU-26 |

| 2026-09-10 | HU-24 a HU-28 | Implementación, pruebas y publicación privada confirmadas, versión 10 | Revisión de uso; HU-29 a HU-31 |

| 2026-09-11 | HU-29 a HU-33 | Implementación, pruebas y publicación privada confirmadas, versión 11 | Revisión de uso; HU-34 a HU-36 |

| 2026-09-13 | HU-34 a HU-38 | Implementación, pruebas y publicación privada confirmadas, versión 12 | Revisión de uso; HU-39 y HU-40 |

| 2026-09-13 | HU-39 y HU-40 | Roles y propuestas por propiedad/tarea; reportes seleccionables; pruebas y publicación privada confirmadas, versión 13 | Consulta real ATTOM, aceptación por uso y activación autorizada de colaboradores |

| 2026-10-07 | HU-41 a HU-52 | Investigación y planificación de doce historias; criterios, dependencias y pruebas documentados. Sin implementación ni publicación | Iniciar HU-41/HU-42; luego HU-43/HU-44/HU-46 |

| 2026-10-07 | HU-41/HU-42 | Catálogos y centros implementados; API/SQLite, regresión, revisión interactiva y compilación aprobados | Sincronización/publicación bloqueada por revisión automática; no marcar completadas |

## Próxima sesión

Completar la sincronización y publicación de HU-41/HU-42, actualmente implementadas y verificadas localmente. La revisión automática rechazó el envío al proceso de sincronización de Sites; los permisos de red y escritura concedidos no resolvieron el bloqueo. Cerrar las verificaciones de HU-43/HU-44/HU-46 documentadas en su entrega y publicar el bloque antes de incorporar IA. El alcance original conserva 39 historias completadas y HU-03 en verificación; realizar revisión de uso con Alexander y una consulta real con su suscripción ATTOM para cerrar HU-03. Activar colaboradores solo cuando Alexander elija y autorice destinatarios; verificar entonces el recorrido de acceso con la cuenta real del primer colaborador. No se ejecutó esa invitación en esta entrega privada.

## Mejora de navegación · 14 de septiembre de 2026

Se sustituyó la fila de 22 pestañas por seis menús en el encabezado: Propiedad, Análisis, Compra y crédito, Remodelación, Venta y renta, y Resultados. Se muestra el grupo y sección activos. Accesos generales consistentes a propiedades, cartera, equipo y configuración; salir de una propiedad con cambios sin guardar se mantiene bloqueado. Los módulos y motores conservan su comportamiento.

Validación local interactiva: los 22 destinos abrieron su sección correcta en escritorio y en una pantalla de 390 px; 22 paneles distintos con contenido. Revisión visual a 1440 px y 390 px, apertura por teclado y cierre con Escape. Enlaces de cartera y configuración desde Equipo comprobados; cambiar de sección conserva los campos en edición. Sin errores de navegador durante el recorrido. Se usó una propiedad ficticia en el entorno local; no se modificaron propiedades de producción ni se consultó ATTOM. TypeScript y compilación aprobados. Publicación privada confirmada: versión 14, 14 de septiembre de 2026, 21:44:17 UTC. Fuente publicada: `cd3822a270135720933b39f2d83c4298114499ab`.

## Entrega local del 8 de octubre de 2026

HU-43/HU-44/HU-46: captura detallada, borradores, carga directa, normalización y comparativo histórico implementados y probados localmente. [Alcance, pruebas y pendientes](HU-43-HU-44-HU-46.md). La versión publicada continúa siendo la 14.

## 9 de octubre de 2026 · compras, permisos y control de gastos

Se implementaron HU-47/HU-48/HU-51/HU-52 y se cerraron las brechas locales del bloque HU-43/HU-44/HU-46: páginas PDF reales, etapas, jerarquía, diferencias entre cortes y prueba de 2,000 facturas. [Evidencia, uso y pendientes](HU-47-HU-48-HU-51-HU-52.md). Continúa bloqueada la publicación por el rechazo automático al flujo oficial de sincronización; no se declara una nueva versión alojada.

## Avance Supabase · 11 de octubre de 2026

HU-58: correcciones de autorización, 25 comprobaciones de lógica y 28 pruebas contra API local aprobadas. HU-59: plan de importación y ensayo de 20 tablas sintéticas, reversión, idempotencia, detección de conflictos y restauración aprobados. Ambas historias siguen En desarrollo: faltan integración completa de roles/acciones, respaldo real y conciliación funcional del origen. Producción sin cambios. Detalles en [HU-58](HU-58_Permisos_y_aislamiento.md) y [HU-59](HU-59_Importacion_y_conciliacion.md).

HU-60, 11 de octubre: lecturas del propietario integradas a PostgreSQL mediante RPC con RLS e instantánea consistente; 11 pruebas HTTP con 1.201 facturas, 45 comprobaciones SQL locales y 45 de reconstrucción. Vista previa local desactivada al concluir; sin publicación ni cambios productivos. [Detalle](HU-60_Backend_PostgreSQL.md).

HU-60, segunda entrega del 11 de octubre: cambio de nombre con motivo, respaldo previo, auditoría atómica, control de versión e idempotencia. 15 pruebas HTTP y 58 comprobaciones SQL locales/reconstruidas aprobadas. Vista previa HTTP desactivada; pendientes guardado general, facturas, pagos y sus pantallas. [Detalle](HU-60_Backend_PostgreSQL.md).

HU-60, tercera entrega del 11 de octubre: duplicación de escenarios con auditoría atómica, origen conservado, base aprobada intacta, control de versiones, idempotencia y límite concurrente de 50. 13 pruebas HTTP nuevas y 71 comprobaciones SQL locales/reconstruidas aprobadas. Vista previa HTTP desactivada; integración de pantalla y demás operaciones pendientes. [Detalle](HU-60_Backend_PostgreSQL.md).


HU-60, cuarta entrega del 11 de octubre: pantalla `/ensayo` conectada a consulta, cambio de nombre y duplicación, disponible sólo bajo opciones locales. TypeScript/build aprobados; 6 pruebas HTTP nuevas, 28 regresiones de escritura y 3 comprobaciones de desactivación. La ejecución de Chrome quedó bloqueada; revisión visual e interacción de formularios pendientes. Sin publicación ni cambios productivos. [Detalle y limitaciones](HU-60_Backend_PostgreSQL.md).


HU-60, quinta entrega del 11 de octubre: 12 pruebas de interacción del componente aprobadas con React/jsdom y API simulada. Corregido un riesgo de duplicación al editar y restaurar un comando después de perder su respuesta. TypeScript y build aprobados. La revisión visual y la prueba integral en navegador siguen pendientes; no hubo cambios productivos. [Detalle](HU-60_Backend_PostgreSQL.md).


HU-60, sexta entrega del 11 de octubre: consulta de cifras históricas de escenarios conectada a la pantalla local, con estados ausentes, errores y reintento. 13 pruebas HTTP, 16 de interacción simulada, proyección histórica, TypeScript y build aprobados; 4 pruebas de desactivación. Sin cambios productivos. Revisión visual y demás escrituras pendientes. [Detalle](HU-60_Backend_PostgreSQL.md).


HU-60, séptima entrega del 11 de octubre: guardado de nuevos escenarios calculados en el servidor, conectado al formulario local, con auditoría atómica, recibos de reintento y límite concurrente. 81 comprobaciones SQL locales/reconstruidas, 14 HTTP nuevas, 13 regresiones de duplicación, 18 de interacción, TypeScript/build y ensayo HU-59 aprobados. Guardado desactivado al concluir; producción intacta. Faltan edición de supuestos/expediente, aprobación, estrés y contabilidad. [Detalle](HU-60_Backend_PostgreSQL.md).


HU-60, octava entrega del 11 de octubre: aprobación de una nueva base calculada, con confirmación, revisión de datos pendientes y protección contra reemplazos/concurrencia. 90 comprobaciones SQL locales/reconstruidas, 17 HTTP de aprobación, 14 regresiones de guardado y 20 de interacción aprobadas; TypeScript/build y restauración también. Sin cambios productivos. Próximo bloque: estrés; quedan edición de supuestos/expediente y contabilidad. [Detalle](HU-60_Backend_PostgreSQL.md).
