-- =====================================================================
-- COLDWORK · INSTALAR ALMACÉN Y LOGÍSTICA (todo en un solo paso)
-- ---------------------------------------------------------------------
-- Para una base que YA tiene empresas, perfiles, miembros e invitaciones
-- (migraciones 0001 y 0002). Junta, en orden, las migraciones:
--   0003 logística · 0004 plazos y CRUD · 0005 accesos solo dueño ·
--   0006 formato de OC y moneda
--
-- Supabase → SQL Editor → pega TODO → Run.  Ejecútalo UNA sola vez.
-- Va dentro de una transacción: si algo falla, no se crea nada a medias.
-- (Generado a partir de supabase/migrations/; si cambias una migración,
--  vuelve a generar este archivo.)
-- =====================================================================
begin;


-- #####################################################################
-- ## migrations/20261120000001_logistica.sql
-- #####################################################################

-- =====================================================================
-- COLDWORK ERP · Migración 0003 · Almacén y logística
-- ---------------------------------------------------------------------
-- Proveedores (terceros), almacenes, productos, stock por almacén,
-- órdenes de compra, LLEGADAS de producto, SALIDAS de producto y KARDEX.
--
-- Reglas:
--  · Todo con empresa_id + RLS. Se ve y se opera con el área 'logistica'
--    (dueño y admin siempre).
--  · El stock y el kardex NO se escriben directo: solo por las funciones
--    registrar_llegada / registrar_salida, que son atómicas (bloquean la
--    fila de stock, validan que alcance y recalculan el costo promedio).
-- =====================================================================

-- ---------- Tipos ----------
create type public.tipo_producto as enum ('repuesto', 'gas_refrigerante', 'herramienta', 'insumo', 'equipo');
create type public.tipo_almacen  as enum ('principal', 'movil', 'obra');
create type public.estado_oc     as enum ('borrador', 'enviada', 'parcial', 'recibida', 'anulada');
create type public.motivo_salida as enum ('servicio_tecnico', 'venta', 'consumo_interno', 'merma', 'transferencia');
create type public.tipo_movimiento as enum ('entrada', 'salida');

-- Acceso de logística en una sola función (la usan todas las políticas)
create or replace function public.es_logistica(p_empresa uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.tiene_area(p_empresa, 'logistica');
$$;

-- ---------- Terceros (proveedores hoy; clientes cuando llegue el módulo Terceros) ----------
create table public.terceros (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  tipo_documento  text not null default 'RUC' check (tipo_documento in ('RUC', 'DNI', 'CE', 'OTRO')),
  numero_documento text not null check (length(trim(numero_documento)) between 6 and 15),
  razon_social    text not null check (length(trim(razon_social)) > 0),
  es_proveedor    boolean not null default true,
  es_cliente      boolean not null default false,
  rubro           text,
  contacto        text,
  telefono        text,
  correo          text,
  direccion       text,
  dias_credito    integer not null default 0 check (dias_credito between 0 and 365),
  calificacion    smallint check (calificacion between 1 and 5),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (empresa_id, numero_documento)
);
create trigger terceros_actualizado before update on public.terceros
  for each row execute function public.tocar_actualizado();

-- ---------- Almacenes ----------
create table public.almacenes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  codigo          text not null check (codigo ~ '^[A-Z0-9-]{2,12}$'),
  nombre          text not null check (length(trim(nombre)) > 0),
  tipo            public.tipo_almacen not null default 'principal',
  direccion       text,
  responsable     text,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (empresa_id, codigo)
);
create trigger almacenes_actualizado before update on public.almacenes
  for each row execute function public.tocar_actualizado();

-- ---------- Productos ----------
create table public.productos (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  sku             text not null check (sku ~ '^[A-Z0-9._-]{2,30}$'),
  nombre          text not null check (length(trim(nombre)) > 0),
  descripcion     text,
  tipo            public.tipo_producto not null default 'repuesto',
  marca           text,
  unidad          text not null default 'UND',
  stock_minimo    numeric(14,3) not null default 0 check (stock_minimo >= 0),
  costo_promedio  numeric(14,4) not null default 0 check (costo_promedio >= 0),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (empresa_id, sku)
);
create index productos_empresa_idx on public.productos (empresa_id, nombre);
create trigger productos_actualizado before update on public.productos
  for each row execute function public.tocar_actualizado();

