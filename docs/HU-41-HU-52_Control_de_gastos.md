# Ampliación del plan · Facturas y control de gastos de remodelación

Actualizado: 9 de octubre de 2026. **En verificación local:** HU-41/HU-42/HU-43/HU-44/HU-46/HU-47/HU-48/HU-51/HU-52. **Pendientes:** HU-45/HU-49/HU-50. Publicación pendiente. [Entrega y validación](HU-47-HU-48-HU-51-HU-52.md).

Solicitud: registrar todas las facturas reales con número, proveedor, términos de pago, producto, descripción, categoría configurable, centro de costos y valor; adjuntar PDF/foto; crear borradores mediante IA; comparar contra el presupuesto inicial y mejorar el control de gastos.

## 1. Qué existe y qué vamos a ampliar

Revisión del código local correspondiente a la entrega publicada de navegación, sin consultar ni modificar registros de producción.

| Necesidad | Base existente | Mejora pendiente |
| --- | --- | --- |
| Número, proveedor, fecha, vencimiento, descripción e importes | HU-21/HU-22; facturas por líneas con propiedad, partida, subtotal, impuesto y retención | Captura más sencilla, producto/SKU, cantidad, unidad, precio, descuentos y terms explícitos |
| Categorías | Lista fija: Materiales, Mano de obra, Permisos, Fletes, Administración, Adquisición, Tenencia, Financiamiento, Venta y Otros | Catálogo editable, separado del tipo de costo y la ubicación física |
| Cocina, patio, baño principal | No existe un centro de costo independiente en cada línea | Centros por propiedad y distribución del presupuesto y gastos entre espacios |
| PDF/foto | HU-04 admite PDF, JPG, PNG y WebP; HU-22 enlaza un comprobante previamente cargado en Documentos | Adjuntar y consultar desde la propia factura; varias páginas y archivos; bandeja móvil |
| Factura desde imagen | No existe extracción OCR/IA | Borrador revisable, evidencia por campo, conciliación de totales y aprobación humana |
| Presupuesto frente a gasto | HU-20/HU-26: base aprobada, órdenes de cambio, costo incurrido y por terminar | Comparativo navegable por centro, categoría, producto y proveedor; presupuesto inicial siempre visible |
| Pagos y créditos | HU-23: parciales, anticipos, retenciones, notas de crédito y reversos | Vencimientos según terms, devoluciones físicas y pagos planificados con mejor seguimiento |
| Bancos y auditoría | HU-36/HU-38: CSV, conciliación y trazabilidad | Reutilizar; no registrar el movimiento bancario como otro gasto |
| Colaboradores | HU-39: consulta limitada y propuestas; el propietario registra/aprueba | Permitir borradores y revisión de facturas con permisos explícitos y sin ampliar acceso automáticamente |

Referencias locales: `lib/accounting.ts`, `lib/accounting-actions.ts`, `app/accounting-panel.tsx`, `lib/documents.ts`, `app/api/documents/route.ts`, `lib/delivery.ts`, `lib/operations.ts`, `lib/team.ts`.

## 2. Organización de cada gasto

Separar estas dimensiones evita que «cocina» compita en la misma lista con «materiales»:

| Dimensión | Ejemplo | Para qué sirve |
| --- | --- | --- |
| Propiedad / proyecto | Casa A | A qué inversión corresponde |
| Centro de costo / espacio | Cocina, baño principal, baño secundario, patio, exterior, techo, toda la casa, gastos generales | Dónde se utiliza |
| Categoría / oficio | Plomería, electricidad, pintura, pisos, gabinetes | En qué se gasta; editable |
| Tipo de costo | Materiales, mano de obra, subcontrato, equipos/alquileres, permisos, fletes, otros | Qué naturaleza tiene el costo |
| Producto o servicio | Grifería de cocina, instalación de gabinete | Qué se compró; admite SKU opcional |
| Partida presupuestaria | Instalación de fregadero y grifería | Contra qué estimación se compara |
| Etapa | Adquisición, remodelación, tenencia, financiamiento, venta, renta | Evita mezclar obra, compra, deuda y operación de renta |

