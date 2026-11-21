-- =====================================================================
-- COLDWORK ERP · Migración 0006 · Orden de compra en formato COLD WORK
-- ---------------------------------------------------------------------
-- · Datos del documento: condiciones de pago, lugar de entrega, atención,
--   solicitado por y la cotización del proveedor de la que salió.
-- · Moneda de la OC (PEN o USD): los proveedores cotizan en dólares.
-- · Llegadas desde una OC en dólares guardan moneda y TIPO DE CAMBIO:
--   el costo que entra al inventario siempre está en soles (la app lo
--   convierte), así el costo promedio nunca mezcla monedas.
-- =====================================================================

alter table public.ordenes_compra
  add column condiciones_pago text,   -- "Contado", "Factura a 15 días"
  add column lugar_entrega    text,   -- "Ica", "Almacén central"
  add column atencion         text,   -- persona del proveedor
  add column solicitado_por   text,   -- quien pide la compra
  add column cotizacion_ref   text,   -- "HC 1724" (n° de la cotización del proveedor)
  add constraint oc_moneda_ok check (moneda in ('PEN', 'USD'));

alter table public.llegadas
  add column moneda      char(3) not null default 'PEN' check (moneda in ('PEN', 'USD')),
  add column tipo_cambio numeric(10,4) check (tipo_cambio is null or tipo_cambio > 0);

grant update (condiciones_pago, lugar_entrega, atencion, solicitado_por, cotizacion_ref, moneda)
  on public.ordenes_compra to authenticated;

-- ---------- RPC: crear OC (con moneda y datos del documento) ----------
create or replace function public.crear_orden_compra(p_empresa uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_item jsonb;
begin
  if not public.es_logistica(p_empresa) then
    raise exception 'No tienes acceso a logística' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_datos -> 'items', '[]')) = 0 then
    raise exception 'La orden debe tener al menos un producto';
  end if;
  if not exists (select 1 from public.terceros t where t.id = (p_datos ->> 'proveedorId')::uuid
                 and t.empresa_id = p_empresa and t.es_proveedor and t.activo) then
    raise exception 'Proveedor no válido';
  end if;
  if not exists (select 1 from public.almacenes a where a.id = (p_datos ->> 'almacenId')::uuid
                 and a.empresa_id = p_empresa and a.activo) then
    raise exception 'Almacén no válido';
  end if;

  insert into public.ordenes_compra (
    empresa_id, numero, proveedor_id, almacen_id, estado, notas, moneda,
    plazo_texto, entrega_desde, entrega_hasta, cliente, compromiso_cliente,
    condiciones_pago, lugar_entrega, atencion, solicitado_por, cotizacion_ref
  ) values (
    p_empresa,
    public.siguiente_numero(p_empresa, 'ordenes_compra'),
    (p_datos ->> 'proveedorId')::uuid,
    (p_datos ->> 'almacenId')::uuid,
    case when coalesce((p_datos ->> 'enviar')::boolean, false) then 'enviada'::public.estado_oc else 'borrador'::public.estado_oc end,
    nullif(trim(p_datos ->> 'notas'), ''),
    coalesce(nullif(p_datos ->> 'moneda', ''), 'PEN'),
    nullif(trim(p_datos ->> 'plazoTexto'), ''),
    nullif(p_datos ->> 'entregaDesde', '')::date,
    nullif(p_datos ->> 'entregaHasta', '')::date,
    nullif(trim(p_datos ->> 'cliente'), ''),
    nullif(p_datos ->> 'compromisoCliente', '')::date,
    nullif(trim(p_datos ->> 'condicionesPago'), ''),
    nullif(trim(p_datos ->> 'lugarEntrega'), ''),
    nullif(trim(p_datos ->> 'atencion'), ''),
    nullif(trim(p_datos ->> 'solicitadoPor'), ''),
    nullif(trim(p_datos ->> 'cotizacionRef'), '')
  ) returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_datos -> 'items') loop
    if not exists (select 1 from public.productos p where p.id = (v_item ->> 'productoId')::uuid and p.empresa_id = p_empresa) then
      raise exception 'Producto no válido en la orden';
    end if;
    insert into public.ordenes_compra_items (orden_id, producto_id, cantidad, costo_unitario)
    values (v_id, (v_item ->> 'productoId')::uuid, (v_item ->> 'cantidad')::numeric, (v_item ->> 'costoUnitario')::numeric);
  end loop;
  return v_id;
end $$;

-- ---------- RPC: registrar LLEGADA (guarda moneda y tipo de cambio) ----------
-- Los costoUnitario de items llegan SIEMPRE en soles (la app convierte con el
-- tipo de cambio). moneda/tipoCambio quedan para saber de dónde salió el costo.
create or replace function public.registrar_llegada(p_empresa uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id      uuid;
  v_orden   uuid := nullif(p_datos ->> 'ordenId', '')::uuid;
  v_almacen uuid := (p_datos ->> 'almacenId')::uuid;
  v_prov    uuid := nullif(p_datos ->> 'proveedorId', '')::uuid;
  v_fecha   timestamptz := coalesce(nullif(p_datos ->> 'fecha', '')::timestamptz, now());
  v_moneda  char(3) := coalesce(nullif(p_datos ->> 'moneda', ''), 'PEN');
  v_tc      numeric := nullif(p_datos ->> 'tipoCambio', '')::numeric;
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
  if v_moneda = 'USD' and (v_tc is null or v_tc <= 0) then
    raise exception 'Indica el tipo de cambio: la orden está en dólares';
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
    nullif(trim(p_datos ->> 'notas'), ''), v_fecha, v_moneda, case when v_moneda = 'USD' then v_tc end
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