-- ---------- Stock por almacén ----------
create table public.stock (
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  producto_id  uuid not null references public.productos (id) on delete restrict,
  almacen_id   uuid not null references public.almacenes (id) on delete restrict,
  cantidad     numeric(14,3) not null default 0 check (cantidad >= 0),
  actualizado_en timestamptz not null default now(),
  primary key (producto_id, almacen_id)
);
create index stock_empresa_idx on public.stock (empresa_id);

-- ---------- Órdenes de compra ----------
create table public.ordenes_compra (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas (id) on delete cascade,
  numero             integer not null,
  proveedor_id       uuid not null references public.terceros (id) on delete restrict,
  almacen_id         uuid not null references public.almacenes (id) on delete restrict,
  estado             public.estado_oc not null default 'borrador',
  fecha              date not null default current_date,
  fecha_entrega      date,
  moneda             char(3) not null default 'PEN',
  notas              text,
  creado_por         uuid references auth.users (id) on delete set null default auth.uid(),
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  unique (empresa_id, numero)
);
create trigger ordenes_compra_actualizado before update on public.ordenes_compra
  for each row execute function public.tocar_actualizado();

create table public.ordenes_compra_items (
  id                 uuid primary key default gen_random_uuid(),
  orden_id           uuid not null references public.ordenes_compra (id) on delete cascade,
  producto_id        uuid not null references public.productos (id) on delete restrict,
  cantidad           numeric(14,3) not null check (cantidad > 0),
  cantidad_recibida  numeric(14,3) not null default 0 check (cantidad_recibida >= 0),
  costo_unitario     numeric(14,4) not null check (costo_unitario >= 0),
  unique (orden_id, producto_id)
);

-- ---------- Llegadas (entrada de producto) ----------
create table public.llegadas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas (id) on delete cascade,
  numero           integer not null,
  almacen_id       uuid not null references public.almacenes (id) on delete restrict,
  proveedor_id     uuid references public.terceros (id) on delete restrict,
  orden_id         uuid references public.ordenes_compra (id) on delete restrict,
  guia_remision    text,
  comprobante      text,
  fecha            timestamptz not null default now(),
  notas            text,
  creado_por       uuid references auth.users (id) on delete set null default auth.uid(),
  unique (empresa_id, numero)
);

-- ---------- Salidas (despachos) ----------
create table public.salidas (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas (id) on delete cascade,
  numero             integer not null,
  almacen_id         uuid not null references public.almacenes (id) on delete restrict,
  motivo             public.motivo_salida not null,
  almacen_destino_id uuid references public.almacenes (id) on delete restrict,
  destino            text,           -- cliente, obra o equipo atendido
  responsable        text,           -- técnico que retira
  referencia         text,           -- N° de orden de servicio, guía, etc.
  fecha              timestamptz not null default now(),
  notas              text,
  creado_por         uuid references auth.users (id) on delete set null default auth.uid(),
  unique (empresa_id, numero),
  check (motivo <> 'transferencia' or (almacen_destino_id is not null and almacen_destino_id <> almacen_id))
);

-- ---------- Kardex (cada movimiento de stock) ----------
create table public.movimientos (
  id              bigint generated always as identity primary key,
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  producto_id     uuid not null references public.productos (id) on delete restrict,
  almacen_id      uuid not null references public.almacenes (id) on delete restrict,
  tipo            public.tipo_movimiento not null,
  cantidad        numeric(14,3) not null check (cantidad > 0),
  costo_unitario  numeric(14,4) not null default 0,
  saldo           numeric(14,3) not null,  -- stock del almacén DESPUÉS del movimiento
  llegada_id      uuid references public.llegadas (id) on delete restrict,
  salida_id       uuid references public.salidas (id) on delete restrict,
  fecha           timestamptz not null default now(),
  creado_por      uuid references auth.users (id) on delete set null default auth.uid(),
  check ((llegada_id is null) <> (salida_id is null))
);
create index movimientos_producto_idx on public.movimientos (empresa_id, producto_id, fecha desc);
create index movimientos_fecha_idx on public.movimientos (empresa_id, fecha desc);
create index movimientos_llegada_idx on public.movimientos (llegada_id);
create index movimientos_salida_idx on public.movimientos (salida_id);