Ejemplo: una factura de una tienda puede contener pintura para cocina y grifería para baño principal. Se conserva una factura y se distribuyen sus líneas; no se crean dos obligaciones por pagar. Si una misma línea sirve para ambos espacios, sus asignaciones deben sumar exactamente el importe de la línea.

Flujo propuesto: adjuntar o capturar → borrador manual/IA → clasificar y distribuir → revisar → aprobar → costo real reconocido → registrar pago o aplicación de anticipo → conciliar. La captura de un archivo, extracción IA o programación de un pago no cambia por sí sola gastos ni caja.

## 3. Historias solicitadas · núcleo de la ampliación

### HU-41. Administrar categorías y productos de gastos

**Como** propietario, **quiero** crear categorías y productos/servicios reutilizables, **para** clasificar las facturas de forma consistente sin depender de una lista fija.

Prioridad P0. Dependencias: HU-21, HU-22, HU-38. Estado: En verificación local; publicación pendiente.

Criterios de aceptación:

- Crear, editar, buscar y desactivar categorías; código e ID estable, nombre, descripción y tipo de costo sugerido. Duplicados de nombre/código se advierten dentro de la cuenta.
- Crear productos/servicios con nombre, descripción, SKU opcional, unidad y categoría sugerida. El precio sugerido es editable; cambiar el catálogo no altera facturas ni presupuestos anteriores.
- Alta rápida desde la factura sin perder lo escrito. No obliga a crear un producto de catálogo para cada ticket: admite un concepto libre identificable.
- Desactivar impide nuevas selecciones, conserva documentos y etiquetas históricas. Reasignar un registro anterior requiere motivo y auditoría; no cambia importes.
- Migrar categorías existentes sin reinterpretar automáticamente sus significados ni modificar partidas/costos históricos. Conservar la relación anterior y pedir revisión cuando sea ambigua.

Prueba clave: desactivar una categoría usada no elimina su factura ni modifica el total histórico; un usuario no puede editar catálogos de otro propietario.

### HU-42. Distribuir presupuesto y gastos por centro de costo

**Como** inversionista, **quiero** centros como cocina, patio y baño principal, **para** identificar qué espacio consume el presupuesto.

Prioridad P0. Dependencias: HU-20, HU-22, HU-41. Estado: En verificación local; publicación pendiente.

Criterios de aceptación:

- Crear centros por propiedad; plantilla inicial editable, nombres repetidos controlados, varios baños/unidades identificables y opciones «Toda la casa», «Gastos generales» y «Sin asignar».
- Distribuir cada partida presupuestaria entre centros por importe o porcentaje; sumar 100% y conservar exactitud a centavos con regla de redondeo visible. Mantener una categoría independiente del centro.
- Dividir una línea de factura entre centros y, si corresponde, propiedades; conservar el documento y total únicos. Impuesto, descuentos y flete se distribuyen con la misma regla o mediante asignación explícita que concilie.
- Congelar las asignaciones de la base inicial aprobada. Para presupuestos antiguos ya aprobados, crear un mapeo analítico versionado posterior, identificado como tal, sin fingir que existía al aprobar la base.
- Los gastos anteriores quedan «Sin asignar» hasta una clasificación explícita; siempre participan en el total. No asignar automáticamente costos comunes a cocina o baño por coincidencias de texto.
- Cambiar o desactivar un centro usado no borra su historia. No se permite sumar el total de la factura y sus distribuciones como gastos independientes.

Prueba clave: factura de $1,080 distribuida $648 a cocina y $432 a baño conserva $1,080 en la propiedad y en cuentas por pagar. El impuesto es el importe del documento, no una tasa de Georgia presupuesta por el sistema.

### HU-43. Capturar facturas detalladas y términos de pago

**Como** administrador, **quiero** registrar la factura completa en una pantalla, **para** controlar el gasto real y su obligación de pago.

Prioridad P0. Dependencias: HU-21, HU-22, HU-23, HU-41, HU-42. Estado: En verificación local; publicación pendiente.

Criterios de aceptación:

