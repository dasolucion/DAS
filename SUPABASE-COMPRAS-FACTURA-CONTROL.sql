-- Compras: número de factura y número de control (ejecutado el 20/11/2026)
ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS numero_factura text,
  ADD COLUMN IF NOT EXISTS numero_control text;

-- Ejemplo de las dos compras cargadas el 20/11/2026:
-- UPDATE public.compras SET descripcion = 'IA SAINTNET 2050, C.A.',
--   numero_factura = '000277', numero_control = '00-000298' WHERE id = 33;
-- UPDATE public.compras SET descripcion = 'CENTRO FERRETERO EL PICO, C.A.',
--   numero_factura = '00065665', numero_control = NULL WHERE id = 34;
