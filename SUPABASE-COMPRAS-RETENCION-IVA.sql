-- ============================================================
-- RETENCIÓN DE IVA EN COMPRAS
-- Permite registrar el comprobante de retención de IVA que DAS
-- practica a sus proveedores, para reflejarlo en el Libro de
-- Compras IVA.
-- ============================================================

alter table public.compras
    add column if not exists retencion_iva_check boolean default false,
    add column if not exists retencion_iva_porc numeric default 75,
    add column if not exists retencion_iva_monto numeric default 0,
    add column if not exists retencion_iva_comprobante text,
    add column if not exists retencion_iva_fecha date;

comment on column public.compras.retencion_iva_check is 'Indica si la compra tiene retención de IVA registrada';
comment on column public.compras.retencion_iva_porc is 'Porcentaje de IVA retenido al proveedor (normalmente 75%)';
comment on column public.compras.retencion_iva_monto is 'Monto de IVA retenido en bolívares';
comment on column public.compras.retencion_iva_comprobante is 'Número del comprobante de retención de IVA';
comment on column public.compras.retencion_iva_fecha is 'Fecha del comprobante de retención (mes fiscal)';