- Encabezado: número de factura, proveedor, fecha de emisión, fecha de recepción, propiedad principal, moneda USD, referencia a orden/contrato opcional, terms, vencimiento y total del documento. Tickets sin número conservan ese hecho y reciben un folio interno distinto.
- Terms: contado, al recibir, Net 7/15/30/45/60 y personalizado. Guardar texto original, plazo y base de cálculo; permitir vencimiento explícito que prevalezca con motivo. Separar fecha de factura, acción de registro y fecha de pago.
- Líneas: producto/servicio, descripción del producto, SKU opcional, cantidad, unidad, precio unitario, descuento, subtotal, impuesto, cargos asignados, categoría, tipo de costo, centro y partida presupuestaria. El valor se calcula y se contrasta con el documento; también admitir una línea por importe global.
- Descuentos de pronto pago, como 2/10 Net 30, se registran como condición y posible beneficio, no como crédito ganado automáticamente. La aplicación efectiva requiere evidencia del pago y ajuste explícito.
- Borradores editables y recuperables. Aprobar exige conciliar subtotal, descuentos, impuestos y cargos con el total; presentar cualquier diferencia y bloquear una aprobación incongruente.
- Documento aprobado mantiene original e historial; una corrección usa el mecanismo de ajuste/crédito correspondiente, sin editar silenciosamente importes ya pagados. Retención afecta exigibilidad y no reduce el gasto reconocido.
- Detección de duplicados por proveedor+número y coincidencias de fecha/importe/documento; alerta explicable, excepción justificada y reintentos idempotentes. No usar solo el número como identificador global entre proveedores.
- Factura «ya pagada» puede preparar factura y pago vinculado con evidencia, pero debe impedir que la importación bancaria o un reintento registren el pago otra vez.

Prueba clave: factura Net 30 con dos centros, impuestos, descuento, pago parcial y retención concilia total, vencimiento, costo y saldo; volver a enviar la misma solicitud no duplica registros.

### HU-44. Adjuntar y gestionar PDF o fotos desde la factura

**Como** responsable de obra, **quiero** cargar el comprobante desde la factura o el teléfono, **para** no depender de guardarlo antes en otra pantalla.

Prioridad P0. Dependencias: HU-04, HU-43. Estado: En verificación local; publicación pendiente.

Criterios de aceptación:

- Subir PDF y fotos JPG/PNG/WebP desde el formulario, arrastrar archivos o usar la cámara donde el navegador lo permita; vista previa, zoom, rotación visual y varias páginas/archivos por factura.
- Conservar original, hash, fecha, autor y versiones; señalar qué archivo respalda cada factura. La rotación/compresión de vista previa no sustituye el original.
- Bandeja «Pendiente de clasificar», «Borrador», «En revisión», «Aprobado» y «Rechazado», con filtros por propiedad/proveedor/fecha y búsqueda por número/descripción.
- Detectar el mismo archivo ya cargado; permitir distinguir PDF con varias facturas y seleccionar páginas sin crear obligaciones duplicadas. Guardar el borrador si falla la conexión y permitir reintento sin pérdida.
- Distinguir factura, recibo de pago, cotización y estado de cuenta: adjuntar uno no convierte automáticamente los demás en gasto.
- Definir límites visibles de tamaño, páginas y formatos. HEIC de iPhone requiere conversión compatible o mensaje claro antes de cargar; no prometer compatibilidad actual.
- El permiso de consultar una propiedad no concede acceso automático a todos sus adjuntos. Descarga y vista previa deben validar el mismo alcance de la factura en el servidor.

Prueba clave: factura multipágina puede consultarse desde su registro; cargar un PDF por segunda vez avisa; una cuenta ajena no puede descargarlo conociendo su ID.

### HU-45. Crear un borrador de factura mediante imagen e IA

**Como** administrador, **quiero** que el sistema lea una foto o PDF, **para** reducir digitación y revisar los datos antes de registrarlos.

Prioridad P1, solicitada expresamente. Dependencias: HU-41 a HU-44. Estado: Pendiente.

Criterios de aceptación:

