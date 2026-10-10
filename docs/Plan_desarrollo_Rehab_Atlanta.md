# Plan de desarrollo de Rehab Atlanta

> Actualización del 9 de octubre de 2026: el usuario canceló la integración ATTOM (HU-03). Se conserva la captura manual y los valores existentes. El retiro está implementado localmente y pendiente de publicación; los apartados históricos de ATTOM describen el alcance anterior. Ver [detalle del cambio](Retiro_ATTOM_y_eliminacion_propiedades.md).

Plan original: 7 de septiembre de 2026. Última ampliación de alcance: 7 de octubre de 2026 (52 historias). Este documento conserva el alcance y los criterios; el estado de implementación y las validaciones pendientes se consultan en [Seguimiento del desarrollo](Seguimiento_Rehab_Atlanta.md). HU-39/HU-40 se documentan en [Entrega de equipo y reportes](HU-39-HU-40.md).

## 1. Objetivo y enfoque

Administrar el ciclo completo de una inversión residencial: identificar oportunidades, evaluar compra y salidas, adquirir con hard money, controlar remodelación y efectivo, vender o refinanciar para mantener en renta. El Plan B se analiza antes de comprar y se actualiza durante la ejecución.

El flujo principal propuesto es:

Oportunidad → análisis de venta y renta → oferta → contrato y diligencia → cierre con hard money → remodelación → comercialización → venta y liquidación.

Desde el análisis y la comercialización existe una segunda ruta: evaluación de refinanciamiento → aprobación del lender → liquidación del hard money → operación en renta → eventual venta. Evaluar esta ruta no cambia automáticamente el estado de la propiedad ni solicita un préstamo.

Supuestos iniciales: viviendas de inversión en Georgia, comenzando por Atlanta y los condados configurados; USD, sqft y fechas reales; renta residencial de largo plazo; un propietario de la aplicación al inicio. Los términos de cada lender se capturan por préstamo. Un préstamo convencional para inversión requiere evaluar al prestatario y la propiedad; no se presupone ocupación como vivienda principal.

## 2. Qué contiene el Excel

Fuente: `Copy of calculadora_fix_flip_779 Humphries Street SW.xlsm`. Se revisaron siete hojas visibles, sus valores guardados, fórmulas, comentarios y validaciones. Se identificaron 354 celdas con fórmulas y no se encontraron valores de error guardados. Se recalcularon de forma independiente los resultados principales de venta y renta. No se ejecutó Excel ni se recalcularon todas sus fórmulas con su motor. Aunque la extensión es .xlsm, no se encontró el componente `xl/vbaProject.bin`; no se ejecutaron macros.

Los textos de guía y comentarios se trataron como documentación del modelo, no como instrucciones para modificar archivos, consultar enlaces o efectuar inversiones. El archivo original se conserva.

| Hoja | Contenido comprobado | Integración propuesta |
| --- | --- | --- |
| Análisis Fix & Flip | Compra, ARV, área, reparación, deuda, intereses, cierre, utilidad y efectivo; C5:C21, H9:L19, D24:D36 | Motor de análisis previo a compra y financiamiento |
| Proyección mensual | Egresos del inversionista, meses 1–12 y acumulado; C5:O16 | Calendario completo de efectivo, desembolsos y salidas |
| Regla 70% | Oferta máxima, utilidad por mes y estrés; B5:F26 | Filtro inicial y sensibilidad vinculada al modelo detallado |
| Estimador Reparaciones | Tabla por edad, ARV y condición; A5:D9 y G5:G13 | Estimación rápida y enlace al presupuesto detallado existente |
| Dashboard | Indicadores, sensibilidad ARV y comprobaciones; A5:N52 | Decisiones, alertas y cartera |
| Plan B - Renta | Refinanciamiento, renta, vacancia, gastos, hipoteca, DSCR y retención; A7:N22 | Evaluación alternativa y posterior operación de renta |
| Guía | Definiciones y reglas del modelo; A3:B21 | Ayuda contextual y diccionario de cálculos |

### Caso de referencia del archivo

Estos son supuestos y resultados del archivo, no cotizaciones de préstamo ni una valoración validada del inmueble.

| Variable o resultado | Valor | Ubicación |
| --- | ---: | --- |
| Precio de compra | $95,000 | Análisis Fix & Flip!C5 |
| ARV | $240,000 | Análisis Fix & Flip!C6 |
| Área habitable | 1,274 sqft | Análisis Fix & Flip!C7 |
| Reparación utilizada | $70,070 | Análisis Fix & Flip!H11 |
| Plazo del flip | 6 meses | Análisis Fix & Flip!C10 |
| Tasa hard money utilizada | 9.75% anual | Análisis Fix & Flip!C12 |
| Límite calculado con 70% del ARV | $168,000 | Análisis Fix & Flip!D28 |
| Intereses estimados | $8,190 | Análisis Fix & Flip!L9 |
| Utilidad del flip antes de impuestos sobre la renta | $43,656 | Análisis Fix & Flip!L19 |
| Importe denominado fondos para cerrar | $29,174 | Análisis Fix & Flip!D35 |
| ROI según la definición del Excel | 149.64% | Análisis Fix & Flip!D36 |
| Nuevo préstamo propuesto | $180,000 | Plan B - Renta!B11 |
| Renta bruta supuesta | $3,500/mes | Plan B - Renta!B17 |
| Cuota de principal e interés | $1,258.59/mes | Plan B - Renta!G19 |
| Flujo de renta calculado | $1,008.75/mes | Plan B - Renta!G20 |
| Efectivo neto propuesto al refinanciar | $6,600 | Plan B - Renta!B16 |

### Hallazgos que deben resolverse al trasladar el modelo

