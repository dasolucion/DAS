# Bancos y Cuentas por Pagar

## Bancos (menú: Otros → Bancos)

Los bancos se configuran en **Parámetros → Bancos**, con nombre, **fecha de conciliación** y saldo inicial en Bs.

- La fecha de conciliación marca el inicio de los movimientos que afectan el saldo. Lo anterior se oculta.
- Saldo por banco = saldo inicial + ingresos − egresos desde esa fecha.
- Movimientos con filtros por **fecha**, **banco**, **vendedor** y **selector de contraparte** (cliente/proveedor), con totales de ingresos, egresos y neto del filtro.
- **Salidas de dinero**: fecha, monto, detalle y beneficiario (selector de proveedores u “Otro”).

Los ingresos se generan al cobrar ventas/notas de entrega; los egresos, al pagar compras o registrar salidas manuales.

## Cuentas por Cobrar
Al pulsar **Marcar pagado** se pregunta:
- **Monto**: se precarga con el saldo pendiente y se puede editar para abonos parciales.
- **Fecha** del pago.
- **Banco** donde se recibió.

Si el monto cubre el saldo, se cierra la cuenta y el compromiso de cobro. Si es parcial, queda abierta con el resto.

La opción **“Pagado/cobrado en cuenta personal”** oculta el movimiento, no afecta saldos y no genera asiento.

## Cuentas por Pagar (menú: Compras → Cuentas por Pagar)
Lista las compras nuevas con saldo pendiente (`total − pagos registrados`). Las compras existentes se consideran pagadas y no aparecen.

El botón **Marcar pagado** pregunta monto, fecha y banco, y genera un egreso bancario con detalle `Pago a <proveedor> — Factura <Nº>`.

## Compras
Se eliminaron las opciones de **factura personal** y de **retenciones IVA en compras** (no aplican a DAS ni a sus prospectos). El Libro de Compras conserva las columnas de retención en cero por exigencia normativa del SENIAT.

## Contabilidad (menú: Reportes → Contabilidad)
- **Plan de cuentas** basic con cuentas de título (1 Activo, 2 Pasivo, 3 Capital, 4 Ingresos, 5 Costos y Gastos) y cuentas de detalle.
- Los asientos se generan **desde ahora** al pagar/cobrar, transferir o registrar salidas.
- Cobro de venta: débito Banco / crédito Ventas de mercancía, Ventas de servicios, Ventas exentas e IVA por pagar, según el detalle de la factura.
- Pago de compra: débito Compras/Compras exentas + IVA por recuperar / crédito Banco.
- Transferencia entre bancos: débito Banco destino / crédito Banco origen; se excluye de los totales de ingresos/egresos.
- Salidas manuales: se elige la cuenta contable del gasto.
- Reportes: **Libro Mayor**, **Balance de comprobación**, **Estado de resultados** y **Balance general**.

## SQL
- `SUPABASE-BANCOS-PAGOS.sql`: tablas `bancos`, `banco_movimientos`, columna `cxp` en compras y políticas RLS.
- `SUPABASE-CONTABILIDAD.sql`: plan de cuentas, asientos y transferencias.
