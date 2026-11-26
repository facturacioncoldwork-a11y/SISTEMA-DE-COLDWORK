-- =====================================================================
-- COLDWORK ERP · Pagos a proveedores por orden de compra
-- ---------------------------------------------------------------------
-- Para no olvidar cuánto se debe a cada proveedor: cada orden de compra
-- tiene su plan de pagos (adelanto, saldo, crédito) con fecha de
-- vencimiento y si ya se pagó. Incluye los adelantos que se pagan ANTES
-- de recibir la factura (Finanzas → Cuentas por pagar empieza con la
-- factura).
--
-- · oc_pagos: cuotas de cada OC. Solo el dueño (CEO) las ve y registra:
--   el encargado de logística no ve montos adeudados ni pagos.
-- · ordenes_compra: proyecto (de Operaciones) y fecha de aprobación.
--   El código y el nombre del proyecto se copian solos al elegirlo,
--   así logística los ve sin tener acceso a las cotizaciones.
-- · No se puede eliminar una OC que ya tiene pagos hechos.
-- =====================================================================

-- ---------- Proyecto y fecha de aprobación en la OC ----------
alter table public.ordenes_compra
  add column proyecto_id      uuid references public.ope_cotizaciones (id) on delete set null,
  add column proyecto_codigo  text check (length(proyecto_codigo) <= 40),
  add column proyecto_nombre  text check (length(proyecto_nombre) <= 300),
  add column fecha_aprobado   date;

create index ordenes_compra_proyecto_idx on public.ordenes_compra (empresa_id, proyecto_id)
  where proyecto_id is not null;

grant update (proyecto_id, proyecto_codigo, proyecto_nombre, fecha_aprobado)
  on public.ordenes_compra to authenticated;

-- Al elegir un proyecto de Operaciones se copian su código y nombre (y debe ser de la misma empresa)
create or replace function public._oc_copiar_proyecto()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_numero  text;
  v_nombre  text;
begin
  if new.proyecto_id is null then
    return new;
  end if;
  select c.numero, nullif(trim(c.proyecto), '') into v_numero, v_nombre
  from public.ope_cotizaciones c
  where c.id = new.proyecto_id and c.empresa_id = new.empresa_id;
  if v_numero is null then
    raise exception 'El proyecto elegido no existe en esta empresa';
  end if;
  new.proyecto_codigo := v_numero;
  new.proyecto_nombre := coalesce(v_nombre, v_numero);
  return new;
end $$;

create trigger ordenes_compra_proyecto before insert or update of proyecto_id on public.ordenes_compra
  for each row execute function public._oc_copiar_proyecto();

-- Proyectos que se pueden elegir al comprar: cotizaciones enviadas o aprobadas de Operaciones.
-- (Logística no lee las cotizaciones: solo recibe código, proyecto y cliente.)
create or replace function public.proyectos_para_compras(p_empresa uuid)
returns table (id uuid, codigo text, proyecto text, cliente text, estado text, fecha date)
language sql stable security definer set search_path = '' as $$
  select c.id, c.numero, coalesce(nullif(trim(c.proyecto), ''), c.numero), t.razon_social, c.estado, c.fecha
  from public.ope_cotizaciones c
  left join public.terceros t on t.id = c.cliente_id
  where c.empresa_id = p_empresa
    and c.estado in ('aprobada', 'enviada')
    and public.es_logistica(p_empresa)
  order by (c.estado = 'aprobada') desc, c.fecha desc
  limit 300;
$$;

revoke execute on function public.proyectos_para_compras(uuid) from public, anon;
grant execute on function public.proyectos_para_compras(uuid) to authenticated;
revoke execute on function public._oc_copiar_proyecto() from public, anon, authenticated;

-- ---------- Plan de pagos de cada OC ----------
create table public.oc_pagos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  orden_id        uuid not null references public.ordenes_compra (id) on delete cascade,
  concepto        text not null check (length(trim(concepto)) between 2 and 60),  -- "Adelanto 50 %", "Saldo"
  porcentaje      numeric(5, 2) check (porcentaje is null or porcentaje between 0 and 100),
  monto           numeric(14, 2) not null check (monto > 0),                       -- en la moneda de la OC
  vence           date not null,
  pagado_en       date,
  referencia      text check (length(referencia) <= 80),                           -- n° de operación
  notas           text check (length(notas) <= 500),
  creado_por      uuid references auth.users (id) on delete set null default auth.uid(),
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now()
);
create index oc_pagos_orden_idx on public.oc_pagos (orden_id);
create index oc_pagos_pendientes_idx on public.oc_pagos (empresa_id, vence) where pagado_en is null;

create trigger oc_pagos_actualizado before update on public.oc_pagos
  for each row execute function public.tocar_actualizado();

-- La cuota debe ser de una OC de la misma empresa
create or replace function public._oc_pago_valido()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.ordenes_compra o where o.id = new.orden_id and o.empresa_id = new.empresa_id) then
    raise exception 'La orden de compra no es de esta empresa';
  end if;
  if new.pagado_en is not null and new.pagado_en > (now() at time zone 'America/Lima')::date then
    raise exception 'La fecha de pago no puede ser futura';
  end if;
  return new;
end $$;

create trigger oc_pagos_valido before insert or update on public.oc_pagos
  for each row execute function public._oc_pago_valido();

alter table public.oc_pagos enable row level security;
create policy oc_pagos_ver on public.oc_pagos for select to authenticated
  using (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]));
create policy oc_pagos_crear on public.oc_pagos for insert to authenticated
  with check (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]));
create policy oc_pagos_editar on public.oc_pagos for update to authenticated
  using (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]))
  with check (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]));
create policy oc_pagos_borrar on public.oc_pagos for delete to authenticated
  using (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]));

revoke all on public.oc_pagos from anon;
grant select, insert, update, delete on public.oc_pagos to authenticated;
revoke execute on function public._oc_pago_valido() from public, anon, authenticated;

-- ---------- No borrar una OC que ya tiene pagos hechos ----------
create or replace function public._oc_no_borrar_con_pagos()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.oc_pagos p where p.orden_id = old.id and p.pagado_en is not null) then
    raise exception 'Esta orden de compra ya tiene pagos al proveedor registrados: anúlala en lugar de eliminarla';
  end if;
  return old;
end $$;

create trigger ordenes_compra_no_borrar_con_pagos before delete on public.ordenes_compra
  for each row execute function public._oc_no_borrar_con_pagos();

revoke execute on function public._oc_no_borrar_con_pagos() from public, anon, authenticated;