| ID | Evidencia | Implicación y tratamiento |
| --- | --- | --- |
| H01 | Estimador Reparaciones!G10 = $35/sqft y G11 = $44,590; Análisis Fix & Flip!C8 contiene un valor fijo de $55/sqft y H11 = $70,070 | El vínculo anunciado en el estimador no existe en ese input. Diferencia de $25,480. Ofrecer modos rápida, detallada y manual, con una sola fuente activa y explicación del cambio. |
| H02 | Análisis!D26 = $85,500, 90% de compra; D28 = $168,000, 70% del ARV; D29 = $70,070 | Son conceptos distintos que podrían coexistir, pero el archivo no concilia su uso. Compra financiada más obra suma $155,570 y deja $12,430 sin asignar frente al límite. Separar límite, compromiso aprobado, desembolso de compra, reserva y saldo utilizado. Confirmar bases de intereses y puntos. |
| H03 | D35 incluye los seis meses de intereses, servicios y administración; Proyección mensual!C15 = $18,932.33 y O15 = $29,174 | D35 no describe solamente el efectivo del día de cierre. Separar efectivo al cierre, aportaciones posteriores y capital máximo requerido. El ROI de 149.64% depende de este denominador y de supuestos de deuda incompletos. |
| H04 | Proyección mensual!C5:N16 solo muestra egresos seleccionados y llega a 12 meses | Faltan pagos de obra y reembolsos del lender, ingresos de venta/renta/refinanciamiento y liquidación del principal. Agregar un calendario por fechas con saldo y brecha de liquidez. |
| H05 | Dashboard!I44 dice oferta sobre la regla; Regla 70%!B8:B11 muestra máximo $97,930, oferta $95,000 y holgura $2,930 | El texto está desactualizado respecto de los números. Las conclusiones deben generarse a partir de los datos actuales y distinguir cada criterio. |
| H06 | Análisis!C9 = 0%; Dashboard!H51:I51 calcula utilidad de $36,649 al restar 10% de reparación | Mantener una reserva explícita con porcentaje editable. La reducción de $7,007 es aritméticamente correcta, pero también hay que recalcular financiamiento y plazo si el escenario los modifica. |
| H07 | Plan B!B7 = mes 6; B9 toma el límite de $168,000 como saldo; B16 supone $6,600 recibidos | Usar payoff real o proyectado por fecha, tasación independiente y clasificación del refinanciamiento. Un resultado positivo de caja no prueba elegibilidad para retirar ese dinero. |
| H08 | Plan B!B20 combina mantenimiento y CapEx; G18 se denomina NOI y L10 cap rate | Separar mantenimiento operativo de reserva de reposición. Mostrar NOI, flujo tras reserva y cobertura con definiciones explícitas para permitir comparaciones. |
| H09 | Plan B!L12 determina VIABLE solo con flujo y DSCR ≥ 1.20 | Es una prueba operativa. Agregar estados separados de viabilidad financiera, elegibilidad crediticia y situación de caja. El DSCR del inmueble no acredita aprobación convencional. |
| H10 | Plan B!L21 suma flujo, amortización y apreciación; L22 muestra utilidad del flip | No son retornos comparables por sí solos. Comparar ambas rutas al mismo horizonte, incluyendo venta terminal, costos de salida, deuda y aportaciones. La apreciación no es caja recibida. |
| H11 | Regla 70%!E20 = $43,730; Análisis!L19 = $43,656; Dashboard!I50 conserva costos actuales al cambiar oferta | El modelo simplificado difiere por definición ($74 en el caso base). Mantenerlo como filtro; resolver la oferta máxima con el motor completo cuando el precio cambia deuda, intereses o puntos. |
| H12 | Impuestos prediales durante el flip no aparecen como partida explícita en el análisis; Plan B sí usa $5,000/año | Incorporar impuestos y restantes costos aplicables en cada etapa. Identificar también escrow, depósitos recuperables, permisos, inspecciones, seguros, extensiones y costos de comercialización. |

## 3. Punto de partida de la aplicación

La aplicación existente es una base para presupuestar remodelaciones. Tiene propiedades independientes, 71 partidas en 15 categorías, cantidades y precios editables, contingencia, gastos periódicos, un importe real por partida, resumen por categoría, exportación CSV y consulta ATTOM con clave cifrada.

El campo actual de costo real es un acumulado manual: todavía no equivale a un registro de facturas, pagos, proveedores o comprobantes. La aplicación tampoco tiene un motor de compra/ARV, préstamos con desembolsos, liquidación de venta, refinanciamiento, contratos de renta o conciliación de caja. La integración ATTOM implementada consulta Property Detail; no se debe presuponer que ya incluye comparables de venta, rentas o valoración automática.

La base de datos actual contiene `properties` con un documento JSON por propiedad y `settings` con la clave cifrada por usuario. El desarrollo debe conservar esos datos e introducir estructura adicional para movimientos y estados.

## 4. Reglas del producto

1. Evaluar venta y renta antes de aprobar internamente una compra. Una aprobación interna no se muestra como aprobación del lender.
2. Diferenciar presupuesto original aprobado, revisiones, obligaciones contratadas, facturas, pagos y pronóstico pendiente. Una factura parcial no consume todo el contrato.
3. Separar costo económico, caja, principal de deuda y capital del inversionista. Un desembolso o reembolso del lender no es ingreso operativo ni utilidad.
4. Mantener una sola fuente activa por costo para evitar duplicar intereses, cierre, administración o reparación entre módulos.
5. Guardar fuente, fecha y estado de cada supuesto relevante: importado, estimado, cotizado, aprobado o real. Un dato faltante no se convierte en cero.
6. Evaluar salidas por fecha y condiciones. El vencimiento hard money, la fecha estimada de cierre de venta y la fecha factible de refinanciamiento son diferentes.
7. Empezar con alertas dentro de la aplicación. Correos, conexiones bancarias, solicitudes de préstamo y pagos automáticos requieren fases e integraciones específicas.

### Reglas financieras que afectan el Plan B