- Acción explícita «Leer con IA» sobre un comprobante autorizado; extraer proveedor, número, fechas, terms, vencimiento, moneda, productos, descripciones, cantidades, unidades, precios, descuentos, impuestos y totales cuando estén visibles.
- Presentar documento y borrador lado a lado; vincular campos con página/evidencia cuando el servicio lo permita, señalar ilegibles y discrepancias. Dato no encontrado queda vacío: no inventar número, fecha, proveedor, cantidad o impuesto.
- Proponer categoría, producto y centro a partir de catálogos/propiedad elegida, distinguiendo una inferencia del texto leído. El centro no suele venir en el comprobante y necesita confirmación. No crear proveedores/categorías automáticamente.
- Ninguna extracción aprueba, paga, envía mensajes ni modifica presupuesto. El usuario revisa y confirma el borrador; el servidor recalcula importes independientemente de la IA.
- Detectar facturas repetidas y documentos con múltiples comprobantes. Reprocesar actualiza una revisión del borrador, conserva la corrección humana y no duplica la obligación.
- Configuración del servicio en servidor con credenciales cifradas, límites de uso y estado de proceso; mostrar qué servicio recibe el archivo y requerir habilitación explícita del propietario antes del primer envío. Claves de ATTOM e IA independientes.
- Tratar texto del PDF como datos: instrucciones incrustadas no pueden ordenar pagos, llamadas a otros servicios, cambios de permisos o acceso a otros expedientes. Enviar únicamente documentos autorizados para esa operación.
- Ruta manual disponible ante fallos. Guardar proveedor/modelo, fecha, campos extraídos, correcciones y consumo informado; no inventar confianza si el proveedor no la devuelve ni tomarla como garantía de exactitud.
- Validación previa con al menos 20 comprobantes de prueba autorizados o sintéticos: tickets largos, fotos inclinadas/borrosas, PDFs multipágina, créditos, impuestos, descuentos y distintos proveedores. Medir exactitud por campo, conciliación, tiempo y costo; 100% de documentos ilegibles/incongruentes del conjunto deben quedar pendientes de revisión, nunca aprobados automáticamente.

