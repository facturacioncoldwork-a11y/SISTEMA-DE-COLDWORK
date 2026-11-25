-- =====================================================================
-- COLDWORK ERP · Antigüedad del inventario: rápida con muchas empresas
-- ---------------------------------------------------------------------
-- La vista stock_lotes calculaba la ventana PEPS agrupando solo por
-- producto. Así Postgres no podía filtrar por empresa ANTES de calcular:
-- cada consulta recorría los movimientos y el stock de todas las empresas
-- visibles. Ahora todo se agrupa también por empresa_id, el filtro
-- `empresa_id = ...` baja hasta las tablas y usa índices.
-- Mismo resultado y mismas columnas: solo cambia el orden del trabajo.
-- =====================================================================

-- Solo las entradas que vienen de una llegada (lo único que usa la vista)
create index if not exists movimientos_entradas_lote_idx
  on public.movimientos (empresa_id, producto_id, llegada_id)
  where tipo = 'entrada' and llegada_id is not null;

create or replace view public.stock_lotes with (security_invoker = on) as
with total as (
  select s.empresa_id, s.producto_id, sum(s.cantidad) as cantidad
  from public.stock s
  group by s.empresa_id, s.producto_id
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
         sum(e.cantidad) over (partition by e.empresa_id, e.producto_id
                               order by e.fecha desc, e.orden desc) as hasta_aqui
  from entradas e
)
select a.empresa_id, a.producto_id, a.llegada_id, l.numero as llegada_numero, a.fecha,
       least(a.cantidad, t.cantidad - (a.hasta_aqui - a.cantidad)) as cantidad,
       a.costo_unitario
from acumulado a
join total t on t.empresa_id = a.empresa_id and t.producto_id = a.producto_id
join public.llegadas l on l.id = a.llegada_id
where a.hasta_aqui - a.cantidad < t.cantidad;

revoke all on public.stock_lotes from anon;
grant select on public.stock_lotes to authenticated;
