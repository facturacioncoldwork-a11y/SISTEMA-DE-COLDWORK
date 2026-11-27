-- =====================================================================
-- COLDWORK ERP · Moneda del inventario (soles o dólares)
-- ---------------------------------------------------------------------
-- El inventario se valoriza en UNA moneda (costo promedio, kardex, panel).
-- Hasta ahora siempre en soles: cada compra en dólares pedía el tipo de
-- cambio. Ahora la empresa elige la moneda del inventario:
--  · Si es dólares, las compras en dólares ya NO piden tipo de cambio.
--  · Solo una compra en otra moneda lo necesita, y si no lo mandan se usa
--    el tipo de cambio referencial de la empresa.
--  · cambiar_moneda_inventario convierte una sola vez los costos que ya
--    existen (solo el dueño). No toca contabilidad: sigue en soles.
-- No crea tablas: agrega dos columnas a logistica_ajustes.
-- =====================================================================

alter table public.logistica_ajustes
  add column moneda           char(3) not null default 'PEN' check (moneda in ('PEN', 'USD')),
  add column tipo_cambio_ref  numeric(10, 4) check (tipo_cambio_ref is null or tipo_cambio_ref > 0);  -- S/ por US$

-- Moneda en que se lleva el inventario de la empresa (por defecto soles, como antes)
create or replace function public.moneda_inventario(p_empresa uuid)
returns char(3) language sql stable security definer set search_path = '' as $$
  select coalesce((select a.moneda from public.logistica_ajustes a where a.empresa_id = p_empresa), 'PEN')::char(3);
$$;

-- ---------- RPC: registrar LLEGADA (tipo de cambio solo si la moneda es distinta) ----------
create or replace function public.registrar_llegada(p_empresa uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id      uuid;
  v_orden   uuid := nullif(p_datos ->> 'ordenId', '')::uuid;
  v_almacen uuid := (p_datos ->> 'almacenId')::uuid;
  v_prov    uuid := nullif(p_datos ->> 'proveedorId', '')::uuid;
  v_fecha   timestamptz := coalesce(nullif(p_datos ->> 'fecha', '')::timestamptz, now());
  v_moneda  char(3) := nullif(p_datos ->> 'moneda', '');  -- sin moneda: la del inventario
  v_tc      numeric := nullif(p_datos ->> 'tipoCambio', '')::numeric;
  v_base    char(3);
  v_item    jsonb;
  v_prod    uuid;
  v_cant    numeric;
  v_costo   numeric;
  v_total   numeric;
  v_saldo   numeric;
  v_estado  public.estado_oc;
begin
  if not public.es_logistica(p_empresa) then
    raise exception 'No tienes acceso a logística' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_datos -> 'items', '[]')) = 0 then
    raise exception 'Registra al menos un producto';
  end if;
  if v_fecha > now() + interval '1 day' then
    raise exception 'La fecha de llegada no puede ser futura';
  end if;
  -- Solo se necesita tipo de cambio si la compra está en otra moneda que el inventario;
  -- si no lo mandan, se usa el referencial de la empresa
  v_base := public.moneda_inventario(p_empresa);
  v_moneda := coalesce(v_moneda, v_base);
  if v_moneda not in ('PEN', 'USD') then
    raise exception 'Moneda no válida';
  end if;
  if v_moneda <> v_base then
    v_tc := coalesce(v_tc, (select a.tipo_cambio_ref from public.logistica_ajustes a where a.empresa_id = p_empresa));
    if v_tc is null or v_tc <= 0 then
      raise exception 'Indica el tipo de cambio: la compra está en % y el inventario se lleva en %', v_moneda, v_base;
    end if;
  end if;
  if not exists (select 1 from public.almacenes a where a.id = v_almacen and a.empresa_id = p_empresa and a.activo) then
    raise exception 'Almacén no válido';
  end if;

  if v_orden is not null then
    select estado, proveedor_id into v_estado, v_prov from public.ordenes_compra
    where id = v_orden and empresa_id = p_empresa for update;
    if v_estado is null then raise exception 'Orden de compra no encontrada'; end if;
    if v_estado not in ('enviada', 'parcial') then
      raise exception 'La orden está en estado "%" y no puede recibir productos', v_estado;
    end if;
  end if;

  insert into public.llegadas (empresa_id, numero, almacen_id, proveedor_id, orden_id, guia_remision, comprobante, notas, fecha, moneda, tipo_cambio)
  values (
    p_empresa, public.siguiente_numero(p_empresa, 'llegadas'), v_almacen, v_prov, v_orden,
    nullif(trim(p_datos ->> 'guiaRemision'), ''), nullif(trim(p_datos ->> 'comprobante'), ''),
    nullif(trim(p_datos ->> 'notas'), ''), v_fecha, v_moneda, case when v_moneda <> v_base then v_tc end
  ) returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_datos -> 'items') loop
    v_prod  := (v_item ->> 'productoId')::uuid;
    v_cant  := (v_item ->> 'cantidad')::numeric;
    v_costo := coalesce((v_item ->> 'costoUnitario')::numeric, 0);
    if v_cant is null or v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    if not exists (select 1 from public.productos p where p.id = v_prod and p.empresa_id = p_empresa) then
      raise exception 'Producto no válido';
    end if;

    select coalesce(sum(s.cantidad), 0) into v_total from public.stock s where s.producto_id = v_prod;
    update public.productos p
    set costo_promedio = case when v_total + v_cant = 0 then v_costo
                              else round((p.costo_promedio * v_total + v_costo * v_cant) / (v_total + v_cant), 4) end
    where p.id = v_prod;

    v_saldo := public._stock_sumar(p_empresa, v_prod, v_almacen, v_cant);
    insert into public.movimientos (empresa_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, saldo, llegada_id, fecha)
    values (p_empresa, v_prod, v_almacen, 'entrada', v_cant, v_costo, v_saldo, v_id, v_fecha);

    if v_orden is not null then
      update public.ordenes_compra_items set cantidad_recibida = cantidad_recibida + v_cant
      where orden_id = v_orden and producto_id = v_prod;
      if not found then raise exception 'Un producto recibido no está en la orden de compra'; end if;
    end if;
  end loop;

  if v_orden is not null then
    perform public._recalcular_oc(v_orden);
  end if;
  return v_id;
