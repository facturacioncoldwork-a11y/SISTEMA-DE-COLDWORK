-- =====================================================================
-- COLDWORK ERP · Migración 0004 · Logística: plazos de entrega y CRUD
-- ---------------------------------------------------------------------
-- 1. Plazo del proveedor en la OC: fecha exacta o "2-3 semanas / 1 mes".
--    Se guarda el texto que dio el proveedor y la VENTANA calculada
--    (entrega_desde .. entrega_hasta).
-- 2. Seguimiento hasta el cliente: para quién es la compra, qué fecha se
--    le prometió, cuándo llegó de verdad y cuándo se le entregó.
-- 3. Fecha real de la llegada (la pone el usuario; por defecto hoy).
-- 4. CRUD completo: editar y ELIMINAR de verdad en la BD.
--    · Catálogos y OC: delete real; si tienen historial, la FK lo impide
--      y la API responde con un mensaje claro (desactívalo en su lugar).
--    · Llegadas y salidas: delete real que REVIERTE stock, kardex y OC
--      en la misma transacción (eliminar_llegada / eliminar_salida).
-- =====================================================================

-- ---------- 1 y 2. Plazos y seguimiento en la OC ----------
alter table public.ordenes_compra
  add column plazo_texto         text,          -- lo que dijo el proveedor: "2-3 semanas", "1 mes", "fecha exacta"
  add column entrega_desde       date,          -- inicio de la ventana estimada
  add column entrega_hasta       date,          -- fin de la ventana estimada (= fecha exacta si la dieron)
  add column fecha_llegada_real  date,          -- se llena sola al completar la recepción
  add column cliente             text,          -- para quién es la compra (opcional)
  add column compromiso_cliente  date,          -- fecha prometida al cliente
  add column entregado_cliente   date,          -- cuándo se le entregó
  add constraint oc_ventana_ok check (entrega_desde is null or entrega_hasta is null or entrega_desde <= entrega_hasta);

-- Lo anterior (fecha_entrega) pasa a ser el fin de la ventana
update public.ordenes_compra set entrega_hasta = fecha_entrega, entrega_desde = fecha_entrega where fecha_entrega is not null;
alter table public.ordenes_compra drop column fecha_entrega;

create index ordenes_compra_entrega_idx on public.ordenes_compra (empresa_id, entrega_hasta)
  where estado in ('enviada', 'parcial');

-- ---------- 3. Fecha real de llegada ----------
-- llegadas.fecha ya existe (timestamptz, default now()); ahora la puede fijar el usuario.

-- ---------- 4. Permisos de edición y borrado (RLS) ----------
create policy terceros_borrar on public.terceros for delete to authenticated
  using (public.es_logistica(empresa_id) or public.tiene_area(empresa_id, 'administracion'));
create policy almacenes_borrar on public.almacenes for delete to authenticated using (public.es_logistica(empresa_id));
create policy productos_borrar on public.productos for delete to authenticated using (public.es_logistica(empresa_id));

-- OC: se edita la cabecera directo; los ítems solo por RPC (actualizar_orden_compra)
create policy oc_editar on public.ordenes_compra for update to authenticated
  using (public.es_logistica(empresa_id)) with check (public.es_logistica(empresa_id));
create policy oc_borrar on public.ordenes_compra for delete to authenticated using (public.es_logistica(empresa_id));

-- Llegadas y salidas: solo se editan los datos de texto (no cantidades ni almacén)
create policy llegadas_editar on public.llegadas for update to authenticated
  using (public.es_logistica(empresa_id)) with check (public.es_logistica(empresa_id));
create policy salidas_editar on public.salidas for update to authenticated
  using (public.es_logistica(empresa_id)) with check (public.es_logistica(empresa_id));

grant delete on public.terceros, public.almacenes, public.productos, public.ordenes_compra to authenticated;
grant update (plazo_texto, entrega_desde, entrega_hasta, notas, cliente, compromiso_cliente, entregado_cliente, almacen_id, proveedor_id)
  on public.ordenes_compra to authenticated;
grant update (guia_remision, comprobante, notas, fecha) on public.llegadas to authenticated;
grant update (destino, responsable, referencia, notas) on public.salidas to authenticated;