El ejemplo de Fannie Mae para cash-out exige, con excepciones documentadas, una primera hipoteca de al menos 12 meses y titularidad de al menos seis meses. La excepción de delayed financing contempla una compra sin hipoteca sobre el inmueble; no debe aplicarse automáticamente a una compra con hard money garantizado por esa casa. La venta anunciada debe retirarse dentro del plazo indicado por la guía. Estas son reglas de ese programa, no reglas universales de todos los prestamistas. [Fuente F1](https://selling-guide.fanniemae.com/sel/b2-1.3-03/cash-out-refinance-transactions).

Limited cash-out tiene condiciones y usos diferentes, incluido un límite de devolución de efectivo. Con el préstamo de $180,000 del archivo, el límite general citado en esa guía sería $2,000, salvo partidas/excepciones aplicables; los $6,600 modelados requieren revisar clasificación y términos. La propiedad en una LLC también puede requerir cambios de titularidad para el producto seleccionado. La aplicación debe registrar la revisión del lender y su evidencia. [Fuente F2](https://selling-guide.fanniemae.com/sel/b2-1.3-02/limited-cash-out-refinance-transactions).

La renta proyectada del inmueble y el ingreso que un lender acepta para calificar al prestatario son distintos. La guía de renta de Fannie Mae contempla documentación y experiencia de administración, entre otros factores. El expediente debe guardar el método y resultado confirmados por el lender, además del flujo económico del proyecto. [Fuente F3](https://selling-guide.fanniemae.com/sel/b3-3.8-01/rental-income).

Las reglas se guardarán con programa, fuente, vigencia y fecha de revisión. LTV, tasa, reservas, DTI y DSCR no tendrán umbrales universales codificados como aprobación garantizada. La operación en renta puede ser rentable y aun así necesitar efectivo adicional o no conseguir refinanciamiento a tiempo.

## 5. Historias de usuario

Prioridad P0: necesaria para evaluar o ejecutar de forma fiable la etapa correspondiente. P1: necesaria para completar la administración y el control de cartera. P2: ampliación posterior. El orden de entrega aparece en la sección 6; P0 no significa que todas las historias deban implementarse simultáneamente.

Cada historia incluye resultado comprobable y dependencias. Todas las nuevas historias parten de estado pendiente.

### A. Fundamentos y expediente

#### HU-01. Conservar y migrar las propiedades existentes

Como propietario de la aplicación, quiero conservar mis propiedades y presupuestos al ampliar el sistema para continuar trabajando sin volver a capturarlos.

- Aceptación: se conserva ID, propietario, dirección/APN, valores manuales, partidas, costos y referencia ATTOM. La migración se puede repetir sin duplicados y tiene respaldo y reversión probados.
- Aceptación: los importes reales acumulados se identifican como saldos iniciales sin soporte detallado; no se inventan facturas históricas. Sus totales concilian con la versión anterior.
- Prioridad: P0. Dependencias: ninguna. Evidencia: modelo actual `Property`, `properties.payload`.

#### HU-02. Administrar etapas y responsables

Como inversionista, quiero ver cada propiedad por etapa para saber qué decisión o actividad sigue.

- Aceptación: etapas de oportunidad, análisis, oferta, contrato, adquirida, obra, lista para comercializar, en venta, vendida, refinanciamiento, en renta y archivada. Análisis de Plan B puede coexistir con una propiedad en venta.
- Aceptación: cambios tienen fecha, responsable y motivo; las etapas cerradas conservan historial y archivar permite recuperar el expediente. No se infiere un cierre por una fecha estimada.
- Prioridad: P0. Dependencias: HU-01.

#### HU-03. Consolidar ficha y datos de ATTOM

Como analista, quiero completar la ficha por dirección o APN y condado para reducir captura y detectar datos que requieren verificación.

- Aceptación: consulta e importación selectiva conservan fuente/fecha y valores anteriores; no confunden área habitable con lote ni baños parciales con completos.
- Aceptación: identifica posibles duplicados por condado/APN, mantiene captura manual y muestra resultados ausentes o múltiples. La clave nunca aparece en respuestas ni reportes.
- Prioridad: P0. Dependencias: HU-01. Reutiliza integración actual; validación real con una clave y propiedad de prueba autorizadas.

#### HU-04. Guardar documentos por expediente

Como administrador, quiero asociar term sheets, presupuestos, fotos, facturas y cierres a la propiedad para respaldar cada decisión y movimiento.

- Aceptación: documentos privados vinculados a propiedad y, cuando aplique, préstamo, factura o tarea; versiones, fecha y permisos de descarga.
- Aceptación: límites y validación de archivos; no se ejecutan macros de archivos importados. El borrado de un movimiento no elimina automáticamente su comprobante.
- Prioridad: P0 para operación con comprobantes. Dependencias: HU-01. Requiere habilitar almacenamiento de archivos.

### B. Análisis previo a la compra

#### HU-05. Sustentar ARV y renta con comparables

Como analista, quiero registrar comparables de venta y renta para justificar los supuestos de salida.

- Aceptación: dirección, precio/renta, fechas, estado vendido/listado/rentado, área, condición, distancia, fuente y ajustes razonados; el usuario selecciona comparables y fija ARV/renta con evidencia.
- Aceptación: distingue listado de transacción cerrada y advierte información vieja o incompleta. Importación automática adicional queda sujeta a datos y licencia disponibles; la captura manual funciona desde el inicio.
- Prioridad: P0. Dependencias: HU-03. Evidencia: Análisis!C6; Plan B!B17; enlaces de Dashboard!A54:A57 no validados como comparables.

#### HU-06. Elegir una estimación rápida o detallada de obra

Como analista, quiero estimar por sqft al filtrar una oportunidad y por partidas al profundizar para utilizar un solo presupuesto de obra.

- Aceptación: modos rápida, detallada y monto manual son excluyentes; muestra cuál alimenta el análisis y por qué difiere del anterior. Conserva el catálogo de 71 partidas y sus referencias.
- Aceptación: contingencia y administración se aplican una sola vez sobre bases explícitas; paquetes y partidas superpuestas se revisan. Pasar de $35 a $55 por 1,274 sqft cambia el costo base en $25,480.
- Prioridad: P0. Dependencias: HU-01. Evidencia: H01 y H06.

#### HU-07. Crear versiones de análisis y escenarios

Como inversionista, quiero guardar escenarios base, conservador y adverso para comparar sin sobrescribir el análisis de compra aprobado.

- Aceptación: cada versión conserva precio, ARV, renta, presupuesto, préstamo, fechas, costos y versión del motor. Duplicar crea una versión independiente.
- Aceptación: cambios de ejecución generan pronóstico actualizado; la base aprobada sigue disponible y muestra diferencias.
- Prioridad: P0. Dependencias: HU-03, HU-06.

#### HU-08. Capturar el costo completo del flip

Como analista, quiero incluir adquisición, obra, tenencia, financiamiento y salida para calcular utilidad antes de ofertar.

- Aceptación: incluye inspección, título/abogado, adquisición/assignment, impuestos, seguros, HOA, servicios, permisos, administración, comercialización, comisiones y concesiones. Cada concepto tiene base, frecuencia, etapa y fecha.
- Aceptación: muestra costo y margen del proyecto antes de impuesto sobre la renta; no suma compra y principal pagado como dos gastos ni duplica costos heredados del estimador.
- Prioridad: P0. Dependencias: HU-06, HU-07; usa HU-10 y HU-11 cuando hay hard money. Evidencia: Análisis!C5:L19 y H12.

#### HU-09. Calcular oferta máxima y someter el negocio a estrés

Como inversionista, quiero conocer el precio máximo y la sensibilidad a retrasos o sobrecostos para decidir una oferta.

- Aceptación: muestra regla porcentual configurable como filtro y oferta máxima del modelo completo por utilidad/margen objetivo; recalcula deuda y costos ligados al precio. Informa si la meta es imposible o faltan datos.
- Aceptación: escenarios combinan ARV, obra, meses, tasa, renta, vacancia y valor de refinanciamiento; explican el impacto en utilidad, caja y salida. Las conclusiones se generan desde los resultados, no desde frases fijas.
- Prioridad: P0. Dependencias: HU-08, HU-12, HU-13, HU-15. Evidencia: H05 y H11.

### C. Hard money y liquidez

#### HU-10. Comparar términos de hard money

Como inversionista, quiero registrar cotizaciones de lenders para comparar el costo y el capital que necesito.

- Aceptación: guarda lender, vigencia, importe máximo/comprometido, anticipo sobre compra, LTC y LTV con sus bases, reserva de obra, puntos y su base, fees, vencimiento, extensiones, penalidades y garantías relevantes.
- Aceptación: diferencia estimación, cotización, aprobación y préstamo firmado. Compra financiada más reserva y cargos financiados debe conciliar con el compromiso; muestra límites excedidos sin convertir el máximo en un desembolso automático.
- Prioridad: P0. Dependencias: HU-07. Evidencia: H02.

#### HU-11. Proyectar intereses y deuda por fecha

Como inversionista, quiero calcular intereses según lo contratado para estimar el costo real de mantener el préstamo.

- Aceptación: configura interés sobre compromiso total o saldo utilizado; desembolso inicial y draws futuros, base de días contractual, pagos, intereses retenidos/capitalizados y mínimos cuando correspondan.
- Aceptación: principal inicial + desembolsos + capitalizaciones − amortizaciones = saldo final. Recalcula interés con retrasos y payoff por fecha; separa saldo estimado de cotización oficial del lender.
- Prioridad: P0. Dependencias: HU-10. Evidencia: H02, H07.

#### HU-12. Saber cuánto efectivo y cuándo aportar

Como inversionista, quiero un calendario de caja para saber cuánto necesito al cierre y durante la obra.

- Aceptación: muestra fuentes y usos, earnest money acreditado una sola vez, cierre, pagos de obra, reembolsos, tenencia, venta/refinanciamiento y principal; horizonte configurable superior a 12 meses.
- Aceptación: calcula brecha máxima antes de aportaciones y caja posterior a aportaciones; incorpora retrasos del lender y reservas restringidas. No trata una reserva de obra como efectivo disponible en banco.
- Prioridad: P0. Dependencias: HU-08, HU-11. Evidencia: H03 y H04.

### D. Plan B evaluado antes de comprar

#### HU-13. Analizar la propiedad como renta

Como inversionista, quiero calcular la operación de renta antes de adquirir para determinar si conservar el inmueble es una alternativa económica.

- Aceptación: renta por unidad, vacancia/incobrables, administración, mantenimiento, reserva CapEx, impuestos, seguro landlord, HOA y servicios; distingue ingreso bruto, ingreso efectivo, NOI, cobertura, P&I y flujo tras reservas.
- Aceptación: calcula renta de equilibrio y prueba renta/vacancia adversas; explica cada base. DSCR analítico se etiqueta con su definición y no se presenta como aprobación de un préstamo convencional.
- Prioridad: P0. Dependencias: HU-05, HU-07; cuota desde HU-15. Evidencia: Plan B!B17:L22, H08–H09.

#### HU-14. Evaluar factibilidad de refinanciamiento

Como inversionista, quiero registrar las condiciones del producto convencional y la evaluación del lender para saber si el Plan B es ejecutable a tiempo.

- Aceptación: tipo de operación, ocupación de inversión, titular/LLC, fecha de compra y pagaré, tasación, crédito, ingresos/deudas resumidos, reservas, documentación de renta y condiciones pendientes; no necesita almacenar números completos de seguridad social.
- Aceptación: reglas por lender/programa y fecha; resultados estimado, pendiente de revisión, condicionado, confirmado o no elegible con motivo. Compara fecha factible con vencimiento hard money y no convierte flujo positivo en aprobación crediticia.
- Prioridad: P0. Dependencias: HU-10, HU-11. Evidencia: H07–H09; fuentes F1–F3.

#### HU-15. Calcular nuevo préstamo y brecha al refinanciar

Como inversionista, quiero estimar la nueva hipoteca y el efectivo de la conversión para evitar depender de dinero que quizá no reciba.

- Aceptación: tasación, importe solicitado/aprobado, LTV, tasa, amortización, plazo contractual, puntos, costos, anticipos y escrow; usa payoff por fecha y distingue cash-in, cash-out y capital aún inmovilizado.
- Aceptación: genera amortización; tasa cero, costos financiados/pagados y menor tasación funcionan sin doble conteo. Restringe resultados de cash-out cuando no se cumplen condiciones y conserva la alternativa como escenario pendiente.
- Prioridad: P0. Dependencias: HU-11, HU-14. Evidencia: Plan B!B7:B16, L16:L17.

#### HU-16. Comparar venta y renta al mismo horizonte

Como inversionista, quiero comparar ambas salidas con los mismos criterios para decidir si comprar, vender o conservar.

- Aceptación: flujos fechados desde compra hasta un horizonte elegido; venta inmediata y renta con eventual venta incluyen costos de cierre, principal, aportaciones y distribución final. Apreciación, principal amortizado y caja se muestran por separado.
- Aceptación: utilidad, margen, capital requerido, capital remanente, cash-on-cash y XIRR cuando existe solución; plazo y denominadores visibles. Si no hay cambio de signo o no hay solución única válida, XIRR no se sustituye por cero.
- Prioridad: P0. Dependencias: HU-09, HU-12, HU-13, HU-15. Evidencia: H03 y H10.

### E. Oferta, diligencia y adquisición

#### HU-17. Aprobar internamente una oferta

Como inversionista, quiero documentar mi decisión y sus condiciones para saber por qué acepté o descarté una oportunidad.

- Aceptación: oferta inicial, contraofertas, términos, vencimiento y contingencias; vincula versión analítica, riesgo de Plan B y capital disponible. Guardar no envía ofertas al vendedor.
- Aceptación: criterios configurables y excepciones con motivo; una decisión interna no equivale a préstamo aprobado ni contrato firmado.
- Prioridad: P0. Dependencias: HU-02, HU-16.

#### HU-18. Gestionar diligencia antes del cierre

Como comprador, quiero controlar inspección, título, impuestos, permisos, HOA y condiciones del lender para resolver pendientes a tiempo.

- Aceptación: lista configurable por propiedad/condado, responsable, vencimiento, estado y evidencia. Hallazgos actualizan presupuesto y decisión mediante una revisión, sin borrar el análisis previo.
- Aceptación: muestra pendientes críticos al acercarse el vencimiento de diligencia; ningún punto se marca resuelto solo por transcurso del tiempo.
- Prioridad: P0. Dependencias: HU-04, HU-17.

#### HU-19. Registrar el cierre real de adquisición

Como administrador, quiero conciliar el cierre firmado para arrancar el proyecto con costos y deuda reales.

- Aceptación: precio, depósitos acreditados, créditos/prorrateos, fees, efectivo aportado y desembolso del lender coinciden con el settlement statement; cada importe se clasifica como costo, anticipo, depósito, deuda o capital.
- Aceptación: cierra la etapa solo con confirmación; registra la fecha real y préstamo vigente. Diferencias frente al análisis quedan visibles y alimentan el pronóstico.
- Prioridad: P0. Dependencias: HU-12, HU-18.

### F. Obra y control de gastos

#### HU-20. Aprobar y versionar el presupuesto de obra

Como responsable de obra, quiero congelar un presupuesto y administrar cambios para medir desviaciones.

- Aceptación: presupuesto base, revisiones aprobadas, contingencia disponible y alcance por partida; una orden de cambio tiene importe, motivo y fecha.
- Aceptación: el aumento aprobado modifica presupuesto vigente y pronóstico, pero no simula una factura pagada ni consume caja hasta registrarse el movimiento correspondiente.
- Prioridad: P0. Dependencias: HU-06, HU-07.

#### HU-21. Administrar proveedores y contratos

Como responsable de obra, quiero asociar contratistas, cotizaciones y compromisos al presupuesto para controlar lo contratado.

- Aceptación: proveedor, datos de contacto, alcance, contrato, hitos, precio, retención y documentos pertinentes. Varias cotizaciones pueden compararse y una aceptada genera compromiso.
- Aceptación: pagos parciales y cambios no duplican el monto comprometido; varias partidas pueden pertenecer al mismo contrato.
- Prioridad: P0. Dependencias: HU-04, HU-20.

#### HU-22. Registrar facturas y gastos detallados

Como administrador, quiero capturar cada factura o recibo para conocer qué se gastó y por qué.

- Aceptación: propiedad, proveedor, fecha, número, líneas, categoría, subtotal, impuesto, total, vencimiento y adjunto; permite materiales, mano de obra, permisos, fletes, administración y restantes costos de la inversión.
- Aceptación: advierte posibles duplicados; distribuye facturas entre partidas o propiedades con sumas conciliadas; notas de crédito/reversos mantienen historial. Emitida, aprobada y pagada son estados distintos.
- Prioridad: P0. Dependencias: HU-01, HU-04, HU-21.

#### HU-23. Registrar pagos y cuentas por pagar

Como administrador, quiero aplicar pagos a facturas para separar lo adeudado de lo pagado.

- Aceptación: pagos parciales, anticipos, retenciones, reembolsos y notas de crédito; fecha, cuenta y referencia. El saldo pendiente nunca se calcula sumando dos veces factura y pago como gasto.
- Aceptación: desembolsos y aportaciones se registran como financiamiento; se conserva evidencia del movimiento. Esta fase registra pagos realizados por el usuario, no transfiere dinero.
- Prioridad: P0. Dependencias: HU-22, HU-19.

#### HU-24. Administrar draws y reembolsos de obra

Como responsable del proyecto, quiero seguir las solicitudes al hard money lender para financiar la obra sin perder control de caja.

- Aceptación: solicitada, inspeccionada, aprobada, parcialmente desembolsada, recibida o rechazada; partidas, comprobantes, fees, retenciones y fechas; no supera reserva disponible.
- Aceptación: aprobación pendiente no aumenta caja. Desembolso recibido actualiza deuda y caja una sola vez, sin reducir artificialmente el costo de la factura. Recalcula intereses según contrato.
- Prioridad: P0. Dependencias: HU-11, HU-22, HU-23.

#### HU-25. Controlar cronograma y avance

Como responsable de obra, quiero planificar tareas e hitos para estimar cuándo podré vender o rentar.

- Aceptación: tareas, responsables, fechas previstas/reales, dependencias, avance y evidencia; incluye permisos e inspecciones finales aplicables.
- Aceptación: retraso actualiza la fecha estimada y el costo de tenencia/financiamiento del pronóstico; propone cambios sin alterar fechas contractuales.
- Prioridad: P0. Dependencias: HU-20, HU-21.

#### HU-26. Ver costo final previsto y desviaciones

Como inversionista, quiero comparar presupuesto, compromisos, gastos y pagos para anticipar sobrecostos.

- Aceptación: muestra presupuesto original/vigente, costo incurrido, pagado, obligaciones restantes y costo por terminar; una factura incluida en un compromiso reduce el pendiente de ese compromiso.
- Aceptación: costo final previsto = incurrido + costo restante previsto, sin sumar otra vez compromisos ya incluidos; calcula efecto sobre margen, reserva y aportaciones necesarias.
- Prioridad: P0. Dependencias: HU-20, HU-23, HU-24, HU-25.

### G. Venta y decisión de salida

#### HU-27. Administrar comercialización y ofertas de venta

Como inversionista, quiero registrar publicación, cambios de precio y ofertas para medir avance hacia la venta.

- Aceptación: precio listado, fecha, broker, comisiones pactadas, staging, ofertas, concesiones, contingencias y cierre estimado. Calcula neto de cada oferta y días en mercado.
- Aceptación: actualizar el precio de lista no reemplaza ARV original ni confirma una venta; una oferta caída reabre comercialización con historial.
- Prioridad: P0. Dependencias: HU-08, HU-25, HU-26.

#### HU-28. Revisar a tiempo si conviene activar Plan B

Como inversionista, quiero recibir avisos antes del vencimiento para decidir entre venta, ajuste de precio, extensión o refinanciamiento.

- Aceptación: umbrales configurables de días en mercado, margen, liquidez y tiempo al vencimiento; compara fecha factible de refinanciamiento y sus condiciones pendientes.
- Aceptación: decisión con responsable y motivo; no cambia contratos ni retira anuncios automáticamente. Si refinanciar no es viable, muestra déficit y las alternativas modeladas, sin inventar una extensión concedida.
- Prioridad: P0. Dependencias: HU-14, HU-15, HU-26, HU-27. Alertas dentro de la aplicación desde la primera entrega analítica.

#### HU-29. Liquidar la venta y medir el resultado

Como inversionista, quiero registrar el cierre de venta para conocer utilidad y efectivo recuperado reales.

- Aceptación: precio, créditos, comisión, cargos, payoff, retenciones y efectivo del cierre concilian con documento y caja; muestra costos posteriores pendientes.
- Aceptación: compara análisis aprobado, último pronóstico y resultado; separa utilidad antes de impuestos sobre la renta de devolución de capital y principal. Una corrección genera historial.
- Prioridad: P0. Dependencias: HU-19, HU-23, HU-27.

### H. Conversión y administración de renta

#### HU-30. Ejecutar y conciliar el refinanciamiento

Como inversionista, quiero registrar el préstamo aprobado y su cierre para sustituir el hard money con saldos correctos.

- Aceptación: seguimiento de solicitud, condiciones, tasación, aprobación, cierre y primer pago; compara condiciones finales con la proyección y concilia payoff/fees/escrow/cash-in o cash-out.
- Aceptación: hard money permanece activo hasta confirmarse su liquidación. Conserva ambos préstamos y documenta cualquier período de solapamiento.
- Prioridad: P0. Dependencias: HU-04, HU-14, HU-15, HU-23, HU-28.

#### HU-31. Preparar la propiedad para renta

Como propietario, quiero controlar la preparación para renta para iniciar operación con fecha y costos claros.

- Aceptación: seguro landlord, requisitos locales/HOA aplicables, habitabilidad, reparaciones, limpieza, contrato de administración y fecha disponible, con documentos y responsables.
- Aceptación: distingue vacante, disponible y ocupada; los meses sin inquilino continúan generando gastos. No reutiliza automáticamente la póliza de obra como seguro de renta.
- Prioridad: P0 para operación de renta. Dependencias: HU-13, HU-25, HU-28.

#### HU-32. Administrar contratos y cobros de renta

Como propietario, quiero registrar contratos, cargos y cobros para conocer ocupación, ingreso y adeudos.

- Aceptación: unidad, inquilino, contrato, vigencia, renta, vencimiento, pagos parciales, ajustes y depósito; estados de cuenta por contrato.
- Aceptación: depósito de garantía se separa del ingreso y de fondos libres; documenta devoluciones/aplicaciones con reglas configuradas y revisión local. No calcula elegibilidad de inquilinos ni ejecuta cobros automáticos.
- Prioridad: P0 para operación de renta. Dependencias: HU-23, HU-31.

#### HU-33. Controlar gastos y mantenimiento de renta

Como propietario, quiero registrar mantenimiento, servicios y gastos recurrentes para calcular flujo real.

- Aceptación: órdenes de trabajo, proveedor, costos, documentos y pagos reutilizan la gestión de gastos; distingue gasto operativo, mejora de capital y movimiento de reserva.
- Aceptación: alertas de vencimientos y renovaciones; imputación temporal para reportes sin duplicar impuestos/seguros pagados mediante escrow.
- Prioridad: P1. Dependencias: HU-22, HU-23, HU-31.

#### HU-34. Evaluar desempeño y venta futura de la renta

Como inversionista, quiero comparar renta prevista y real para decidir si seguir conservando la propiedad.

- Aceptación: ocupación, renta efectiva, mora, NOI, deuda, reserva CapEx y flujo por mes; amortización desde préstamo vigente y escenarios de venta futura.
- Aceptación: conserva toda la inversión desde la compra; el capital recuperado al refinanciar no se suma como utilidad y la plusvalía sin realizar se identifica aparte.
- Prioridad: P1. Dependencias: HU-16, HU-30, HU-32, HU-33.

### I. Cartera, trazabilidad e importación

#### HU-35. Ver liquidez y riesgo de la cartera

Como inversionista, quiero consolidar las propiedades para decidir cuántos proyectos puedo sostener al mismo tiempo.

- Aceptación: filtros por propiedad, etapa y titular; deuda, vencimientos, compromisos, reservas, caja libre y necesidades futuras; concentración por lender.
- Aceptación: transferencias internas se eliminan de los totales consolidados; no usa ganancias proyectadas de ventas no cerradas como caja actual ni suma porcentajes de ROI de distintas propiedades.
- Prioridad: P1. Dependencias: HU-12, HU-23, HU-26, HU-29, HU-34.

#### HU-36. Conciliar movimientos y exportar para contabilidad

Como administrador, quiero comparar registros con estados de cuenta y exportar detalles para revisar los números con mi contador.

- Aceptación: importación CSV con vista previa, mapeo, deduplicación y asociación a movimientos existentes; transferencias, pagos y devoluciones no crean facturas automáticamente.
- Aceptación: conciliación por cuenta/fecha y exportación de gastos, pagos, deuda y capital con IDs, categorías y comprobantes referenciados. La conciliación no presume aceptación fiscal.
- Prioridad: P1. Dependencias: HU-23, HU-29, HU-30.

#### HU-37. Importar esta calculadora como escenario

Como analista, quiero recuperar los inputs del Excel para comenzar con el caso estudiado y revisar sus diferencias.

- Aceptación: importador para esta plantilla y versión, con vista previa, celda de origen, dato/fórmula guardada y validación. No ejecuta macros, enlaces ni código del archivo; otras plantillas requieren mapeo.
- Aceptación: detecta H01/H02; permite elegir presupuesto activo y resolver deuda. Importar crea un borrador y repetir el archivo avisa duplicidad. Tasas y renta permanecen etiquetadas como supuestos del archivo.
- Prioridad: P1; captura manual del caso en P0. Dependencias: HU-03, HU-07, HU-10, HU-13, HU-15.

#### HU-38. Rastrear cambios, cálculos y decisiones

Como propietario, quiero saber quién cambió un importe o supuesto para auditar resultados.

- Aceptación: historial de cambios con usuario, fecha, valor previo/nuevo y motivo cuando afecta una aprobación; versiones de cálculo y enlaces a fuente.
- Aceptación: cálculos guardados se validan en servidor; edición simultánea no pierde cambios; datos de otra propiedad/usuario no son accesibles mediante IDs o documentos. Secretos excluidos de logs y exportaciones.
- Prioridad: P0 como fundamento transversal. Dependencias: HU-01.

#### HU-39. Compartir funciones con el equipo

Como propietario de la aplicación, quiero asignar acceso a analistas, responsables de obra y administración para colaborar con límites claros.

- Aceptación: invitación explícita, roles y propiedades asignadas; analista no registra pagos, contratista solo ve lo autorizado, administrador de obra no ve datos crediticios privados por defecto.
- Aceptación: auditoría y revocación efectiva; compartir cambia el acceso únicamente cuando el propietario lo solicita. La primera entrega sigue siendo privada para el usuario actual.
- Prioridad: P2. Dependencias: HU-38; verificar capacidades de identidad y acceso de la plataforma antes de implementar.

#### HU-40. Generar reportes de decisión y cierre

Como inversionista, quiero descargar un expediente resumido para revisar con mi equipo, lender o contador.

- Aceptación: reporte con versión/fecha, supuestos, comparables seleccionados, presupuesto, términos, caja, estrés y ambas salidas; reportes de cierre con resultados reales y diferencias.
- Aceptación: el usuario elige qué incluir; nunca contiene API keys ni documentos crediticios por defecto. Descargar no lo envía a terceros. Exportación legible y cifras idénticas al motor.
- Prioridad: P1. Dependencias: HU-16, HU-29, HU-34, HU-38.

### L. Gastos detallados y control presupuestario · ampliación del 7 de octubre de 2026

Se agregan doce historias: HU-41/HU-42/HU-43/HU-44/HU-46/HU-47/HU-48/HU-51/HU-52 cuentan con implementación local y están en verificación; HU-45/HU-49/HU-50 permanecen pendientes. Véase [entrega del 9 de octubre](HU-47-HU-48-HU-51-HU-52.md). Véase [entrega del bloque B](HU-43-HU-44-HU-46.md) para los criterios aún abiertos. HU-41 a HU-46 cubren los campos y funciones solicitados; HU-47 a HU-52 incorporan mejoras de control identificadas en la investigación. Amplían HU-20 a HU-26 y reutilizan documentos, pagos, conciliación y auditoría existentes.

Criterios de aceptación, casos de prueba, reglas de cálculo y fuentes oficiales: [Facturas y control de gastos · HU-41 a HU-52](HU-41-HU-52_Control_de_gastos.md). Este documento forma parte del alcance; el estado actualizado de cada historia está en Seguimiento; [HU-41/HU-42](HU-41-HU-42.md) registra la implementación local y la publicación pendiente.

| ID | Historia | Prioridad | Dependencias |
| --- | --- | --- | --- |
| HU-41 | Administrar categorías y productos de gastos | P0 | HU-21, HU-22, HU-38 |
| HU-42 | Distribuir presupuesto y gastos por centro de costo | P0 | HU-20, HU-22, HU-41 |
| HU-43 | Capturar facturas detalladas y términos de pago | P0 | HU-21, HU-22, HU-23, HU-41, HU-42 |
| HU-44 | Adjuntar y gestionar PDF o fotos desde la factura | P0 | HU-04, HU-43 |
| HU-45 | Crear un borrador de factura mediante imagen e IA | P1 | HU-41 a HU-44 |
| HU-46 | Comparar presupuesto inicial, vigente y gastos reales | P0 | HU-20, HU-23, HU-26, HU-41 a HU-43 |
| HU-47 | Vincular orden de compra, recepción y factura | P1 | HU-21, HU-42, HU-43 |
| HU-48 | Revisar y aprobar gastos con permisos por función | P1 | HU-38, HU-39, HU-43, HU-44 |
| HU-49 | Gestionar vencimientos, descuentos y pagos planificados | P1 | HU-12, HU-23, HU-43 |
| HU-50 | Controlar devoluciones y créditos de materiales | P1 | HU-23, HU-43, HU-47 |
| HU-51 | Detectar sobrecostos y actualizar la previsión de cierre | P1 | HU-25, HU-26, HU-46, HU-47 |
| HU-52 | Capturar gastos recurrentes y reembolsos de obra | P2 | HU-23, HU-43, HU-44, HU-48 |

## 6. Orden de desarrollo y condiciones de entrega

| Entrega | Historias | Resultado que permite usar el sistema | Condición de aceptación |
| --- | --- | --- | --- |
| 0. Fundamentos | HU-01, HU-02, HU-38 | Preservar cartera y separar expediente, escenarios y movimientos | Migración reversible y totales existentes conciliados; aislamiento por usuario |
| 1. Decidir antes de comprar | HU-03, HU-05 a HU-16 y avisos analíticos básicos de HU-28 | Analizar el mismo inmueble con hard money, venta y refinanciamiento/renta | Caso Humphries reproducido y discrepancias explícitas; préstamo, caja y dos salidas coherentes; Plan B pendiente no aparece aprobado |
| 2. Comprar y administrar obra | HU-04, HU-17 a HU-26 | Cierre real, facturas, pagos, cronograma, cambios y draws | Escenario de factura/pago/reembolso concilia costo, caja y deuda sin duplicados |
| 3. Comercializar y salir | HU-27 a HU-30 | Venta, alertas de vencimiento y refinanciamiento ejecutado | Cierre de venta o refinance concilia con documentos y cancela solo la deuda efectivamente pagada |
| 4. Operar la renta | HU-31 a HU-34 | Contratos, cobros, depósitos, mantenimiento y desempeño | Un mes con vacancia, pago parcial y mantenimiento refleja saldos y flujo correctos |
| 5. Consolidar y exportar | HU-35 a HU-37, HU-40 | Cartera, conciliación bancaria manual/importada, Excel de referencia y reportes | Consolidación elimina transferencias internas; importación repetida no duplica registros |
| Cierre del alcance original | HU-39 | Colaboración mediante funciones y propuestas | Permisos y alcances definidos antes de habilitarlos |

El primer producto utilizable para evaluar compras se alcanza con entregas 0–1. Para administrar dinero y obra reales se necesita también la entrega 2. El alcance original de compra, remodelación, venta y renta contempla hasta la entrega 5 y su cierre. La ampliación de gastos añade los bloques siguientes; su estado se registra por separado.

Ampliación de octubre de 2026; estado vigente por historia en Seguimiento. Pendientes HU-45/HU-49/HU-50; las otras nueve historias están en verificación local:

| Bloque | Historias | Resultado y condición de entrega |
| --- | --- | --- |
| A. Clasificación | HU-41, HU-42 | Catálogos y centros editables; preservar presupuesto y datos históricos |
| B. Captura y comparación | HU-43, HU-44, HU-46 | Facturas completas, PDF/fotos y presupuesto frente a costo real; migración conciliada y sin doble conteo |
| C. Automatización asistida | HU-45, HU-48 | IA produce borradores revisables; permisos y aprobación en servidor |
| D. Control preventivo | HU-47, HU-49, HU-50, HU-51 | Órdenes, recepción, vencimientos, devoluciones y previsión coherentes |
| E. Gastos repetidos | HU-52 | Recurrentes y reembolsos con evidencia y sin duplicidad |

El comparativo HU-46 se entrega antes de la IA. Antes de la captura masiva, se normalizan y paginan facturas, líneas y asignaciones, conservando IDs y saldos; los archivos permanecen en R2. El detalle de migración, límites actuales y validación está en la ampliación vinculada arriba.

Secuencia dentro de la entrega 1: ficha/comparables y presupuesto → escenarios y términos → deuda → refinanciamiento y renta → costos completos/caja → estrés → comparación de salidas. Las dependencias de HU-13 con la cuota de HU-15 se resuelven en ese orden; HU-15 no depende del flujo de renta calculado.

No se fija una fecha de finalización sin estimar capacidad del equipo, integraciones y validación con lenders. Conviene dividir las historias mayores en tareas de interfaz, modelo, API y pruebas y estimarlas con el equipo. Cada entrega debe ser demostrable con un expediente de prueba antes de seguir a la siguiente.

## 7. Integración técnica con lo desarrollado

Se propone mantener React/TypeScript, Vinext, Cloudflare Workers y D1. Las ampliaciones no requieren reemplazar la interfaz o el catálogo existente. La arquitectura objetivo es una propuesta de implementación, no una afirmación de que ya se encuentre desplegada.

| Área | Evolución propuesta |
| --- | --- |
| Navegación | Cartera y oportunidades; expediente con Análisis, Financiamiento, Presupuesto, Obra, Gastos, Caja, Venta, Plan B, Renta y Documentos según etapa |
| Propiedad | Separar inmueble físico, titular y proyecto de inversión; tipos de campo explícitos en lugar de depender permanentemente de números de fila del Excel |
| Escenarios | Inputs y snapshots versionados; funciones TypeScript puras compartidas y validación del servidor como autoridad al guardar |
| Datos operativos | Tablas relacionales de préstamos, draws, contratos, facturas, líneas, pagos/asignaciones, movimientos, tareas, cierres, unidades y arrendamientos |
| Datos analíticos | Comparables y sus fuentes; escenarios JSON versionados son apropiados para supuestos, sin convertir el libro de pagos en un documento gigante |
| Archivos | Habilitar R2 o almacenamiento privado compatible cuando comience HU-04; metadatos en D1 y descargas autorizadas por servidor |
| Historial | Registro append-only para hechos financieros; correcciones por reverso/ajuste y snapshots para decisiones |
| Cálculos monetarios | Centavos enteros en movimientos y precisión decimal controlada para tasas; fechas efectivas, zona horaria explícita y regla de redondeo documentada |
| Integridad | Claves foráneas, índices por propietario/proyecto/fecha, transacciones o lotes atómicos, idempotencia en importaciones y registros, control de concurrencia |
| ATTOM | Reusar consulta actual; validar cobertura y contrato antes de añadir productos de comparables, rentas o valoraciones; qPublic sigue como referencia manual |
| Alertas | Mostrar pendientes y vencimientos al abrir el expediente; avisos en segundo plano requieren un programador compatible confirmado. Canales externos se agregan solo con alcance y destinatarios definidos |

Entidades propuestas: Property, InvestmentProject, AnalysisScenario, Comparable, BudgetVersion, BudgetLine, Loan, LoanDraw, LoanPayment, Vendor, Contract, ChangeOrder, Invoice, InvoiceLine, Payment, PaymentAllocation, CashTransaction, Task, Document, PurchaseClosing, SaleClosing, RefinanceClosing, RentalUnit, Lease, RentCharge, RentReceipt, SecurityDepositMovement y AuditEvent. El modelo puede consolidar algunas tablas tras diseño detallado; cada hecho debe tener un único registro y relaciones claras.

Los acumulados `actual` actuales se migran como saldos iniciales identificados. Al reconstruirlos con comprobantes se aplica un ajuste de conciliación para evitar duplicarlos. Cada gasto tendrá una clasificación por etapa y una procedencia que impida que los conceptos manuales actuales vuelvan a sumarse al activar el motor de préstamo.

## 8. Diccionario de cálculos y criterios de prueba

### Definiciones propuestas

- Límite de financiamiento: máximo permitido según términos. No implica efectivo disponible ni deuda desembolsada.
- Saldo de deuda: principal utilizado y capitalizaciones contractuales pendientes de amortización.
- Payoff: importe necesario para cancelar deuda en una fecha, incluidos intereses devengados y cargos aplicables. Se identifica si es estimación o documento oficial.
- Utilidad del flip antes de impuestos sobre la renta: venta menos adquisición, obra, tenencia, costos financieros y costos de salida. El repago de principal no se vuelve a deducir como gasto.
- Efectivo al cierre: aportación necesaria en la fecha de adquisición tras créditos y fuentes confirmadas. Depósitos previos se acreditan una vez.
- Capital máximo requerido: máxima necesidad acumulada de aportaciones según el calendario de caja y las reservas requeridas; separado del efectivo invertido hasta hoy.
- NOI: renta efectiva menos gastos operativos. Excluye deuda, impuesto sobre la renta, depreciación y mejoras/reserva de capital. Se muestra aparte el flujo después de reserva CapEx.
- DSCR analítico: NOI dividido entre servicio de deuda del período con su base visible. Si se muestra una definición del lender, se identifica separadamente.
- Flujo de renta: NOI menos servicio de deuda y provisión de CapEx para el escenario; en caja real se reconocen movimientos efectivos sin duplicar reserva y gasto de reposición.
- Cap rate: NOI anual / valor elegido, con denominador etiquetado. No confundir con rendimiento sobre costo total.
- Cash-on-cash: flujo anual distribuible / capital efectivo mantenido en la inversión según definición guardada. Con denominador cero/negativo no muestra un porcentaje engañoso.
- XIRR: retorno anualizado sobre aportaciones y recuperaciones fechadas, si el conjunto de flujos admite una solución interpretable.
- Efectivo del refinanciamiento: nuevo desembolso menos payoff, costos, anticipos y reservas retenidas. Un valor positivo depende de las restricciones del producto; no constituye utilidad operativa.

### Casos de aceptación financiera

| Caso | Resultado esperado |
| --- | --- |
| Reproducción histórica del Excel | Con los supuestos y convenciones originales: obra $70,070; directos $173,625; financieros $11,119; venta $11,600; utilidad $43,656. Sirve para trazabilidad, no para aprobar la operación. |
| Presupuesto por sqft | 1,274 × $35 = $44,590 y 1,274 × $55 = $70,070. Solo uno alimenta el escenario activo. |
| Conciliación de financiamiento | $85,500 + $70,070 = $155,570; diferencia de $12,430 frente a $168,000 se muestra sin asignación automática. |
| Base de intereses histórica | $168,000 × 9.75% × 6/12 = $8,190 solo en el modo contratado que usa ese principal por todo el período. |
| Factura y pago | Factura $10,000, pago $4,000: costo incurrido $10,000, pagado $4,000 y saldo pendiente $6,000; gasto no es $14,000. |
| Draw reembolsado | Recibir $4,000 del lender aumenta caja y deuda por el mismo importe; no convierte la factura anterior en gasto cero ni crea una ganancia. |
| Pago de principal | Cancelar $100,000 de principal reduce caja y deuda $100,000; el costo de compra ya reconocido no se duplica. |
| Plan B histórico | $180,000, 7.5%, 30 años: P&I $1,258.59. Con supuestos del Excel y su convención conjunta mantenimiento/CapEx, flujo $1,008.75; cash-out aritmético $6,600, elegibilidad pendiente. |
| Separación de NOI | Con mantenimiento y CapEx desglosados, la reserva CapEx cambia flujo disponible pero no el NOI operativo. No forzar un NOI nuevo a coincidir con la definición combinada anterior. |
| Retraso y vencimiento | Mover el cierre tres meses recalcula intereses y tenencia; alerta de vencimiento y extensión pendiente. No detiene gastos al llegar al mes previsto de venta. |
| Refinanciamiento no factible | Si fecha elegible supera vencimiento, Plan B queda condicionado/no disponible en esa fecha; muestra necesidad de extensión o caja sin dar la operación por financiada. |
| Tasación menor | Reducir valor reduce capacidad según LTV y puede transformar cash-out en cash-in; muestra aportación adicional. |
| Depósito de renta | Recibir depósito aumenta caja y obligación de devolución; no aumenta renta ni NOI. |
| Costo final previsto | Contrato $20,000, incurrido $8,000 y restante $12,000: pronóstico $20,000, no $28,000. |
| Integridad | Migrar/importar/reintentar dos veces no duplica propiedades o pagos; datos/documentos de un usuario no son accesibles por otro. |

Tolerancia: centavos para conciliaciones monetarias, precisión explícita para tasas y valores intermedios; identificadores, conteos y estados exactos. Pruebas adicionales cubren tasa cero, datos faltantes, períodos largos, saldos negativos permitidos por su naturaleza y edición concurrente.

## 9. Información que se necesita para implementar con términos reales

Estas decisiones no impiden preparar el sistema; quedan como inputs o configuración pendiente de cada operación.

1. Term sheet de los hard money lenders: porcentaje de compra, financiación de obra, bases de interés y puntos, draws, anticipos, fees, reserva de interés, vencimiento y extensiones.
2. Titular de compra y prestatario esperado en el refinanciamiento; confirmar si se usará una LLC y qué productos aceptará el lender.
3. Objetivos de inversión: utilidad/margen mínimo, máximo capital expuesto, reserva, meses de comercialización y condiciones que disparan una revisión de salida.
4. Cotización convencional para propiedad de inversión: clasificación, plazos, documentación, LTV, reservas y fecha factible confirmados por el lender.
5. Renta respaldada por comparables, costos locales, tax bill, pólizas y requisitos del inmueble. Los $3,500 del archivo no se consideran renta de mercado verificada.
6. Número de usuarios, roles y volumen esperado de propiedades para estimar las fases de colaboración y cartera.

## 10. Alcance posterior opcional

Integraciones bancarias en vivo, sincronización contable, pagos electrónicos, envío automático a lenders/brokers, firma electrónica, portal de contratistas/inquilinos, productos DSCR como alternativa distinta del convencional y análisis tributario detallado requieren historias específicas posteriores. El sistema inicial registrará documentos y movimientos, y exportará información; no presentará declaraciones fiscales, originará préstamos ni ejecutará transferencias.

## 11. Fuentes y trazabilidad

- Excel del usuario: siete hojas y rangos descritos en la sección 2. Resultados guardados contrastados con fórmulas y recálculos independientes de los casos principales.
- Aplicación actual: `lib/model.ts`, `lib/attom.ts`, `app/workspace.tsx`, `db/schema.ts` y rutas de propiedades, settings y ATTOM revisadas el 7 de septiembre de 2026.
- F1: Fannie Mae, Cash-Out Refinance Transactions, B2-1.3-03. https://selling-guide.fanniemae.com/sel/b2-1.3-03/cash-out-refinance-transactions
- F2: Fannie Mae, Limited Cash-Out Refinance Transactions, B2-1.3-02. https://selling-guide.fanniemae.com/sel/b2-1.3-02/limited-cash-out-refinance-transactions
- F3: Fannie Mae, General Rental Income Information, B3-3.8-01. https://selling-guide.fanniemae.com/sel/b3-3.8-01/rental-income

Fuentes externas consultadas el 7 de septiembre de 2026. La propuesta toma esas guías como ejemplos de requisitos que deben parametrizarse y verificarse por programa; no como autorización o garantía de refinanciamiento para el inmueble del archivo.