-- ---------- RLS ----------
alter table public.terceros enable row level security;
alter table public.almacenes enable row level security;
alter table public.productos enable row level security;
alter table public.stock enable row level security;
alter table public.ordenes_compra enable row level security;
alter table public.ordenes_compra_items enable row level security;
alter table public.llegadas enable row level security;
alter table public.salidas enable row level security;
alter table public.movimientos enable row level security;

-- Terceros: los ve toda la empresa (contabilidad y ventas también los usan);
-- los gestionan logística y administración.
create policy terceros_ver on public.terceros for select to authenticated
  using (public.es_miembro(empresa_id));
create policy terceros_crear on public.terceros for insert to authenticated
  with check (public.es_logistica(empresa_id) or public.tiene_area(empresa_id, 'administracion'));
create policy terceros_editar on public.terceros for update to authenticated
  using (public.es_logistica(empresa_id) or public.tiene_area(empresa_id, 'administracion'))
  with check (public.es_logistica(empresa_id) or public.tiene_area(empresa_id, 'administracion'));

-- Catálogos de logística: ver y editar con el área logística.
create policy almacenes_ver on public.almacenes for select to authenticated using (public.es_logistica(empresa_id));
create policy almacenes_crear on public.almacenes for insert to authenticated with check (public.es_logistica(empresa_id));
create policy almacenes_editar on public.almacenes for update to authenticated
  using (public.es_logistica(empresa_id)) with check (public.es_logistica(empresa_id));

create policy productos_ver on public.productos for select to authenticated using (public.es_logistica(empresa_id));
create policy productos_crear on public.productos for insert to authenticated with check (public.es_logistica(empresa_id));
create policy productos_editar on public.productos for update to authenticated
  using (public.es_logistica(empresa_id)) with check (public.es_logistica(empresa_id));

-- Stock, kardex, llegadas y salidas: solo lectura directa (se escriben por RPC).
create policy stock_ver on public.stock for select to authenticated using (public.es_logistica(empresa_id));
create policy movimientos_ver on public.movimientos for select to authenticated using (public.es_logistica(empresa_id));
create policy llegadas_ver on public.llegadas for select to authenticated using (public.es_logistica(empresa_id));
create policy salidas_ver on public.salidas for select to authenticated using (public.es_logistica(empresa_id));

-- Órdenes de compra: lectura directa; se crean y cambian de estado por RPC.
create policy oc_ver on public.ordenes_compra for select to authenticated using (public.es_logistica(empresa_id));
create policy oc_items_ver on public.ordenes_compra_items for select to authenticated
  using (exists (select 1 from public.ordenes_compra o where o.id = orden_id and public.es_logistica(o.empresa_id)));

-- ---------- Utilidad: siguiente correlativo por empresa ----------
-- Bloquea por (empresa, tabla) con un advisory lock de la transacción para
-- que dos usuarios no saquen el mismo número a la vez.
create or replace function public.siguiente_numero(p_empresa uuid, p_tabla text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_empresa::text || p_tabla));
  execute format('select coalesce(max(numero), 0) + 1 from public.%I where empresa_id = $1', p_tabla)
    into v_n using p_empresa;
  return v_n;
end $$;

-- ---------- RPC: crear orden de compra ----------
-- p_datos = { proveedorId, almacenId, fechaEntrega?, notas?, enviar?: bool,
--             items: [{ productoId, cantidad, costoUnitario }] }
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

  insert into public.ordenes_compra (empresa_id, numero, proveedor_id, almacen_id, estado, fecha_entrega, notas)
  values (
    p_empresa,
    public.siguiente_numero(p_empresa, 'ordenes_compra'),
    (p_datos ->> 'proveedorId')::uuid,
    (p_datos ->> 'almacenId')::uuid,
    case when coalesce((p_datos ->> 'enviar')::boolean, false) then 'enviada'::public.estado_oc else 'borrador'::public.estado_oc end,
    nullif(p_datos ->> 'fechaEntrega', '')::date,
    nullif(trim(p_datos ->> 'notas'), '')
  ) returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_datos -> 'items') loop
    if not exists (select 1 from public.productos p where p.id = (v_item ->> 'productoId')::uuid
                   and p.empresa_id = p_empresa) then
      raise exception 'Producto no válido en la orden';
    end if;
    insert into public.ordenes_compra_items (orden_id, producto_id, cantidad, costo_unitario)
    values (v_id, (v_item ->> 'productoId')::uuid, (v_item ->> 'cantidad')::numeric, (v_item ->> 'costoUnitario')::numeric);
  end loop;
  return v_id;