end $$;


-- ---------- RPC: cambiar la moneda del inventario (solo el dueño) ----------
-- p_tipo_cambio = S/ por cada US$. Convierte el costo promedio de los productos y el costo
-- del kardex (y por tanto la valorización y la antigüedad). Las órdenes de compra no cambian:
-- cada una mantiene su propia moneda.
create or replace function public.cambiar_moneda_inventario(p_empresa uuid, p_moneda char(3), p_tipo_cambio numeric)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_actual  char(3);
  v_hay     boolean;
  v_n       integer := 0;
begin
  if not public.tiene_rol(p_empresa, array['dueno']::public.rol_empresa[]) then
    raise exception 'Solo el dueño cambia la moneda del inventario' using errcode = '42501';
  end if;
  if p_moneda not in ('PEN', 'USD') then
    raise exception 'Moneda no válida';
  end if;
  v_actual := public.moneda_inventario(p_empresa);
  if p_moneda = v_actual then
    return 0;
  end if;

  v_hay := exists (select 1 from public.productos p where p.empresa_id = p_empresa and p.costo_promedio > 0)
        or exists (select 1 from public.movimientos m where m.empresa_id = p_empresa and m.costo_unitario > 0);
  if v_hay and (p_tipo_cambio is null or p_tipo_cambio <= 0) then
    raise exception 'Indica el tipo de cambio para convertir los costos que ya están registrados';
  end if;

  if v_hay then
    update public.productos p
    set costo_promedio = round(case when p_moneda = 'USD' then p.costo_promedio / p_tipo_cambio
                                    else p.costo_promedio * p_tipo_cambio end, 4)
    where p.empresa_id = p_empresa and p.costo_promedio > 0;
    get diagnostics v_n = row_count;

    update public.movimientos m
    set costo_unitario = round(case when p_moneda = 'USD' then m.costo_unitario / p_tipo_cambio
                                    else m.costo_unitario * p_tipo_cambio end, 4)
    where m.empresa_id = p_empresa and m.costo_unitario > 0;
  end if;

  insert into public.logistica_ajustes (empresa_id, moneda, tipo_cambio_ref)
  values (p_empresa, p_moneda, coalesce(p_tipo_cambio, null))
  on conflict (empresa_id) do update
    set moneda = excluded.moneda,
        tipo_cambio_ref = coalesce(excluded.tipo_cambio_ref, public.logistica_ajustes.tipo_cambio_ref);
  return v_n;
end $$;

revoke execute on function public.moneda_inventario(uuid), public.cambiar_moneda_inventario(uuid, char, numeric)
  from public, anon;
grant execute on function public.moneda_inventario(uuid), public.cambiar_moneda_inventario(uuid, char, numeric)
  to authenticated;
