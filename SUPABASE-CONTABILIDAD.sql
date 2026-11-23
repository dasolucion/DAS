-- ============================================================
-- PLAN DE CUENTAS, ASIENTOS Y TRANSFERENCIAS BANCARIAS
-- ============================================================

create table if not exists public.plan_cuentas (
    codigo text primary key,
    nombre text not null,
    tipo text not null check (tipo in ('titulo','activo','pasivo','capital','ingreso','costo','gasto','contra_ingreso')),
    naturaleza text check (naturaleza in ('deudor','acreedor')),
    activo boolean not null default true,
    orden integer not null default 0
);

create table if not exists public.asientos (
    id bigserial primary key,
    fecha date not null,
    descripcion text not null,
    origen_tipo text,
    origen_id text,
    created_at timestamptz not null default now()
);

create table if not exists public.asiento_detalles (
    id bigserial primary key,
    asiento_id bigint not null references public.asientos(id) on delete cascade,
    cuenta_codigo text not null references public.plan_cuentas(codigo),
    debe numeric not null default 0,
    haber numeric not null default 0,
    orden integer not null default 0
);

create table if not exists public.banco_transferencias (
    id bigserial primary key,
    fecha date not null,
    banco_origen_id bigint not null references public.bancos(id) on delete restrict,
    banco_destino_id bigint not null references public.bancos(id) on delete restrict,
    monto numeric not null,
    concepto text not null default '',
    created_at timestamptz not null default now()
);

alter table public.banco_movimientos
    add column if not exists es_personal boolean not null default false,
    add column if not exists transferencia_id bigint,
    add column if not exists cuenta_codigo text,
    add column if not exists asiento_id bigint;

alter table public.banco_movimientos alter column banco_id drop not null;

create index if not exists asiento_detalles_asiento_idx on public.asiento_detalles(asiento_id);
create index if not exists asiento_detalles_cuenta_idx on public.asiento_detalles(cuenta_codigo);
create index if not exists asientos_fecha_idx on public.asientos(fecha);

alter table public.plan_cuentas enable row level security;
alter table public.asientos enable row level security;
alter table public.asiento_detalles enable row level security;
alter table public.banco_transferencias enable row level security;

drop policy if exists das_politica_plan_cuentas on public.plan_cuentas;
create policy das_politica_plan_cuentas on public.plan_cuentas for all to anon, authenticated using (true) with check (true);

drop policy if exists das_politica_asientos on public.asientos;
create policy das_politica_asientos on public.asientos for all to anon, authenticated using (true) with check (true);

drop policy if exists das_politica_asiento_detalles on public.asiento_detalles;
create policy das_politica_asiento_detalles on public.asiento_detalles for all to anon, authenticated using (true) with check (true);

drop policy if exists das_politica_banco_transferencias on public.banco_transferencias;
create policy das_politica_banco_transferencias on public.banco_transferencias for all to anon, authenticated using (true) with check (true);

-- Cuentas de título y detalle
insert into public.plan_cuentas (codigo, nombre, tipo, naturaleza, orden) values
 ('1','ACTIVO','titulo','deudor',10),
 ('1.1','Activo Corriente','titulo','deudor',20),
 ('1.1.01','Efectivo y equivalentes','titulo','deudor',30),
 ('1.1.01.001','Bancos - Banesco (Bs)','activo','deudor',40),
 ('1.1.01.002','Bancos - Banco de Venezuela (Bs)','activo','deudor',50),
 ('1.1.01.003','Caja / Efectivo','activo','deudor',60),
 ('1.1.02','Cuentas por cobrar','titulo','deudor',70),
 ('1.1.02.001','Clientes - Cuentas por cobrar','activo','deudor',80),
 ('1.1.02.002','Anticipos de clientes','activo','deudor',90),
 ('1.1.03','Inventarios','titulo','deudor',100),
 ('1.1.03.001','Inventario de mercancia','activo','deudor',110),
 ('1.1.04','Impuestos por recuperar','titulo','deudor',120),
 ('1.1.04.001','IVA por recuperar','activo','deudor',130),
 ('1.2','Activo No Corriente','titulo','deudor',140),
 ('1.2.01.001','Equipos y muebles','activo','deudor',150),
 ('2','PASIVO','titulo','acreedor',200),
 ('2.1','Pasivo Corriente','titulo','acreedor',210),
 ('2.1.01','Cuentas por pagar','titulo','acreedor',220),
 ('2.1.01.001','Proveedores - Cuentas por pagar','pasivo','acreedor',230),
 ('2.1.02.001','Retenciones IVA por pagar','pasivo','acreedor',240),
 ('2.1.03.001','Retenciones ISLR por pagar','pasivo','acreedor',250),
 ('2.1.04.001','IVA por pagar','pasivo','acreedor',260),
 ('2.1.05.001','Nomina por pagar','pasivo','acreedor',270),
 ('3','PATRIMONIO / CAPITAL','titulo','acreedor',300),
 ('3.01.001','Capital social','capital','acreedor',310),
 ('3.02.001','Utilidades retenidas','capital','acreedor',320),
 ('3.03.001','Resultado del ejercicio','capital','acreedor',330),
 ('4','INGRESOS','titulo','acreedor',400),
 ('4.1','Ingresos operativos','titulo','acreedor',410),
 ('4.01.001','Ventas de mercancia (16%)','ingreso','acreedor',420),
 ('4.02.001','Ventas de servicios (16%)','ingreso','acreedor',430),
 ('4.03.001','Ventas exentas','ingreso','acreedor',440),
 ('4.04.001','Descuentos sobre ventas','contra_ingreso','deudor',450),
 ('5','COSTOS Y GASTOS','titulo','deudor',500),
 ('5.1','Costo de ventas','titulo','deudor',510),
 ('5.01.001','Costo de ventas','costo','deudor',520),
 ('5.2','Gastos operativos','titulo','deudor',530),
 ('5.02.001','Compras de mercancia','gasto','deudor',540),
 ('5.02.002','Compras exentas','gasto','deudor',545),
 ('5.03.001','Compras de servicios','gasto','deudor',550),
 ('5.04.001','Sueldos y salarios','gasto','deudor',560),
 ('5.05.001','Alquileres','gasto','deudor',570),
 ('5.06.001','Servicios / hosting / internet','gasto','deudor',580),
 ('5.07.001','Comisiones','gasto','deudor',590),
 ('5.08.001','Gastos bancarios','gasto','deudor',600),
 ('5.09.001','Compra de divisas / diferencia de cambio','gasto','deudor',610)
on conflict (codigo) do nothing;
