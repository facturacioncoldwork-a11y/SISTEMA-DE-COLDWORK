-- =====================================================================
-- COLDWORK ERP · Pagos que vencen "al llegar" el equipo
-- ---------------------------------------------------------------------
-- Una cuota puede vencer en una fecha fija o "N días después de que llega"
-- (0 = al llegar, 30 = crédito 30 días). Mientras el equipo no llega, su
-- vencimiento es el estimado; cuando la orden de compra se recibe completa,
-- el vencimiento se fija solo con la fecha real de llegada y el CEO ve
-- "Llegó: toca pagar el saldo". No crea tablas.
-- =====================================================================

alter table public.oc_pagos
  add column dias_tras_llegada smallint check (dias_tras_llegada between 0 and 365);

-- Al recibirse la OC completa, las cuotas pendientes "tras la llegada" toman la fecha real
create or replace function public._oc_pagos_fijar_al_llegar()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.oc_pagos p
  set vence = new.fecha_llegada_real + p.dias_tras_llegada
  where p.orden_id = new.id
    and p.pagado_en is null
    and p.dias_tras_llegada is not null;
  return null;
end $$;

create trigger ordenes_compra_pagos_al_llegar
  after update of fecha_llegada_real on public.ordenes_compra
  for each row
  when (new.fecha_llegada_real is not null and new.fecha_llegada_real is distinct from old.fecha_llegada_real)
  execute function public._oc_pagos_fijar_al_llegar();

revoke execute on function public._oc_pagos_fijar_al_llegar() from public, anon, authenticated;

-- Cuotas que ya existían, armadas con las plantillas: se reconocen por el concepto
-- ("Saldo 50 %" = al llegar; "Crédito 30 días" / "Saldo 50 % (crédito 30 d)" = 30 días después)
update public.oc_pagos
set dias_tras_llegada = least(365, (substring(concepto from 'r[eé]dito (\d+)'))::int)
where pagado_en is null and concepto ~* 'cr[eé]dito \d+';

update public.oc_pagos
set dias_tras_llegada = 0
where pagado_en is null and dias_tras_llegada is null and concepto ~* '^saldo';

-- Y si el equipo ya llegó, su vencimiento pasa a la fecha real de llegada
update public.oc_pagos p
set vence = o.fecha_llegada_real + p.dias_tras_llegada
from public.ordenes_compra o
where o.id = p.orden_id
  and p.pagado_en is null
  and p.dias_tras_llegada is not null
  and o.fecha_llegada_real is not null;
