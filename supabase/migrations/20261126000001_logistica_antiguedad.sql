-- =====================================================================
-- COLDWORK ERP · Migración 0011 · Antigüedad del inventario
-- ---------------------------------------------------------------------
-- El almacén guarda sobrantes de proyectos: no siempre se repone, pero
-- hay que saber QUÉ hay y DESDE CUÁNDO, para no comprar de más y para
-- vender (aunque sea con descuento) lo que lleva años guardado.
--
-- · stock_lotes (vista): qué parte del stock actual vino de cada llegada
--   y en qué fecha. Se calcula con PEPS/FIFO: se asume que sale primero
--   lo más antiguo, así lo que queda es lo más reciente. Un producto solo
--   aparece "antiguo" si de verdad no se movió.
--   Las transferencias entre almacenes no cambian la antigüedad.
-- · logistica_ajustes: desde cuántos meses un producto es "antiguo"
--   (por defecto 24 = 2 años). Lo cambian solo el dueño y el admin.
-- · Al cambiar la fecha de una llegada, el kardex y la orden de compra
--   se actualizan solos (antes solo cambiaba la llegada) y no se acepta
--   una fecha futura.
-- =====================================================================

-- ---------- Ajustes de logística por empresa ----------
create table public.logistica_ajustes (
  empresa_id        uuid primary key references public.empresas (id) on delete cascade,
  meses_antiguedad  smallint not null default 24 check (meses_antiguedad between 3 and 120),
  actualizado_en    timestamptz not null default now()
);

create trigger logistica_ajustes_actualizado before update on public.logistica_ajustes
  for each row execute function public.tocar_actualizado();

alter table public.logistica_ajustes enable row level security;
create policy logistica_ajustes_ver on public.logistica_ajustes for select to authenticated
  using (public.es_logistica(empresa_id));
create policy logistica_ajustes_crear on public.logistica_ajustes for insert to authenticated
  with check (public.tiene_rol(empresa_id, array['dueno', 'admin']::public.rol_empresa[]));
create policy logistica_ajustes_editar on public.logistica_ajustes for update to authenticated
  using (public.tiene_rol(empresa_id, array['dueno', 'admin']::public.rol_empresa[]))
  with check (public.tiene_rol(empresa_id, array['dueno', 'admin']::public.rol_empresa[]));

revoke all on public.logistica_ajustes from anon;
grant select, insert, update on public.logistica_ajustes to authenticated;

-- ---------- Lotes vivos del stock (PEPS) ----------
create view public.stock_lotes with (security_invoker = on) as
with total as (
  select s.producto_id, sum(s.cantidad) as cantidad
  from public.stock s
  group by s.producto_id
),
entradas as (
  -- una fila por llegada y producto (si una llegada trae el mismo producto dos veces, se juntan)
  select m.empresa_id, m.producto_id, m.llegada_id, max(m.fecha) as fecha,
         sum(m.cantidad) as cantidad,
         round(sum(m.cantidad * m.costo_unitario) / nullif(sum(m.cantidad), 0), 4) as costo_unitario,
         max(m.id) as orden
  from public.movimientos m
  where m.tipo = 'entrada' and m.llegada_id is not null
  group by m.empresa_id, m.producto_id, m.llegada_id
),
acumulado as (
  -- de la más reciente a la más antigua: cuánto stock cubren las llegadas más nuevas
  select e.*,
         sum(e.cantidad) over (partition by e.producto_id order by e.fecha desc, e.orden desc) as hasta_aqui
  from entradas e
)
select a.empresa_id, a.producto_id, a.llegada_id, l.numero as llegada_numero, a.fecha,
       least(a.cantidad, t.cantidad - (a.hasta_aqui - a.cantidad)) as cantidad,
       a.costo_unitario
from acumulado a
join total t on t.producto_id = a.producto_id
join public.llegadas l on l.id = a.llegada_id
where a.hasta_aqui - a.cantidad < t.cantidad;

revoke all on public.stock_lotes from anon;
grant select on public.stock_lotes to authenticated;

-- ---------- Cambiar la fecha de una llegada ----------
create or replace function public._llegada_validar_fecha()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.fecha > now() + interval '1 day' then
    raise exception 'La fecha de llegada no puede ser futura';
  end if;
  return new;
end $$;

-- El kardex usa la fecha de la llegada: se copia a sus movimientos y se recalcula la OC
create or replace function public._llegada_sincronizar_fecha()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.movimientos set fecha = new.fecha where llegada_id = new.id;
  if new.orden_id is not null then
    perform public._recalcular_oc(new.orden_id);
  end if;
  return null;
end $$;

create trigger llegadas_validar_fecha before update of fecha on public.llegadas
  for each row when (new.fecha is distinct from old.fecha)
  execute function public._llegada_validar_fecha();
create trigger llegadas_sincronizar_fecha after update of fecha on public.llegadas
  for each row when (new.fecha is distinct from old.fecha)
  execute function public._llegada_sincronizar_fecha();

revoke execute on function public._llegada_validar_fecha(), public._llegada_sincronizar_fecha()
  from public, anon, authenticated;

-- Corrige llegadas editadas antes de esta migración (su kardex quedó con la fecha vieja)
update public.movimientos m set fecha = l.fecha
from public.llegadas l
where m.llegada_id = l.id and m.fecha is distinct from l.fecha;
