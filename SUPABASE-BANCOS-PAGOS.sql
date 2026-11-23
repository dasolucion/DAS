-- ============================================================
-- BANCOS, MOVIMIENTOS Y CUENTAS POR PAGAR
-- ============================================================

-- Las compras ya registradas se consideran pagadas; las nuevas nacen pendientes.
alter table public.compras
    add column if not exists cxp boolean not null default false;

create table if not exists public.bancos (
    id bigserial primary key,
    nombre text not null,
    fecha_conciliacion date not null default current_date,
    saldo_inicial numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.banco_movimientos (
    id bigserial primary key,
    banco_id bigint not null references public.bancos(id) on delete restrict,
    fecha date not null default current_date,
    tipo text not null check (tipo in ('ingreso', 'egreso')),
    monto numeric not null,
    detalle text not null default '',
    contraparte text not null default '',
    vendedor_id uuid,
    venta_id uuid,
    nota_entrega_id uuid,
    compra_id bigint,
    created_at timestamptz not null default now()
);

create index if not exists banco_movimientos_banco_fecha_idx on public.banco_movimientos (banco_id, fecha);
create index if not exists banco_movimientos_venta_idx on public.banco_movimientos (venta_id);
create index if not exists banco_movimientos_compra_idx on public.banco_movimientos (compra_id);

alter table public.bancos enable row level security;
alter table public.banco_movimientos enable row level security;

drop policy if exists das_politica_bancos on public.bancos;
create policy das_politica_bancos on public.bancos
    for all to anon, authenticated using (true) with check (true);

drop policy if exists das_politica_banco_movimientos on public.banco_movimientos;
create policy das_politica_banco_movimientos on public.banco_movimientos
    for all to anon, authenticated using (true) with check (true);

-- Bancos iniciales (el usuario ajusta fecha de conciliación y saldo en Parámetros).
insert into public.bancos (nombre, fecha_conciliacion, saldo_inicial)
select v.nombre, current_date, 0
from (values ('Banesco'), ('Banco de Venezuela')) as v(nombre)
where not exists (select 1 from public.bancos b where b.nombre = v.nombre);