end $$;

-- ---------- RPC: cambiar estado de una OC (enviar / anular) ----------
create or replace function public.cambiar_estado_oc(p_empresa uuid, p_orden uuid, p_estado public.estado_oc)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actual public.estado_oc;
begin
  if not public.es_logistica(p_empresa) then
    raise exception 'No tienes acceso a logística' using errcode = '42501';
  end if;
  select estado into v_actual from public.ordenes_compra
  where id = p_orden and empresa_id = p_empresa for update;
  if v_actual is null then
    raise exception 'Orden no encontrada';
  end if;
  if p_estado = 'enviada' and v_actual <> 'borrador' then
    raise exception 'Solo se envía una orden en borrador';
  elsif p_estado = 'anulada' and v_actual not in ('borrador', 'enviada') then
    raise exception 'No se puede anular: ya tiene productos recibidos';
  elsif p_estado not in ('enviada', 'anulada') then
    raise exception 'Ese estado lo pone el sistema al registrar llegadas';
  end if;
  update public.ordenes_compra set estado = p_estado where id = p_orden;
end $$;

-- ---------- Interno: sumar al stock (bloquea la fila) ----------
create or replace function public._stock_sumar(p_empresa uuid, p_producto uuid, p_almacen uuid, p_delta numeric)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_saldo numeric;
  v_nombre text;
begin
  insert into public.stock (empresa_id, producto_id, almacen_id, cantidad)
  values (p_empresa, p_producto, p_almacen, 0)
  on conflict (producto_id, almacen_id) do nothing;

  select cantidad into v_saldo from public.stock
  where producto_id = p_producto and almacen_id = p_almacen for update;

  if v_saldo + p_delta < 0 then
    select nombre into v_nombre from public.productos where id = p_producto;
    raise exception 'Stock insuficiente de "%": hay % y se pidió %', v_nombre, v_saldo, -p_delta;
  end if;

  update public.stock set cantidad = v_saldo + p_delta, actualizado_en = now()
  where producto_id = p_producto and almacen_id = p_almacen;
  return v_saldo + p_delta;
end $$;

