# Libros Fiscales IVA (DAS)

Generación **bajo demanda** del Libro de Ventas IVA y del Libro de Compras IVA, por período mensual.

## Uso

1. En el menú lateral, abrir **Libros Fiscales**.
2. Elegir el libro (`Libro de Ventas IVA` o `Libro de Compras IVA`).
3. Seleccionar el **período mensual** (por defecto, el mes actual).
4. Pulsar **Vista previa** para revisar las filas y el resumen, o **Generar PDF** para descargar el archivo (`Libro_Ventas_IVA_AAAA-MM.pdf` / `Libro_Compras_IVA_AAAA-MM.pdf`).

No se genera ningún libro automáticamente ni se almacena en la base de datos: siempre se arma con los datos vigentes al momento de la generación.

## Libro de Ventas

Incluye, para el mes seleccionado:

- **FAC**: todas las ventas registradas en el período.
- **N/C**: las notas de crédito emitidas en el período, con montos negativos y la factura afectada en la columna `Nro Fac Afectada`.
- **RET**: cada retención de IVA registrada, como fila propia (`03-REG`), con fecha igual a la del comprobante, base imponible de la factura, porcentaje, monto y número de comprobante.

Cálculo de la base imponible de cada factura: `total + descuento - IVA - exento`, prorrateando el descuento entre la porción gravada y la exenta (mismo criterio que el Resumen de IVA).

Resumen al pie: ventas exentas, gravadas al 16 %, desglose entre contribuyentes / no contribuyentes (`clientes.contribuyente_especial`), notas de crédito, total de ventas y débitos fiscales, retenciones aplicadas y débito fiscal neto.

## Libro de Compras

Incluye todas las compras del mes con su RIF (cuando el proveedor lo tiene registrado), número de factura y número de control.

- Las facturas marcadas como **personales** se contabilizan en `Exentas / sin crédito fiscal`.
- La retención de IVA se muestra en las columnas `Base Ret. IVA`, `% Ret`, `Monto Retenido`, `Nro Comp. Ret` y `Fecha Ret`.
- No existen notas de crédito de compras en el sistema, por lo que no hay filas de crédito en este libro.

Resumen al pie: compras sin derecho a crédito fiscal, compras gravadas al 16 %, total de compras y créditos fiscales, retenciones practicadas y crédito fiscal neto.

## Retención de IVA en compras

Se agregaron las columnas `retencion_iva_check`, `retencion_iva_porc`, `retencion_iva_monto`, `retencion_iva_comprobante` y `retencion_iva_fecha` a la tabla `compras` (ver `SUPABASE-COMPRAS-RETENCION-IVA.sql`).

- Al registrar una compra se puede marcar **Registrar Retención de IVA**, con porcentaje (75 % por defecto), monto calculado sobre el IVA, número de comprobante y fecha.
- En el historial de compras, el botón de recibo (🧾) permite registrar o quitar la retención de una compra ya guardada.

## Formato del PDF

- Horizontal, tamaño legal, una página por cada bloque de filas (el resumen se imprime a continuación de la última página de detalle).
- Encabezado: título del libro, rango de fechas, razón social / dirección / RIF de DAS y fecha de emisión.
- Pie: `Página X de Y`.
- Librerías: `jsPDF 2.5.1` + `jspdf-autotable 3.8.2` (CDN).
