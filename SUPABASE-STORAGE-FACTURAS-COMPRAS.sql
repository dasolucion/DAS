-- Storage para copias de facturas de compras (ejecutado el 21/11/2026)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('facturas-compras', 'facturas-compras', true, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public,
  allowed_mime_types = EXCLUDED.allowed_mime_types, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "facturas_compras_select" ON storage.objects;
CREATE POLICY "facturas_compras_select" ON storage.objects FOR SELECT
  TO anon, authenticated, service_role USING (bucket_id = 'facturas-compras');
DROP POLICY IF EXISTS "facturas_compras_insert" ON storage.objects;
CREATE POLICY "facturas_compras_insert" ON storage.objects FOR INSERT
  TO anon, authenticated, service_role WITH CHECK (bucket_id = 'facturas-compras');
DROP POLICY IF EXISTS "facturas_compras_update" ON storage.objects;
CREATE POLICY "facturas_compras_update" ON storage.objects FOR UPDATE
  TO anon, authenticated, service_role USING (bucket_id = 'facturas-compras')
  WITH CHECK (bucket_id = 'facturas-compras');
DROP POLICY IF EXISTS "facturas_compras_delete" ON storage.objects;
CREATE POLICY "facturas_compras_delete" ON storage.objects FOR DELETE
  TO anon, authenticated, service_role USING (bucket_id = 'facturas-compras');

ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS imagen_url text;