-- ---------- RPC: registrar LLEGADA de producto ----------
-- p_datos = { almacenId, proveedorId?, ordenId?, guiaRemision?, comprobante?, notas?,
--             items: [{ productoId, cantidad, costoUnitario }] }
-- · Suma stock y escribe el kardex.
-- · Recalcula el costo promedio ponderado del producto (sobre el stock total).
-- · Si viene de una OC: suma lo recibido y la marca 'parcial' o 'recibida'.
create or replace function public.registrar_llegada(p_empresa uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id      uuid;
  v_orden   uuid := nullif(p_datos ->> 'ordenId', '')::uuid;
  v_almacen uuid := (p_datos ->> 'almacenId')::uuid;
  v_prov    uuid := nullif(p_datos ->> 'proveedorId', '')::uuid;
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

  insert into public.llegadas (empresa_id, numero, almacen_id, proveedor_id, orden_id, guia_remision, comprobante, notas)
  values (
    p_empresa, public.siguiente_numero(p_empresa, 'llegadas'), v_almacen, v_prov, v_orden,
    nullif(trim(p_datos ->> 'guiaRemision'), ''), nullif(trim(p_datos ->> 'comprobante'), ''),
    nullif(trim(p_datos ->> 'notas'), '')
  ) returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_datos -> 'items') loop
    v_prod  := (v_item ->> 'productoId')::uuid;
    v_cant  := (v_item ->> 'cantidad')::numeric;
    v_costo := coalesce((v_item ->> 'costoUnitario')::numeric, 0);
    if v_cant is null or v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    if not exists (select 1 from public.productos p where p.id = v_prod and p.empresa_id = p_empresa) then
      raise exception 'Producto no válido';
    end if;

    -- Costo promedio ponderado con el stock de TODOS los almacenes, antes de sumar
    select coalesce(sum(s.cantidad), 0) into v_total from public.stock s where s.producto_id = v_prod;
    update public.productos p
    set costo_promedio = case when v_total + v_cant = 0 then v_costo
                              else round((p.costo_promedio * v_total + v_costo * v_cant) / (v_total + v_cant), 4) end
    where p.id = v_prod;

    v_saldo := public._stock_sumar(p_empresa, v_prod, v_almacen, v_cant);
    insert into public.movimientos (empresa_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, saldo, llegada_id)
    values (p_empresa, v_prod, v_almacen, 'entrada', v_cant, v_costo, v_saldo, v_id);

    if v_orden is not null then
      update public.ordenes_compra_items set cantidad_recibida = cantidad_recibida + v_cant
      where orden_id = v_orden and producto_id = v_prod;
      if not found then
        raise exception 'Un producto recibido no está en la orden de compra';
      end if;
    end if;
  end loop;

  if v_orden is not null then
    update public.ordenes_compra o
    set estado = case when exists (select 1 from public.ordenes_compra_items i
                                   where i.orden_id = o.id and i.cantidad_recibida < i.cantidad)
                      then 'parcial'::public.estado_oc else 'recibida'::public.estado_oc end
    where o.id = v_orden;
  end if;
  return v_id;
end $$;

-- ---------- RPC: registrar SALIDA de producto ----------
-- p_datos = { almacenId, motivo, almacenDestinoId?, destino?, responsable?, referencia?, notas?,
--             items: [{ productoId, cantidad }] }
-- · Valida stock (no deja negativos), resta y escribe el kardex al costo promedio.
-- · Transferencia: además suma en el almacén destino.
create or replace function public.registrar_salida(p_empresa uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id      uuid;
  v_almacen uuid := (p_datos ->> 'almacenId')::uuid;
  v_destino uuid := nullif(p_datos ->> 'almacenDestinoId', '')::uuid;
  v_motivo  public.motivo_salida := (p_datos ->> 'motivo')::public.motivo_salida;
  v_item    jsonb;
  v_prod    uuid;
  v_cant    numeric;
  v_costo   numeric;
  v_saldo   numeric;
begin
  if not public.es_logistica(p_empresa) then
    raise exception 'No tienes acceso a logística' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_datos -> 'items', '[]')) = 0 then
    raise exception 'Registra al menos un producto';
  end if;
  if not exists (select 1 from public.almacenes a where a.id = v_almacen and a.empresa_id = p_empresa and a.activo) then
    raise exception 'Almacén no válido';
  end if;
  if v_motivo = 'transferencia' and not exists (
    select 1 from public.almacenes a where a.id = v_destino and a.empresa_id = p_empresa and a.activo and a.id <> v_almacen
  ) then
    raise exception 'Elige un almacén destino distinto al de origen';
  end if;

  insert into public.salidas (empresa_id, numero, almacen_id, motivo, almacen_destino_id, destino, responsable, referencia, notas)
  values (
    p_empresa, public.siguiente_numero(p_empresa, 'salidas'), v_almacen, v_motivo,
    case when v_motivo = 'transferencia' then v_destino end,
    nullif(trim(p_datos ->> 'destino'), ''), nullif(trim(p_datos ->> 'responsable'), ''),
    nullif(trim(p_datos ->> 'referencia'), ''), nullif(trim(p_datos ->> 'notas'), '')
  ) returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_datos -> 'items') loop
    v_prod := (v_item ->> 'productoId')::uuid;
    v_cant := (v_item ->> 'cantidad')::numeric;
    if v_cant is null or v_cant <= 0 then raise exception 'Cantidad inválida'; end if;
    select costo_promedio into v_costo from public.productos where id = v_prod and empresa_id = p_empresa;
    if v_costo is null then raise exception 'Producto no válido'; end if;

    v_saldo := public._stock_sumar(p_empresa, v_prod, v_almacen, -v_cant);
    insert into public.movimientos (empresa_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, saldo, salida_id)
    values (p_empresa, v_prod, v_almacen, 'salida', v_cant, v_costo, v_saldo, v_id);

    if v_motivo = 'transferencia' then
      v_saldo := public._stock_sumar(p_empresa, v_prod, v_destino, v_cant);
      insert into public.movimientos (empresa_id, producto_id, almacen_id, tipo, cantidad, costo_unitario, saldo, salida_id)
      values (p_empresa, v_prod, v_destino, 'entrada', v_cant, v_costo, v_saldo, v_id);
    end if;
  end loop;
  return v_id;