-- ---------- RPC: crear OC (ahora con plazo y cliente) ----------
-- p_datos = { proveedorId, almacenId, plazoTexto?, entregaDesde?, entregaHasta?, cliente?,
--             compromisoCliente?, notas?, enviar?, items: [{ productoId, cantidad, costoUnitario }] }
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
    empresa_id, numero, proveedor_id, almacen_id, estado, notas,
    plazo_texto, entrega_desde, entrega_hasta, cliente, compromiso_cliente
  ) values (
    p_empresa,
    public.siguiente_numero(p_empresa, 'ordenes_compra'),
    (p_datos ->> 'proveedorId')::uuid,
    (p_datos ->> 'almacenId')::uuid,
    case when coalesce((p_datos ->> 'enviar')::boolean, false) then 'enviada'::public.estado_oc else 'borrador'::public.estado_oc end,
    nullif(trim(p_datos ->> 'notas'), ''),
    nullif(trim(p_datos ->> 'plazoTexto'), ''),
    nullif(p_datos ->> 'entregaDesde', '')::date,
    nullif(p_datos ->> 'entregaHasta', '')::date,
    nullif(trim(p_datos ->> 'cliente'), ''),
    nullif(p_datos ->> 'compromisoCliente', '')::date
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

-- ---------- RPC: reemplazar los ítems de una OC en borrador ----------
create or replace function public.reemplazar_items_oc(p_empresa uuid, p_orden uuid, p_items jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_estado public.estado_oc;
  v_item jsonb;
begin
  if not public.es_logistica(p_empresa) then
    raise exception 'No tienes acceso a logística' using errcode = '42501';
  end if;
  select estado into v_estado from public.ordenes_compra where id = p_orden and empresa_id = p_empresa for update;
  if v_estado is null then raise exception 'Orden no encontrada'; end if;
  if v_estado <> 'borrador' then
    raise exception 'Solo se cambian los productos de una orden en borrador';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]')) = 0 then
    raise exception 'La orden debe tener al menos un producto';
  end if;
  delete from public.ordenes_compra_items where orden_id = p_orden;
  for v_item in select * from jsonb_array_elements(p_items) loop
    if not exists (select 1 from public.productos p where p.id = (v_item ->> 'productoId')::uuid and p.empresa_id = p_empresa) then
      raise exception 'Producto no válido en la orden';
    end if;
    insert into public.ordenes_compra_items (orden_id, producto_id, cantidad, costo_unitario)
    values (p_orden, (v_item ->> 'productoId')::uuid, (v_item ->> 'cantidad')::numeric, (v_item ->> 'costoUnitario')::numeric);
  end loop;
end $$;

-- ---------- Interno: recalcular estado y fecha real de llegada de una OC ----------
create or replace function public._recalcular_oc(p_orden uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_pendiente boolean;
  v_recibido  boolean;
  v_ultima    date;
begin
  select bool_or(i.cantidad_recibida < i.cantidad), bool_or(i.cantidad_recibida > 0)
    into v_pendiente, v_recibido
  from public.ordenes_compra_items i where i.orden_id = p_orden;
  select max(l.fecha)::date into v_ultima from public.llegadas l where l.orden_id = p_orden;

  update public.ordenes_compra o set
    estado = case
      when o.estado = 'anulada' then o.estado
      when not coalesce(v_recibido, false) then 'enviada'::public.estado_oc
      when coalesce(v_pendiente, false) then 'parcial'::public.estado_oc
      else 'recibida'::public.estado_oc end,
    fecha_llegada_real = case when coalesce(v_pendiente, true) then null else v_ultima end
  where o.id = p_orden;
end $$;

-- ---------- RPC: registrar LLEGADA (ahora con fecha real) ----------
-- Igual que en 0003 + p_datos.fecha (fecha en que llegó; por defecto ahora).
create or replace function public.registrar_llegada(p_empresa uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id      uuid;
  v_orden   uuid := nullif(p_datos ->> 'ordenId', '')::uuid;
  v_almacen uuid := (p_datos ->> 'almacenId')::uuid;
  v_prov    uuid := nullif(p_datos ->> 'proveedorId', '')::uuid;
  v_fecha   timestamptz := coalesce(nullif(p_datos ->> 'fecha', '')::timestamptz, now());
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

  insert into public.llegadas (empresa_id, numero, almacen_id, proveedor_id, orden_id, guia_remision, comprobante, notas, fecha)
  values (
    p_empresa, public.siguiente_numero(p_empresa, 'llegadas'), v_almacen, v_prov, v_orden,
    nullif(trim(p_datos ->> 'guiaRemision'), ''), nullif(trim(p_datos ->> 'comprobante'), ''),
    nullif(trim(p_datos ->> 'notas'), ''), v_fecha
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


-- ---------- Interno: quitar filas de stock en cero sin historial ----------
-- Así, después de eliminar llegadas/salidas, un almacén o producto vacío se puede borrar.
create or replace function public._limpiar_stock(p_empresa uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.stock s
  where s.empresa_id = p_empresa and s.cantidad = 0
    and not exists (select 1 from public.movimientos m where m.producto_id = s.producto_id and m.almacen_id = s.almacen_id);
$$;

-- ---------- RPC: ELIMINAR una llegada (revierte todo) ----------
-- Resta lo que entró (falla si ese stock ya salió), borra su kardex,
-- devuelve el avance de la OC y borra la llegada.
-- El costo promedio NO se recalcula hacia atrás (queda el vigente).
create or replace function public.eliminar_llegada(p_empresa uuid, p_llegada uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_orden uuid;
  m record;
begin
  if not public.es_logistica(p_empresa) then
    raise exception 'No tienes acceso a logística' using errcode = '42501';
  end if;
  select orden_id into v_orden from public.llegadas where id = p_llegada and empresa_id = p_empresa for update;
  if not found then raise exception 'Llegada no encontrada'; end if;

  for m in select producto_id, almacen_id, cantidad from public.movimientos where llegada_id = p_llegada loop
    perform public._stock_sumar(p_empresa, m.producto_id, m.almacen_id, -m.cantidad);
    if v_orden is not null then
      update public.ordenes_compra_items set cantidad_recibida = greatest(cantidad_recibida - m.cantidad, 0)
      where orden_id = v_orden and producto_id = m.producto_id;
    end if;
  end loop;

  delete from public.movimientos where llegada_id = p_llegada;
  delete from public.llegadas where id = p_llegada;
  if v_orden is not null then
    perform public._recalcular_oc(v_orden);
  end if;
  perform public._limpiar_stock(p_empresa);
end $$;

-- ---------- RPC: ELIMINAR una salida (devuelve el stock) ----------
create or replace function public.eliminar_salida(p_empresa uuid, p_salida uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  m record;
begin
  if not public.es_logistica(p_empresa) then
    raise exception 'No tienes acceso a logística' using errcode = '42501';
  end if;
  perform 1 from public.salidas where id = p_salida and empresa_id = p_empresa for update;
  if not found then raise exception 'Salida no encontrada'; end if;

  -- salida → vuelve a sumar en origen; entrada (transferencia) → se resta del destino
  for m in select producto_id, almacen_id, tipo, cantidad from public.movimientos where salida_id = p_salida loop
    perform public._stock_sumar(p_empresa, m.producto_id, m.almacen_id,
      case when m.tipo = 'salida' then m.cantidad else -m.cantidad end);
  end loop;

  delete from public.movimientos where salida_id = p_salida;
  delete from public.salidas where id = p_salida;
  perform public._limpiar_stock(p_empresa);
end $$;

-- ---------- Resumen: añade llegadas de la semana ----------
-- (se mantiene resumen_logistica de 0003; la ventana se calcula en la API)

-- ---------- Permisos de las funciones nuevas ----------
revoke execute on function public.reemplazar_items_oc(uuid, uuid, jsonb), public._recalcular_oc(uuid),
  public.eliminar_llegada(uuid, uuid), public.eliminar_salida(uuid, uuid) from public, anon;
revoke execute on function public._recalcular_oc(uuid), public._limpiar_stock(uuid) from public, anon, authenticated;
grant execute on function public.reemplazar_items_oc(uuid, uuid, jsonb), public.eliminar_llegada(uuid, uuid),
  public.eliminar_salida(uuid, uuid) to authenticated;
