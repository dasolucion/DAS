-- ============================================================
-- CONFIGURACIÓN DEL SISTEMA (The Factory + Asistente IA)
-- Una sola fila (id=1). Las credenciales se administran desde
-- Parámetros, sin estar escritas en el código fuente.
-- ============================================================

create table if not exists public.configuracion_sistema (
    id integer primary key default 1 check (id = 1),
    -- Facturación digital The Factory HKA
    tfhka_activo boolean not null default true,
    tfhka_url text not null default 'https://demoemisionv2.thefactoryhka.com.ve',
    tfhka_usuario text,
    tfhka_clave text,
    tfhka_serie text default '',
    -- Asistente IA (Gemini, plan gratuito)
    ia_activo boolean not null default false,
    ia_api_key text,
    ia_modelo text not null default 'gemini-2.5-flash-lite',
    ia_exigir_aprobacion boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.configuracion_sistema (id)
values (1)
on conflict (id) do nothing;

alter table public.configuracion_sistema enable row level security;

drop policy if exists das_politica_configuracion_sistema on public.configuracion_sistema;
create policy das_politica_configuracion_sistema
    on public.configuracion_sistema
    for all to anon, authenticated
    using (true) with check (true);

comment on column public.configuracion_sistema.tfhka_url is 'URL base de la API de The Factory (demo o producción)';
comment on column public.configuracion_sistema.tfhka_usuario is 'Usuario de la API de The Factory';
comment on column public.configuracion_sistema.tfhka_clave is 'Clave de la API de The Factory';
comment on column public.configuracion_sistema.tfhka_serie is 'Serie fiscal usada en emisión y comprobantes';
comment on column public.configuracion_sistema.ia_exigir_aprobacion is 'Si es true, la IA muestra un borrador y espera aprobación antes de guardar o emitir';