end $$;

-- ---------- RPC: resumen del panel de logística ----------
create or replace function public.resumen_logistica(p_empresa uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v jsonb;
begin
  if not public.es_logistica(p_empresa) then
    raise exception 'No tienes acceso a logística' using errcode = '42501';
  end if;

  with totales as (
    select p.id, p.stock_minimo, p.costo_promedio, coalesce(sum(s.cantidad), 0) as cantidad
    from public.productos p
    left join public.stock s on s.producto_id = p.id
    where p.empresa_id = p_empresa and p.activo
    group by p.id
  ),
  dias as (
    select d::date as dia from generate_series(current_date - 13, current_date, interval '1 day') d
  ),
  mov as (
    select m.fecha::date as dia, m.tipo, sum(m.cantidad * m.costo_unitario) as valor
    from public.movimientos m
    where m.empresa_id = p_empresa and m.fecha >= current_date - 13
      and not (m.tipo = 'entrada' and m.salida_id is not null)  -- las transferencias no cuentan como compra
      and not (m.tipo = 'salida' and exists (select 1 from public.salidas s where s.id = m.salida_id and s.motivo = 'transferencia'))
    group by 1, 2
  )
  select jsonb_build_object(
    'valorInventario', coalesce((select sum(cantidad * costo_promedio) from totales), 0),
    'productosActivos', (select count(*) from totales),
    'bajoMinimo', (select count(*) from totales where cantidad <= stock_minimo and stock_minimo > 0),
    'sinStock', (select count(*) from totales where cantidad = 0),
    'ocPendientes', (select count(*) from public.ordenes_compra where empresa_id = p_empresa and estado in ('enviada', 'parcial')),
    'ocPorRecibirValor', coalesce((
      select sum((i.cantidad - i.cantidad_recibida) * i.costo_unitario)
      from public.ordenes_compra o join public.ordenes_compra_items i on i.orden_id = o.id
      where o.empresa_id = p_empresa and o.estado in ('enviada', 'parcial')), 0),
    'llegadasMes', (select count(*) from public.llegadas where empresa_id = p_empresa and fecha >= date_trunc('month', now())),
    'salidasMes', (select count(*) from public.salidas where empresa_id = p_empresa and fecha >= date_trunc('month', now())),
    'flujo', (
      select jsonb_agg(jsonb_build_object(
        'dia', d.dia,
        'entradas', coalesce((select valor from mov where mov.dia = d.dia and tipo = 'entrada'), 0),
        'salidas', coalesce((select valor from mov where mov.dia = d.dia and tipo = 'salida'), 0)
      ) order by d.dia) from dias d
    ),
    'porTipo', (
      select coalesce(jsonb_agg(jsonb_build_object('tipo', x.tipo, 'valor', x.valor) order by x.valor desc), '[]')
      from (select p.tipo, sum(t.cantidad * t.costo_promedio) as valor
            from totales t join public.productos p on p.id = t.id group by p.tipo) x
    )
  ) into v;
  return v;
end $$;

-- ---------- Permisos ----------
revoke all on public.terceros, public.almacenes, public.productos, public.stock, public.ordenes_compra,
  public.ordenes_compra_items, public.llegadas, public.salidas, public.movimientos from anon;
grant select, insert, update on public.terceros, public.almacenes, public.productos to authenticated;
grant select on public.stock, public.ordenes_compra, public.ordenes_compra_items,
  public.llegadas, public.salidas, public.movimientos to authenticated;

revoke execute on function public.es_logistica(uuid), public.siguiente_numero(uuid, text),
  public._stock_sumar(uuid, uuid, uuid, numeric), public.crear_orden_compra(uuid, jsonb),
  public.cambiar_estado_oc(uuid, uuid, public.estado_oc), public.registrar_llegada(uuid, jsonb),
  public.registrar_salida(uuid, jsonb), public.resumen_logistica(uuid) from public, anon;
-- Internas: nadie las llama directo
revoke execute on function public.siguiente_numero(uuid, text), public._stock_sumar(uuid, uuid, uuid, numeric) from authenticated;
grant execute on function public.es_logistica(uuid), public.crear_orden_compra(uuid, jsonb),
  public.cambiar_estado_oc(uuid, uuid, public.estado_oc), public.registrar_llegada(uuid, jsonb),
  public.registrar_salida(uuid, jsonb), public.resumen_logistica(uuid) to authenticated;

-- #####################################################################
-- ## migrations/20261121000001_logistica_plazos_crud.sql
-- #####################################################################

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

-- #####################################################################
-- ## migrations/20261122000001_accesos_solo_dueno.sql
-- #####################################################################

-- =====================================================================
-- COLDWORK ERP · Migración 0005 · Solo el dueño (CEO) da accesos
-- ---------------------------------------------------------------------
-- Antes: dueño y admin gestionaban el equipo (un admin podía invitar
-- trabajadores y cambiar sus áreas).
-- Ahora: SOLO EL DUEÑO invita, cambia áreas, bloquea o quita personas.
-- Nadie más puede darse ni dar acceso a otra área (p. ej. el encargado
-- de logística no puede abrirse Contabilidad ni dársela a otro).
-- Las invitaciones se siguen aceptando solas (aceptar_invitaciones es
-- security definer y solo usa lo que el dueño dejó preparado).
-- =====================================================================

-- ---------- Invitaciones: solo el dueño ----------
drop policy invitaciones_ver on public.invitaciones;
drop policy invitaciones_crear on public.invitaciones;
drop policy invitaciones_editar on public.invitaciones;
drop policy invitaciones_borrar on public.invitaciones;

create policy invitaciones_ver on public.invitaciones for select to authenticated
  using (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]));