Decisión técnica: comparar Azure Document Intelligence y Amazon Textract con los mismos ejemplos; seleccionar por resultados reales, manejo de líneas, privacidad, integración y costo por documento. No se contrató un proveedor ni se enviaron facturas en esta investigación. [Fuentes R5–R6](#6-investigación-y-opciones).

### HU-46. Comparar presupuesto inicial, vigente y gastos reales

**Como** inversionista, **quiero** ver la desviación de gastos por propiedad, categoría y centro, **para** saber dónde estoy consumiendo el presupuesto y cuál será el costo final.

Prioridad P0. Dependencias: HU-20, HU-23, HU-26, HU-41 a HU-43. Estado: En verificación local; publicación pendiente.

Criterios de aceptación:

- Tabla con presupuesto inicial aprobado, cambios aprobados, presupuesto vigente, gasto reconocido, facturas pendientes de aprobación, pagos aplicados, saldo pendiente, retenciones, compromisos pendientes de facturar, costo por terminar y costo final previsto.
- Desgloses por propiedad → centro → categoría → producto/línea, y filtros por etapa, proveedor, fechas y estado; exportación CSV/reporte con misma base, corte y cifras que la pantalla.
- Presupuesto inicial inmutable y referencia de su aprobación. Si no existe base, mostrar «Sin presupuesto aprobado», sin fabricar una a partir del valor actual.
- Cada total permite abrir las facturas/líneas que lo componen y sus comprobantes autorizados. Mostrar «Sin asignar» y «Sin presupuesto»; no ocultar excesos porque el presupuesto de una categoría sea cero.
- Costo real reconocido incluye facturas aprobadas netas de créditos y saldos iniciales conciliados una sola vez. Facturas por revisar se muestran separadas como exposición pendiente, sin desaparecer ni sumarse al costo aprobado.
- Pagos y anticipos no son un segundo gasto. Principal, aportes, depósitos restringidos y transferencias se muestran en caja/deuda, fuera del gasto de remodelación.
- Diferencia real y final prevista contra base inicial y vigente; exceso positivo y ahorro negativo con etiquetas claras. Cuando el denominador sea cero, porcentaje «No aplica / sin presupuesto».
- Comparación histórica «al corte» respeta fecha efectiva y fecha de registro, y muestra ajustes posteriores; no recalcula silenciosamente una exportación histórica con clasificación actual.

Prueba clave: repartir una factura entre centros cambia la distribución y nunca el total; emitir crédito y aplicar anticipo modifica las columnas correctas sin doble conteo.

## 4. Historias complementarias recomendadas

Estas seis historias convierten la captura de comprobantes en un control preventivo. Amplían módulos existentes; no crean una segunda contabilidad.

### HU-47. Vincular orden de compra, recepción y factura

**Como** responsable de obra, **quiero** comparar lo autorizado, lo recibido y lo facturado, **para** detectar faltantes y cobros excesivos antes de aprobarlos.

Prioridad P1. Dependencias: HU-21, HU-42, HU-43. Estado: En verificación local; publicación pendiente.

- Orden con proveedor, productos/servicios, cantidades, precios, centro y presupuesto; aprobación y cambios versionados. Reutilizar contratos de HU-21 cuando corresponda.
- Recepción parcial con fecha, responsable, cantidades/avance y foto/comprobante; documentar materiales dañados o no entregados.
- Factura puede consumir parcialmente una o varias órdenes, conservando saldos por línea. Alertar diferencias de precio, cantidad o total y exigir motivo para aprobar excepción; factura sin orden admite vía explícita.
- Solo compromisos aprobados entran en el pronóstico; facturarlos reduce su pendiente, no aumenta dos veces el costo.

Prueba clave: orden de diez unidades, recepción de seis y factura de ocho muestra dos unidades por justificar y conserva cuatro por recibir.

### HU-48. Revisar y aprobar gastos con permisos por función

**Como** propietario, **quiero** que mi equipo prepare y revise comprobantes con límites, **para** distribuir trabajo sin perder control sobre el dinero.

Prioridad P1. Dependencias: HU-38, HU-39, HU-43, HU-44. Estado: En verificación local; publicación pendiente.

- Permisos separados de cargar archivo, crear borrador, clasificar, revisar, aprobar y registrar pago; aplicar alcance por propiedad/centro. El propietario mantiene inicialmente todas las aprobaciones.
- Flujo Borrador → En revisión → Aprobado/Rechazado; observaciones y devolución para corregir. Umbrales configurables de importe/sobrecosto y bloqueo de autoaprobación cuando se habilite separación de funciones.
- Cambios de importe, proveedor o asignación durante revisión invalidan la revisión previa; conflictos simultáneos se rechazan con mensaje recuperable.
- La revocación de acceso impide leer/editar nuevos borradores y sus archivos. No exponer expediente crediticio, cuentas completas ni comprobantes de propiedades no autorizadas.
- Facturas aprobadas se corrigen mediante ajustes auditados. No se envían invitaciones ni se amplían roles existentes sin acción explícita del propietario.

Prueba clave: capturista autorizado crea un borrador; intentar aprobarlo o marcar un pago sin permiso falla también llamando directamente a la API.

### HU-49. Gestionar vencimientos, descuentos y pagos planificados

**Como** administrador, **quiero** una agenda de obligaciones por terms, **para** prever liquidez y evitar vencimientos omitidos.

Prioridad P1. Dependencias: HU-12, HU-23, HU-43. Estado: Pendiente.

- Vistas próximas a vencer, vencidas y antigüedad 1–30/31–60/61–90/más de 90 días; mostrar importe exigible, retenido, en disputa y crédito disponible por separado.
- Programar pagos previstos por fecha/importe/cuenta como proyección; no marcarlos pagados ni descontarlos de caja real. Avisos dentro de la aplicación al abrir/actualizar, con fecha de cálculo visible.
- Calcular efecto del calendario sobre la caja prevista sin repetir facturas ya contempladas en el presupuesto/pronóstico. Aplicar pagos reales, anticipos, créditos y retenciones usando HU-23.
- Señalar ventanas de pronto pago; no suponer descuento aprovechado sin evidencia. Los terms personalizados no se interpretan como plazos legales automáticos.
- Exportar lista de obligaciones; enviar pagos bancarios, emails o recordatorios programados externos queda fuera de esta entrega.

Prueba clave: pago parcial de $400 sobre factura de $1,000 deja $600, pero si $100 siguen retenidos solo $500 son exigibles; planificar esos $500 no cambia el saldo real.

### HU-50. Controlar devoluciones y créditos de materiales

**Como** responsable de obra, **quiero** registrar qué material devolví y qué crédito recibí, **para** recuperar costos sin perder trazabilidad.

Prioridad P1. Dependencias: HU-23, HU-43, HU-47. Estado: Pendiente.

- Solicitud de devolución vinculada a factura y producto, cantidad, centro, motivo, evidencia, estado y proveedor. No permite devolver más que lo adquirido neto de devoluciones previas.
- Distinguir solicitud, material entregado, crédito emitido y dinero reembolsado. Solicitar una devolución no reduce el gasto; la nota de crédito aprobada sí lo ajusta según la conciliación existente.
- Prorratear impuesto/descuento original, registrar restocking fee o flete como costo separado y conservar dimensiones de origen.
- Aplicar crédito a saldo o registrar devolución de efectivo con referencia única; no contabilizar ambos como recuperación duplicada.

Prueba clave: devolución aprobada reduce costo de la misma cocina/categoría; un reembolso de ese crédito afecta caja sin volver a reducir el costo.

### HU-51. Detectar sobrecostos y actualizar la previsión de cierre

**Como** inversionista, **quiero** avisos por centro y causa de desviación, **para** decidir correcciones antes de consumir toda la reserva.

Prioridad P1. Dependencias: HU-25, HU-26, HU-46, HU-47. Estado: En verificación local; publicación pendiente.

- Umbrales configurables por porcentaje e importe, gastos sin presupuesto, facturas sin clasificar y consumo de contingencia; avisos por centro/categoría y estado revisado/resuelto.
- Distinguir desviación por cantidad, precio, alcance nuevo, retrabajo y demora cuando los datos lo permitan; falta de información se etiqueta, no se inventa una causa.
- Costo por terminar desglosado entre compromiso pendiente y trabajo todavía no contratado; actualización manual con responsable, fecha, motivo y evidencia. No derivarlo únicamente de un porcentaje subjetivo de avance.
- Proyectar impacto de demora y sobrecosto sobre utilidad y capital requerido con motores existentes; proponer revisión, no alterar presupuesto aprobado ni préstamo automáticamente.
- Mostrar cobertura, fecha y fuente del pronóstico. Facturas pendientes de aprobación se vinculan al compromiso correspondiente para no contarlas otra vez como riesgo adicional.

Prueba clave: factura que consume un compromiso cambia incurrido y pendiente, pero no aumenta por sí sola el costo final previsto.

### HU-52. Capturar gastos recurrentes y reembolsos de obra

**Como** administrador, **quiero** plantillas para gastos repetidos y compras pagadas por el equipo, **para** registrar todos los costos sin duplicarlos.

Prioridad P2. Dependencias: HU-23, HU-43, HU-44, HU-48. Estado: En verificación local; publicación pendiente.

- Plantillas de servicios, seguros, alquileres de equipos y gastos generales: proveedor, periodicidad, vigencia, centro y categoría. Primera entrega genera borrador al solicitarlo, no facturas aprobadas en segundo plano.
- Cada período requiere comprobante y validación del importe real; un cambio de tarifa no reescribe períodos anteriores. Avisar período repetido o plantilla vencida.
- Solicitud de reembolso con comprador/beneficiario, proveedor real, fecha, conceptos, propiedad, centros y comprobante. Distinguir empleado/propietario que adelantó fondos del proveedor que emitió la factura.
- Aprobar reconoce un solo gasto y una obligación con quien adelantó dinero. Pagar el reembolso salda esa obligación, sin repetir gasto ni crear una deuda adicional con el proveedor ya pagado.
- Usar conciliación bancaria y referencias existentes; no acceder a tarjetas ni cuentas personales automáticamente.

Prueba clave: compra de $100 pagada personalmente y luego reembolsada mantiene $100 de gasto total, con cada movimiento y beneficiario trazables.

## 5. Comparativo: reglas y ejemplo de aceptación

Definiciones para este producto, a validar con los motores existentes al implementar; no equivalen a una política fiscal o contable impuesta:

- **B0:** presupuesto inicial aprobado; nunca se sobrescribe.
- **Bv:** B0 + modificaciones presupuestarias aprobadas. Reclasificar centros conserva el total; no es permiso para aumentar Bv.
- **A:** costo real reconocido neto de créditos, con conciliación de saldos iniciales/cierres existentes. Borradores y cotizaciones no forman parte de A.
- **C:** compromiso aprobado todavía no facturado, neto de cancelaciones. Una factura aprobada asociada aumenta A y reduce C en el importe correspondiente.
- **U:** costo adicional por terminar todavía no cubierto por C. Debe excluir el trabajo ya facturado.
- **Costo final previsto:** A + C + U. Si HU-26 ya guarda un único restante que incluye C, usar A + restante, nunca sumar C otra vez.
- **Desviación real:** A − B0 y A − Bv. **Desviación final prevista:** (A + C + U) − B0 y − Bv.
- **Presupuesto disponible:** Bv − A; no representa dinero en banco ni ahorro final garantizado.
- **Saldo por pagar:** obligaciones netas menos pagos/aplicaciones/créditos, según HU-23; separar retención de lo exigible.

| Cocina · ejemplo ilustrativo USD | Importe |
| --- | ---: |
| Presupuesto inicial B0 | 10,000 |
| Cambios aprobados | 1,500 |
| Presupuesto vigente Bv | 11,500 |
| Facturas aprobadas | 7,000 |
| Créditos aprobados | −500 |
| Costo real A | 6,500 |
| Pagos/aplicaciones | 4,000 |
| Saldo por pagar, sin retenciones en este ejemplo | 2,500 |
| Compromiso pendiente C | 2,500 |
| Trabajo adicional por contratar U | 1,000 |
| Costo final previsto | 10,000 |
| Diferencia final frente a presupuesto inicial | 0 |
| Diferencia final frente a vigente | −1,500 |

Los $4,000 pagados no se suman a los $6,500 de costo. Los $5,000 todavía disponibles del presupuesto vigente no son caja libre ni ahorro final: faltan trabajos por terminar.

## 6. Investigación y opciones

Fuentes oficiales consultadas el 7 de octubre de 2026. Son referencias de producto y diseño, no integraciones contratadas ni una garantía de rendimiento para nuestros documentos. No se evaluaron precios ni se recomienda comprar otra plataforma en esta etapa.

| Referencia | Función documentada | Aplicación propuesta en Rehab Atlanta |
| --- | --- | --- |
| R1. [Buildertrend: Bills](https://buildertrend.com/help-article/bills-overview/) | Entrada de comprobantes como borradores, extracción de datos y revisión previa | Bandeja móvil, borrador IA y aprobación separada; HU-44/HU-45/HU-48 |
| R2. [Buildertrend: Purchase Orders & Bills](https://buildertrend.com/help-article/purchase-orders-bills-overview/) | Crear facturas desde órdenes y relacionarlas con el trabajo | Orden → recepción → factura; HU-47; recepción y reglas propuestas propias |
| R3. [Buildertrend: Financial Management FAQs](https://buildertrend.com/help-article/financial-management-faqs/) y [Job Costing & Budget](https://buildertrend.com/help-article/job-costing-budget-overview/) | Diferencia entre categoría, código y producto; comparación de costos por tipos | Catálogos separados, clasificación consistente y comparativo HU-41/HU-46 |
| R4. [QuickBooks: Upload your receipts](https://quickbooks.intuit.com/learn-support/en-us/help-article/import-transactions/upload-receipts-bills-quickbooks-online/L862MmZHn_US_en_US) | Extracción para revisar y asociación con transacciones existentes | Asociar comprobante/factura/pago, evitando capturar el mismo costo otra vez |
| R5. [Amazon Textract: AnalyzeExpense](https://docs.aws.amazon.com/textract/latest/APIReference/API_AnalyzeExpense.html) y [Análisis de facturas](https://docs.aws.amazon.com/textract/latest/dg/analyzing-document-expense.html) | Campos de resumen y líneas de factura/recibo; procesamiento síncrono y asíncrono | Candidato a extracción especializada; comparar precisión y operación antes de elegir |
| R6. [Microsoft: modelo de facturas](https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/prebuilt/invoice?view=doc-intel-3.0.0) | OCR y extracción de campos y líneas de facturas | Segundo candidato; confirmar versión, formatos, límites y tarifas vigentes durante implementación |
| R7. [Procore: Cost Management](https://www.procore.com/cost-management) | Visibilidad de costos comprometidos, previstos y reales | Mostrar columnas separadas y avisos sobre la previsión, HU-46/HU-51 |

Recomendación de diseño: fortalecer primero el registro manual, clasificación y presupuesto base; incorporar IA sobre ese mismo flujo. Una extracción rápida sin clasificación y aprobación fiables solo acelera errores. La combinación de órdenes/recepciones, devoluciones y vencimientos añade control preventivo a las fotos de facturas.

Otras opciones para evaluar en una fase posterior: recepción por correo dedicado; conexión bidireccional con QuickBooks/Xero; conexión bancaria; firma o envío de órdenes; inventario y transferencias de materiales entre obras. Requieren nuevas historias de integración, permisos, idempotencia y definición de sistema de registro. No se incluyen como conexiones activadas en HU-41 a HU-52.

## 7. Orden de implementación y condiciones de entrega

| Bloque | Historias | Resultado verificable |
| --- | --- | --- |
| A. Clasificación | HU-41 + HU-42 | Categorías, productos y centros editables; presupuesto inicial preservado |
| B. Captura y control básico | HU-43 + HU-44 + HU-46 | Factura completa con PDF/foto y comparación real contra base inicial |
| C. Automatización asistida | HU-45 + HU-48 | IA crea borradores revisables y roles autorizados colaboran |
| D. Control preventivo | HU-47 + HU-49 + HU-50 + HU-51 | Compras, recepción, vencimientos, devoluciones y previsión enlazados |
| E. Cobertura de gastos repetidos | HU-52 | Recurrentes y reembolsos sin duplicidad |

HU-46 se entrega antes de la IA para que la captura manual ya tenga valor. HU-45 no exige habilitar colaboradores: puede funcionar solo con el propietario; HU-48 añade delegación después. Se mantienen las 39 historias completadas y HU-03 en verificación; HU-41/HU-42/HU-43/HU-44/HU-46 están en verificación; las otras siete permanecen pendientes.

### Trabajo técnico transversal necesario

- Reutilizar el libro y los IDs actuales; migraciones aditivas, respaldo, comparación antes/después, despliegue compatible y ruta de recuperación. No crear una segunda colección de facturas desconectada de pagos/draws/reportes.
- El libro actual se guarda como un JSON por cuenta con límite de 900,000 caracteres; además hay límites de 2,000 facturas y 200 archivos/versiones por expediente. Antes de habilitar captura masiva/OCR, normalizar facturas/líneas/asignaciones/borradores en tablas paginadas y revisar cuotas de documentos. Mantener archivos en R2; no incrustar fotos/PDF ni respuestas extensas de IA en el libro. Migración idempotente y saldos antes/después idénticos son condición de entrega de HU-43/HU-44.
- Mantener exactitud monetaria a centavos y cantidades/precios con precisión suficiente; conciliación de impuestos/descuentos y redondeo determinista. No calcular impuestos estatales automáticamente sin una historia específica validada.
- Revisión optimista de versiones, transacciones atómicas e idempotencia en importaciones y aprobaciones; una falla entre archivo y factura debe ser recuperable y no dejar gasto duplicado.
- Permisos en cada lectura, edición, aprobación, exportación y descarga; registros de actor/motivo y pruebas de aislamiento entre cuentas/propiedades. Formularios y etiquetas en español; números de factura/SKU conservan ceros y letras originales.
- Pruebas de regresión de HU-20 a HU-26, HU-29/HU-33 a HU-40; conciliar propiedad, cartera, reportes y banco. Una factura reconocida sigue siendo el mismo costo en todos los módulos.

### Cierre de cada historia

Solo pasa a Completada después de cumplir sus criterios, probar los casos de aceptación, publicarse y actualizar el seguimiento. Para HU-45, si faltan cuenta del servicio, configuración o prueba real de extracción, queda En verificación; no se marca completada con una simulación. La aprobación de esta planificación no envía documentos a proveedores de IA ni concede permisos a colaboradores.

Actualización técnica 2026-10-08: migración 0009 separa facturas, líneas, asignaciones, historial, borradores y cortes; conserva respaldo previo. Límite de documentos revisado a 1,000 versiones por propiedad, 10 MB por archivo. La API contable heredada todavía hidrata el libro completo; no se promete captura ilimitada.