create policy invitaciones_crear on public.invitaciones for insert to authenticated
  with check (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]));
create policy invitaciones_editar on public.invitaciones for update to authenticated
  using (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]))
  with check (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]));
create policy invitaciones_borrar on public.invitaciones for delete to authenticated
  using (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]));

-- ---------- Miembros: los ve la empresa, los gestiona solo el dueño ----------
drop policy miembros_crear on public.miembros;
drop policy miembros_editar on public.miembros;
drop policy miembros_borrar on public.miembros;

create policy miembros_crear on public.miembros for insert to authenticated
  with check (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]) and rol <> 'dueno');
create policy miembros_editar on public.miembros for update to authenticated
  using (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]) and rol <> 'dueno')
  with check (public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[]) and rol <> 'dueno');
create policy miembros_borrar on public.miembros for delete to authenticated
  using (
    usuario_id <> (select auth.uid())
    and rol <> 'dueno'
    and public.tiene_rol(empresa_id, array['dueno']::public.rol_empresa[])
  );

-- ---------- Lista del equipo (nombres y correos): solo el dueño ----------
create or replace function public.equipo_empresa(p_empresa uuid)
returns table (
  usuario_id uuid, nombre text, correo text, rol public.rol_empresa,
  areas public.area_empresa[], activo boolean, creado_en timestamptz
)
language sql stable security definer set search_path = '' as $$
  select m.usuario_id, coalesce(p.nombre, ''), u.email::text, m.rol, m.areas, m.activo, m.creado_en
  from public.miembros m
  join auth.users u on u.id = m.usuario_id
  left join public.perfiles p on p.id = m.usuario_id
  where m.empresa_id = p_empresa
    and public.tiene_rol(p_empresa, array['dueno']::public.rol_empresa[])
  order by (m.rol = 'dueno') desc, m.creado_en;
$$;

-- #####################################################################
-- ## migrations/20261123000001_oc_formato_y_moneda.sql
-- #####################################################################

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

commit;
