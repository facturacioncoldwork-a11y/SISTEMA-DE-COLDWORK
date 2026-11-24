-- =====================================================================
-- Finanzas: clientes y proveedores, ventas, compras, caja y bancos,
-- cuentas por cobrar y por pagar — integradas con Contabilidad
-- =====================================================================
-- Cada documento genera SOLO su asiento contable (origen ventas, compras o caja),
-- en soles, ya registrado y marcado como "automático": no se edita ni se anula desde
-- Contabilidad, sino anulando el documento que lo originó (trazabilidad para SUNAT).
--
-- Escritura SOLO por funciones (RPC) que validan: IGV 18 %, totales, tipo de cambio,
-- duplicados, saldos, detracciones y permisos por área.
-- =====================================================================

-- ---------- Ayudante: ¿tiene alguna de estas áreas? (dueño y admin: todas) ----------
create or replace function public.fin_tiene_alguna(p_empresa uuid, p_areas public.area_empresa[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros m
    where m.empresa_id = p_empresa and m.usuario_id = (select auth.uid()) and m.activo
      and (m.rol in ('dueno', 'admin') or m.areas && p_areas)
  );
$$;

-- ---------- Clientes y proveedores (tabla de Logística, ahora compartida) ----------
create policy terceros_ver_finanzas on public.terceros for select to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{administracion,ventas,finanzas,contabilidad}'));
create policy terceros_crear_finanzas on public.terceros for insert to authenticated
  with check (public.fin_tiene_alguna(empresa_id, '{administracion,ventas,finanzas,contabilidad}'));
create policy terceros_editar_finanzas on public.terceros for update to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{administracion,ventas,finanzas,contabilidad}'))
  with check (public.fin_tiene_alguna(empresa_id, '{administracion,ventas,finanzas,contabilidad}'));
create policy terceros_borrar_finanzas on public.terceros for delete to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{administracion}'));

-- ---------- Asientos automáticos ----------
alter table public.conta_asientos add column automatico boolean not null default false;

-- ---------- Cuentas de caja y bancos ----------
create table public.fin_cuentas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas (id) on delete cascade,
  nombre           text not null check (length(trim(nombre)) between 2 and 80),
  tipo             text not null check (tipo in ('caja', 'banco', 'detracciones')),
  banco            text,
  numero           text,
  moneda           text not null default 'PEN' check (moneda in ('PEN', 'USD')),
  cuenta_contable  text not null check (cuenta_contable ~ '^10\d{1,6}$'),
  activa           boolean not null default true,
  creado_en        timestamptz not null default now(),
  unique (empresa_id, nombre)
);

-- ---------- Comprobantes de venta y de compra ----------
create table public.fin_comprobantes (
  id                     uuid primary key default gen_random_uuid(),
  empresa_id             uuid not null references public.empresas (id) on delete cascade,
  operacion              text not null check (operacion in ('venta', 'compra')),
  tercero_id             uuid not null references public.terceros (id) on delete restrict,
  tipo_doc               text not null check (tipo_doc in ('01', '03', '07', '08', '02', '12', '14', '00')),
  serie                  text not null check (serie ~ '^[A-Z0-9]{1,4}$'),
  numero                 text not null check (numero ~ '^\d{1,10}$'),
  fecha_emision          date not null,
  fecha_vencimiento      date not null,
  moneda                 text not null default 'PEN' check (moneda in ('PEN', 'USD')),
  tipo_cambio            numeric(10, 3) check (tipo_cambio is null or tipo_cambio > 0),
  base_gravada           numeric(14, 2) not null default 0 check (base_gravada >= 0),
  no_gravada             numeric(14, 2) not null default 0 check (no_gravada >= 0),
  igv                    numeric(14, 2) not null default 0 check (igv >= 0),
  total                  numeric(14, 2) not null check (total > 0),
  retencion_renta        numeric(14, 2) not null default 0 check (retencion_renta >= 0),
  detraccion_porcentaje  numeric(5, 2) not null default 0 check (detraccion_porcentaje between 0 and 100),
  detraccion_monto       numeric(14, 2) not null default 0 check (detraccion_monto >= 0),
  cuenta_contable        text not null check (cuenta_contable ~ '^\d{3,8}$'),
  glosa                  text,
  referencia_id          uuid references public.fin_comprobantes (id) on delete restrict,
  estado                 text not null default 'registrado' check (estado in ('registrado', 'anulado')),
  motivo_anulacion       text,
  asiento_id             uuid references public.conta_asientos (id) on delete set null,
  creado_por             uuid references auth.users (id) on delete set null,
  creado_por_nombre      text,
  creado_en              timestamptz not null default now(),
  check (fecha_vencimiento >= fecha_emision),
  check (total = base_gravada + no_gravada + igv),
  check (moneda = 'PEN' or tipo_cambio is not null),
  unique (empresa_id, operacion, tercero_id, tipo_doc, serie, numero)
);
-- En ventas la serie es propia: no se repite aunque cambie el cliente
create unique index fin_ventas_unicas on public.fin_comprobantes (empresa_id, tipo_doc, serie, numero)
  where operacion = 'venta';
create index fin_comprobantes_periodo on public.fin_comprobantes (empresa_id, operacion, fecha_emision);
create index fin_comprobantes_tercero on public.fin_comprobantes (tercero_id);

-- ---------- Movimientos de caja y bancos ----------
create table public.fin_movimientos (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas (id) on delete cascade,
  cuenta_id          uuid not null references public.fin_cuentas (id) on delete restrict,
  fecha              date not null,
  tipo               text not null check (tipo in ('cobro', 'pago', 'ingreso', 'egreso', 'transferencia')),
  comprobante_id     uuid references public.fin_comprobantes (id) on delete restrict,
  cuenta_destino_id  uuid references public.fin_cuentas (id) on delete restrict,
  contrapartida      text check (contrapartida is null or contrapartida ~ '^\d{3,8}$'),
  monto              numeric(14, 2) not null check (monto > 0),
  tipo_cambio        numeric(10, 3) check (tipo_cambio is null or tipo_cambio > 0),
  medio              text not null default 'transferencia'
                       check (medio in ('efectivo', 'transferencia', 'deposito', 'cheque', 'tarjeta', 'yape_plin', 'otro')),
  referencia         text,
  glosa              text,
  estado             text not null default 'registrado' check (estado in ('registrado', 'anulado')),
  asiento_id         uuid references public.conta_asientos (id) on delete set null,
  creado_por         uuid references auth.users (id) on delete set null,
  creado_por_nombre  text,
  creado_en          timestamptz not null default now()
);
create index fin_movimientos_cuenta on public.fin_movimientos (cuenta_id, fecha);
create index fin_movimientos_destino on public.fin_movimientos (cuenta_destino_id) where cuenta_destino_id is not null;
create index fin_movimientos_comprobante on public.fin_movimientos (comprobante_id) where comprobante_id is not null;
create index fin_movimientos_empresa on public.fin_movimientos (empresa_id, fecha);

-- ---------- Vistas de saldos (respetan RLS de quien consulta) ----------

/** Cuánto falta cobrar o pagar de cada comprobante. */
create view public.fin_saldos_comprobantes with (security_invoker = true) as
select
  c.id,
  c.empresa_id,
  coalesce((select sum(m.monto) from public.fin_movimientos m
            where m.comprobante_id = c.id and m.estado = 'registrado'), 0) as pagado,
  coalesce((select sum(n.total) from public.fin_comprobantes n
            where n.referencia_id = c.id and n.tipo_doc = '07' and n.estado = 'registrado'), 0) as notas_credito,
  case
    when c.estado = 'anulado' or c.tipo_doc = '07' then 0
    else greatest(c.total - c.retencion_renta
      - coalesce((select sum(m.monto) from public.fin_movimientos m
                  where m.comprobante_id = c.id and m.estado = 'registrado'), 0)
      - coalesce((select sum(n.total) from public.fin_comprobantes n
                  where n.referencia_id = c.id and n.tipo_doc = '07' and n.estado = 'registrado'), 0), 0)
  end as pendiente
from public.fin_comprobantes c;

/** Comprobante con su cliente/proveedor y su saldo (lo que lee la API). */
create view public.fin_comprobantes_detalle with (security_invoker = true) as
select
  c.*,
  t.razon_social      as tercero_nombre,
  t.tipo_documento    as tercero_tipo_documento,
  t.numero_documento  as tercero_documento,
  s.pagado,
  s.notas_credito,
  s.pendiente
from public.fin_comprobantes c
join public.terceros t on t.id = c.tercero_id
join public.fin_saldos_comprobantes s on s.id = c.id;

/** Saldo de cada cuenta de caja o banco (con los datos de la cuenta). */
create view public.fin_saldos_cuentas with (security_invoker = true) as
select
  cta.id,
  cta.empresa_id,
  cta.nombre,
  cta.tipo,
  cta.banco,
  cta.numero,
  cta.moneda,
  cta.cuenta_contable,
  cta.activa,
  cta.creado_en,
  coalesce(sum(
    case
      when m.estado is distinct from 'registrado' then 0
      when m.cuenta_id = cta.id and m.tipo in ('cobro', 'ingreso') then m.monto
      when m.cuenta_id = cta.id and m.tipo in ('pago', 'egreso', 'transferencia') then -m.monto
      when m.cuenta_destino_id = cta.id and m.tipo = 'transferencia' then m.monto
      else 0
    end), 0)::numeric(14, 2) as saldo
from public.fin_cuentas cta
left join public.fin_movimientos m on m.cuenta_id = cta.id or m.cuenta_destino_id = cta.id
group by cta.id;

/** Movimiento con su cuenta, destino y documento (lo que lee la API). */
create view public.fin_movimientos_detalle with (security_invoker = true) as
select
  m.*,
  cta.nombre        as cuenta_nombre,
  cta.moneda        as moneda,
  dest.nombre       as cuenta_destino_nombre,
  c.tipo_doc        as comprobante_tipo_doc,
  c.serie           as comprobante_serie,
  c.numero          as comprobante_numero,
  t.razon_social    as tercero_nombre
from public.fin_movimientos m
join public.fin_cuentas cta on cta.id = m.cuenta_id
left join public.fin_cuentas dest on dest.id = m.cuenta_destino_id
left join public.fin_comprobantes c on c.id = m.comprobante_id
left join public.terceros t on t.id = c.tercero_id;

-- =====================================================================
-- Ayudante: crea un asiento automático ya registrado (partida doble exigida)
-- p_lineas: [{cuenta, debe, haber}] en soles; las líneas en cero se omiten.
-- =====================================================================
create or replace function public._conta_asiento_auto(
  p_empresa uuid, p_fecha date, p_origen text, p_glosa text, p_documento jsonb, p_lineas jsonb
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_periodo text := to_char(p_fecha, 'YYYY-MM');
  v_numero int;
  v_id uuid;
  v_lineas jsonb;
  v_debe numeric;
  v_haber numeric;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'cuenta', l ->> 'cuenta',
           'debe', round(coalesce((l ->> 'debe')::numeric, 0), 2),
           'haber', round(coalesce((l ->> 'haber')::numeric, 0), 2))), '[]'::jsonb),
         coalesce(sum(round(coalesce((l ->> 'debe')::numeric, 0), 2)), 0),
         coalesce(sum(round(coalesce((l ->> 'haber')::numeric, 0), 2)), 0)
    into v_lineas, v_debe, v_haber
  from jsonb_array_elements(p_lineas) l
  where round(coalesce((l ->> 'debe')::numeric, 0), 2) > 0 or round(coalesce((l ->> 'haber')::numeric, 0), 2) > 0;

  if v_debe = 0 or v_debe <> v_haber then
    raise exception 'El asiento automático no cuadra (Debe % / Haber %). Revisa los importes.', v_debe, v_haber;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_empresa::text || v_periodo, 0));
  select coalesce(max(a.numero), 0) + 1 into v_numero
  from public.conta_asientos a where a.empresa_id = p_empresa and a.periodo = v_periodo;

  insert into public.conta_asientos (
    empresa_id, numero, periodo, fecha, origen, glosa, moneda, documento, estado,
    creado_por, creado_por_nombre, registrado_por, automatico
  ) values (
    p_empresa, v_numero, v_periodo, p_fecha, p_origen, left(p_glosa, 300), 'PEN', p_documento, 'registrado',
    (select auth.uid()), public._conta_nombre(), (select auth.uid()), true
  ) returning id into v_id;

  perform public._conta_poner_lineas(p_empresa, v_id, v_lineas);
  perform public._conta_anotar(p_empresa, v_id, v_numero, left(p_glosa, 300), 'registro');
  return v_id;
end;
$$;

/** Anula el asiento automático de un documento anulado (queda en el libro, como pide el PLE). */
create or replace function public._conta_anular_auto(p_empresa uuid, p_asiento uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.conta_asientos;
begin
  select * into v from public.conta_asientos a where a.id = p_asiento and a.empresa_id = p_empresa;
  if not found or v.estado = 'anulado' then
    return;
  end if;
  update public.conta_asientos set estado = 'anulado', observacion = p_motivo, actualizado_en = now() where id = v.id;
  perform public._conta_anotar(p_empresa, v.id, v.numero, v.glosa, 'anulo', p_motivo);
end;
$$;

-- =====================================================================
-- Cuentas de caja y bancos
-- =====================================================================
create or replace function public.fin_guardar_cuenta(p_empresa uuid, p_id uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text := p_datos ->> 'tipo';
  v_cc text;
  v_id uuid;
begin
  if not public.fin_tiene_alguna(p_empresa, '{finanzas}') then
    raise exception 'No tienes acceso a caja y bancos' using errcode = '42501';
  end if;
  v_cc := coalesce(nullif(p_datos ->> 'cuentaContable', ''),
                   case v_tipo when 'caja' then '101' when 'detracciones' then '1042' else '1041' end);
  if v_tipo = 'detracciones' and coalesce(p_datos ->> 'moneda', 'PEN') <> 'PEN' then
    raise exception 'La cuenta de detracciones del Banco de la Nación es en soles.';
  end if;

  if p_id is null then
    insert into public.fin_cuentas (empresa_id, nombre, tipo, banco, numero, moneda, cuenta_contable, activa)
    values (p_empresa, trim(p_datos ->> 'nombre'), v_tipo, left(nullif(trim(coalesce(p_datos ->> 'banco', '')), ''), 60),
            left(nullif(trim(coalesce(p_datos ->> 'numero', '')), ''), 40), coalesce(p_datos ->> 'moneda', 'PEN'), v_cc,
            coalesce((p_datos ->> 'activa')::boolean, true))
    returning id into v_id;
  else
    update public.fin_cuentas set
      nombre = trim(p_datos ->> 'nombre'), banco = left(nullif(trim(coalesce(p_datos ->> 'banco', '')), ''), 60),
      numero = left(nullif(trim(coalesce(p_datos ->> 'numero', '')), ''), 40),
      activa = coalesce((p_datos ->> 'activa')::boolean, true)
    where id = p_id and empresa_id = p_empresa
    returning id into v_id;
    if v_id is null then
      raise exception 'La cuenta no existe.';
    end if;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Ya tienes una cuenta con ese nombre.';
end;
$$;

-- =====================================================================
-- Comprobantes (ventas y compras) → asiento automático
-- =====================================================================
create or replace function public.fin_registrar_comprobante(p_empresa uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_op text := p_datos ->> 'operacion';
  v_tipo text := p_datos ->> 'tipoDoc';
  v_moneda text := coalesce(p_datos ->> 'moneda', 'PEN');
  v_tc numeric := nullif(p_datos ->> 'tipoCambio', '')::numeric;
  v_f numeric;
  v_base numeric := round(coalesce((p_datos ->> 'baseGravada')::numeric, 0), 2);
  v_nograv numeric := round(coalesce((p_datos ->> 'noGravada')::numeric, 0), 2);
  v_igv numeric := round(coalesce((p_datos ->> 'igv')::numeric, 0), 2);
  v_ret numeric := round(coalesce((p_datos ->> 'retencionRenta')::numeric, 0), 2);
  v_detr_pct numeric := coalesce((p_datos ->> 'detraccionPorcentaje')::numeric, 0);
  v_total numeric;
  v_emision date := (p_datos ->> 'fechaEmision')::date;
  v_venc date := coalesce(nullif(p_datos ->> 'fechaVencimiento', '')::date, (p_datos ->> 'fechaEmision')::date);
  v_cc text := p_datos ->> 'cuentaContable';
  v_ter public.terceros;
  v_ref public.fin_comprobantes;
  v_serie text := upper(trim(p_datos ->> 'serie'));
  v_numero text := ltrim(trim(p_datos ->> 'numero'), '0');
  v_doc text;
  v_glosa text;
  v_lineas jsonb;
  v_cxp text;
  v_asiento uuid;
  v_id uuid;
  v_nc boolean := v_tipo = '07';
begin
  -- Permisos por operación
  if v_op = 'venta' and not public.fin_tiene_alguna(p_empresa, '{ventas,contabilidad}') then
    raise exception 'No tienes acceso a ventas' using errcode = '42501';
  elsif v_op = 'compra' and not public.fin_tiene_alguna(p_empresa, '{contabilidad,finanzas}') then
    raise exception 'No tienes acceso a compras' using errcode = '42501';
  elsif v_op not in ('venta', 'compra') then
    raise exception 'Operación no válida.';
  end if;

  -- Cliente o proveedor de la empresa
  select * into v_ter from public.terceros t where t.id = (p_datos ->> 'terceroId')::uuid and t.empresa_id = p_empresa;
  if not found then
    raise exception 'Elige un cliente o proveedor válido.';
  end if;
  if v_op = 'venta' and v_tipo = '01' and v_ter.tipo_documento <> 'RUC' then
    raise exception 'Una factura de venta necesita un cliente con RUC. Para personas usa boleta.';
  end if;

  -- Importes
  if v_numero = '' then v_numero := '0'; end if;
  v_total := v_base + v_nograv + v_igv;
  if v_total <= 0 then
    raise exception 'El comprobante no tiene importe.';
  end if;
  if abs(v_igv - round(v_base * 0.18, 2)) > 0.05 then
    raise exception 'El IGV debe ser el 18 %% de la base gravada (S/ %).', round(v_base * 0.18, 2);
  end if;
  if v_op = 'compra' and v_tipo in ('03', '12') and v_igv > 0 then
    raise exception 'Una boleta o ticket no da crédito fiscal: registra el total como no gravado.';
  end if;
  if v_tipo = '02' and v_igv > 0 then
    raise exception 'Un recibo por honorarios no lleva IGV.';
  end if;
  if v_ret > v_total then
    raise exception 'La retención no puede ser mayor que el total.';
  end if;
  if v_moneda = 'USD' and coalesce(v_tc, 0) <= 0 then
    raise exception 'Indica el tipo de cambio para comprobantes en dólares.';
  end if;
  v_f := case when v_moneda = 'USD' then v_tc else 1 end;
  if v_venc < v_emision then
    raise exception 'El vencimiento no puede ser antes de la emisión.';
  end if;

  -- Nota de crédito: a qué comprobante corrige
  if v_nc then
    select * into v_ref from public.fin_comprobantes c
      where c.id = nullif(p_datos ->> 'referenciaId', '')::uuid and c.empresa_id = p_empresa;
    if not found or v_ref.operacion <> v_op or v_ref.tercero_id <> v_ter.id or v_ref.estado <> 'registrado' then
      raise exception 'La nota de crédito debe referirse a un comprobante registrado del mismo cliente o proveedor.';
    end if;
    if v_total > (select s.pendiente from public.fin_saldos_comprobantes s where s.id = v_ref.id) + 0.005 then
      raise exception 'La nota de crédito supera lo pendiente del comprobante.';
    end if;
  end if;

  -- Cuenta contable coherente con la operación (también si llaman a la función directo, sin la API)
  if v_op = 'venta' and v_cc !~ '^7\d{1,7}$' then
    raise exception 'La venta va a una cuenta de ingresos (70 a 79).';
  elsif v_op = 'compra' and v_cc !~ '^[2-6]\d{1,7}$' then
    raise exception 'La compra va a una cuenta de existencias, activo o gasto (20 a 69).';
  end if;
  if v_tc is not null and (v_tc <= 0 or v_tc >= 100) then
    raise exception 'Tipo de cambio fuera de rango.';
  end if;

  v_doc := v_serie || '-' || v_numero;
  v_glosa := left(coalesce(nullif(trim(p_datos ->> 'glosa'), ''),
    case v_op when 'venta' then 'Venta ' else 'Compra ' end || v_doc || ' · ' || v_ter.razon_social), 300);
  v_cxp := case when v_tipo = '02' then '424' else '4212' end;

  -- Asiento en soles (Debe/Haber se invierten en una nota de crédito)
  if v_op = 'venta' then
    v_lineas := jsonb_build_array(
      jsonb_build_object('cuenta', '1212', 'debe', v_total * v_f, 'haber', 0),
      jsonb_build_object('cuenta', '40111', 'debe', 0, 'haber', v_igv * v_f),
      jsonb_build_object('cuenta', v_cc, 'debe', 0, 'haber', (v_base + v_nograv) * v_f));
  else
    v_lineas := jsonb_build_array(
      jsonb_build_object('cuenta', v_cc, 'debe', (v_base + v_nograv) * v_f, 'haber', 0),
      jsonb_build_object('cuenta', '40111', 'debe', v_igv * v_f, 'haber', 0),
      jsonb_build_object('cuenta', v_cxp, 'debe', 0, 'haber', (v_total - v_ret) * v_f),
      jsonb_build_object('cuenta', '40172', 'debe', 0, 'haber', v_ret * v_f));
  end if;
  if v_nc then
    select jsonb_agg(jsonb_build_object('cuenta', l ->> 'cuenta', 'debe', l -> 'haber', 'haber', l -> 'debe'))
      into v_lineas from jsonb_array_elements(v_lineas) l;
  end if;
  -- Las líneas en dólares redondeadas pueden diferir por céntimos: se cuadra en la cuenta por cobrar/pagar
  if v_f <> 1 then
    v_lineas := public._fin_cuadrar(v_lineas);
  end if;

  v_asiento := public._conta_asiento_auto(
    p_empresa, v_emision, case v_op when 'venta' then 'ventas' else 'compras' end, v_glosa,
    jsonb_build_object('tipo', v_tipo, 'serie', v_serie, 'numero', v_numero,
                       'documentoTercero', v_ter.numero_documento, 'nombreTercero', v_ter.razon_social),
    v_lineas);

  insert into public.fin_comprobantes (
    empresa_id, operacion, tercero_id, tipo_doc, serie, numero, fecha_emision, fecha_vencimiento, moneda,
    tipo_cambio, base_gravada, no_gravada, igv, total, retencion_renta, detraccion_porcentaje, detraccion_monto,
    cuenta_contable, glosa, referencia_id, asiento_id, creado_por, creado_por_nombre
  ) values (
    p_empresa, v_op, v_ter.id, v_tipo, v_serie, v_numero, v_emision, v_venc, v_moneda,
    case when v_moneda = 'USD' then v_tc end, v_base, v_nograv, v_igv, v_total, v_ret, v_detr_pct,
    -- detracción: siempre en soles y sin decimales (así la pide SUNAT)
    round(v_total * v_f * v_detr_pct / 100, 0), v_cc, v_glosa,
    case when v_nc then v_ref.id end, v_asiento,
    (select auth.uid()), public._conta_nombre()
  ) returning id into v_id;

  -- Quien recibe una venta queda marcado como cliente
  if v_op = 'venta' and not v_ter.es_cliente then
    update public.terceros set es_cliente = true where id = v_ter.id;
  end if;
  return v_id;
exception when unique_violation then
  raise exception 'Ese comprobante (%) ya está registrado.', v_doc;
end;
$$;

/** Ajusta la diferencia de céntimos del tipo de cambio en la última línea con importe. */
create or replace function public._fin_cuadrar(p_lineas jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_lineas jsonb := '[]'::jsonb;
  v_dif numeric;
  l jsonb;
  i int := 0;
  v_ultima int;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
           'cuenta', x ->> 'cuenta',
           'debe', round((x ->> 'debe')::numeric, 2),
           'haber', round((x ->> 'haber')::numeric, 2))), '[]'::jsonb)
    into v_lineas from jsonb_array_elements(p_lineas) x;
  select sum((x ->> 'debe')::numeric) - sum((x ->> 'haber')::numeric) into v_dif from jsonb_array_elements(v_lineas) x;
  if coalesce(v_dif, 0) = 0 then
    return v_lineas;
  end if;
  -- Se corrige en la línea del Haber o Debe más grande (cuenta por cobrar/pagar)
  for l in select * from jsonb_array_elements(v_lineas) loop
    if v_dif > 0 and (l ->> 'haber')::numeric > 0 then v_ultima := i; end if;
    if v_dif < 0 and (l ->> 'debe')::numeric > 0 then v_ultima := i; end if;
    i := i + 1;
  end loop;
  if v_dif > 0 then
    return jsonb_set(v_lineas, array[v_ultima::text, 'haber'],
                     to_jsonb((v_lineas -> v_ultima ->> 'haber')::numeric + v_dif));
  end if;
  return jsonb_set(v_lineas, array[v_ultima::text, 'debe'],
                   to_jsonb((v_lineas -> v_ultima ->> 'debe')::numeric - v_dif));
end;
$$;

/** Anula un comprobante (si no tiene cobros/pagos ni notas de crédito) y su asiento. */
create or replace function public.fin_anular_comprobante(p_empresa uuid, p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.fin_comprobantes;
begin
  select * into v from public.fin_comprobantes c where c.id = p_id and c.empresa_id = p_empresa for update;
  if not found then
    raise exception 'El comprobante no existe.';
  end if;
  if not public.fin_tiene_alguna(p_empresa,
       case v.operacion when 'venta' then '{ventas,contabilidad}'::public.area_empresa[]
                        else '{contabilidad,finanzas}'::public.area_empresa[] end) then
    raise exception 'No tienes permiso para anular este comprobante' using errcode = '42501';
  end if;
  if v.estado = 'anulado' then
    raise exception 'El comprobante ya está anulado.';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo de la anulación.';
  end if;
  if exists (select 1 from public.fin_movimientos m where m.comprobante_id = v.id and m.estado = 'registrado') then
    raise exception 'Tiene cobros o pagos registrados: anúlalos primero en Caja y bancos.';
  end if;
  if exists (select 1 from public.fin_comprobantes n where n.referencia_id = v.id and n.estado = 'registrado') then
    raise exception 'Tiene notas de crédito: anúlalas primero.';
  end if;
  update public.fin_comprobantes set estado = 'anulado', motivo_anulacion = left(trim(p_motivo), 300) where id = v.id;
  perform public._conta_anular_auto(p_empresa, v.asiento_id, left('Comprobante anulado: ' || trim(p_motivo), 300));
end;
$$;

-- =====================================================================
-- Movimientos de caja y bancos → asiento automático
-- =====================================================================
create or replace function public.fin_registrar_movimiento(p_empresa uuid, p_datos jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text := p_datos ->> 'tipo';
  v_monto numeric := round(coalesce((p_datos ->> 'monto')::numeric, 0), 2);
  v_fecha date := (p_datos ->> 'fecha')::date;
  v_cta public.fin_cuentas;
  v_dest public.fin_cuentas;
  v_comp public.fin_comprobantes;
  v_ter public.terceros;
  v_pend numeric;
  v_saldo numeric;
  v_tc numeric := nullif(p_datos ->> 'tipoCambio', '')::numeric;
  v_f numeric;
  v_contra text := nullif(trim(coalesce(p_datos ->> 'contrapartida', '')), '');
  v_glosa text;
  v_lineas jsonb;
  v_asiento uuid;
  v_id uuid;
begin
  if not public.fin_tiene_alguna(p_empresa, '{finanzas}') then
    raise exception 'No tienes acceso a caja y bancos' using errcode = '42501';
  end if;
  if v_monto <= 0 then
    raise exception 'Indica un monto mayor que cero.';
  end if;
  -- Bloquea la cuenta: dos pagos al mismo tiempo no pueden dejarla en negativo
  select * into v_cta from public.fin_cuentas c
    where c.id = (p_datos ->> 'cuentaId')::uuid and c.empresa_id = p_empresa and c.activa
    for update;
  if not found then
    raise exception 'Elige una cuenta de caja o banco activa.';
  end if;

  -- Tipo de cambio: obligatorio en cuentas en dólares
  if v_cta.moneda = 'USD' and coalesce(v_tc, 0) <= 0 then
    raise exception 'Indica el tipo de cambio del día para la cuenta en dólares.';
  end if;
  if v_tc is not null and v_tc >= 100 then
    raise exception 'Tipo de cambio fuera de rango.';
  end if;
  v_f := case when v_cta.moneda = 'USD' then v_tc else 1 end;

  -- Lo que sale no puede dejar la cuenta en negativo
  if v_tipo in ('pago', 'egreso', 'transferencia') then
    select s.saldo into v_saldo from public.fin_saldos_cuentas s where s.id = v_cta.id;
    if v_monto > coalesce(v_saldo, 0) + 0.005 then
      raise exception 'Saldo insuficiente en % (disponible %).', v_cta.nombre, coalesce(v_saldo, 0);
    end if;
  end if;

  case v_tipo
    when 'cobro', 'pago' then
      -- Bloquea el comprobante: dos cobros a la vez no pueden pasar de lo pendiente
      select * into v_comp from public.fin_comprobantes c
        where c.id = (p_datos ->> 'comprobanteId')::uuid and c.empresa_id = p_empresa
        for update;
      if not found or v_comp.estado <> 'registrado' or v_comp.tipo_doc = '07'
         or v_comp.operacion <> case v_tipo when 'cobro' then 'venta' else 'compra' end then
        raise exception 'Elige un comprobante pendiente válido.';
      end if;
      if v_comp.moneda <> v_cta.moneda then
        raise exception 'El comprobante es en % y la cuenta en %: usa una cuenta de la misma moneda.', v_comp.moneda, v_cta.moneda;
      end if;
      select s.pendiente into v_pend from public.fin_saldos_comprobantes s where s.id = v_comp.id;
      if v_monto > v_pend + 0.005 then
        raise exception 'El monto supera lo pendiente (%).', v_pend;
      end if;
      if v_cta.tipo = 'detracciones' and v_tipo = 'pago' then
        raise exception 'La cuenta de detracciones solo sirve para pagar tributos.';
      end if;
      select * into v_ter from public.terceros t where t.id = v_comp.tercero_id;
      v_glosa := coalesce(nullif(trim(p_datos ->> 'glosa'), ''),
        case v_tipo when 'cobro' then 'Cobro ' else 'Pago ' end || v_comp.serie || '-' || v_comp.numero
        || ' · ' || v_ter.razon_social || case when v_cta.tipo = 'detracciones' then ' (detracción)' else '' end);
      if v_tipo = 'cobro' then
        v_lineas := jsonb_build_array(
          jsonb_build_object('cuenta', v_cta.cuenta_contable, 'debe', v_monto * v_f, 'haber', 0),
          jsonb_build_object('cuenta', '1212', 'debe', 0, 'haber', v_monto * v_f));
      else
        v_lineas := jsonb_build_array(
          jsonb_build_object('cuenta', case when v_comp.tipo_doc = '02' then '424' else '4212' end,
                             'debe', v_monto * v_f, 'haber', 0),
          jsonb_build_object('cuenta', v_cta.cuenta_contable, 'debe', 0, 'haber', v_monto * v_f));
      end if;

    when 'ingreso', 'egreso' then
      if v_contra is null then
        raise exception 'Indica la cuenta contable de contrapartida (ej. 5011 capital, 6591 gastos menores).';
      end if;
      if v_cta.tipo = 'detracciones' and v_tipo = 'egreso' and v_contra !~ '^40' then
        raise exception 'De la cuenta de detracciones solo se pagan tributos (cuentas 40…).';
      end if;
      v_glosa := coalesce(nullif(trim(p_datos ->> 'glosa'), ''),
                          case v_tipo when 'ingreso' then 'Ingreso en ' else 'Egreso de ' end || v_cta.nombre);
      if v_tipo = 'ingreso' then
        v_lineas := jsonb_build_array(
          jsonb_build_object('cuenta', v_cta.cuenta_contable, 'debe', v_monto * v_f, 'haber', 0),
          jsonb_build_object('cuenta', v_contra, 'debe', 0, 'haber', v_monto * v_f));
      else
        v_lineas := jsonb_build_array(
          jsonb_build_object('cuenta', v_contra, 'debe', v_monto * v_f, 'haber', 0),
          jsonb_build_object('cuenta', v_cta.cuenta_contable, 'debe', 0, 'haber', v_monto * v_f));
      end if;

    when 'transferencia' then
      select * into v_dest from public.fin_cuentas c
        where c.id = (p_datos ->> 'cuentaDestinoId')::uuid and c.empresa_id = p_empresa and c.activa;
      if not found or v_dest.id = v_cta.id then
        raise exception 'Elige una cuenta de destino distinta.';
      end if;
      if v_dest.moneda <> v_cta.moneda then
        raise exception 'Las dos cuentas deben ser de la misma moneda.';
      end if;
      if v_cta.tipo = 'detracciones' then
        raise exception 'El dinero de detracciones solo se libera con autorización de SUNAT.';
      end if;
      v_glosa := coalesce(nullif(trim(p_datos ->> 'glosa'), ''), 'Transferencia de ' || v_cta.nombre || ' a ' || v_dest.nombre);
      v_lineas := jsonb_build_array(
        jsonb_build_object('cuenta', v_dest.cuenta_contable, 'debe', v_monto * v_f, 'haber', 0),
        jsonb_build_object('cuenta', v_cta.cuenta_contable, 'debe', 0, 'haber', v_monto * v_f));
    else
      raise exception 'Tipo de movimiento no válido.';
  end case;

  v_glosa := left(v_glosa, 300);
  if v_f <> 1 then
    v_lineas := public._fin_cuadrar(v_lineas);
  end if;
  v_asiento := public._conta_asiento_auto(p_empresa, v_fecha, 'caja', v_glosa, null, v_lineas);

  insert into public.fin_movimientos (
    empresa_id, cuenta_id, fecha, tipo, comprobante_id, cuenta_destino_id, contrapartida, monto, tipo_cambio,
    medio, referencia, glosa, asiento_id, creado_por, creado_por_nombre
  ) values (
    p_empresa, v_cta.id, v_fecha, v_tipo, v_comp.id, v_dest.id, v_contra, v_monto,
    case when v_cta.moneda = 'USD' then v_tc end, coalesce(p_datos ->> 'medio', 'transferencia'),
    left(nullif(trim(coalesce(p_datos ->> 'referencia', '')), ''), 60), v_glosa, v_asiento,
    (select auth.uid()), public._conta_nombre()
  ) returning id into v_id;
  return v_id;
end;
$$;

/** Anula un movimiento y su asiento (el dinero vuelve a la cuenta y la deuda queda pendiente). */
create or replace function public.fin_anular_movimiento(p_empresa uuid, p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.fin_movimientos;
  v_saldo numeric;
begin
  if not public.fin_tiene_alguna(p_empresa, '{finanzas}') then
    raise exception 'No tienes acceso a caja y bancos' using errcode = '42501';
  end if;
  select * into v from public.fin_movimientos m where m.id = p_id and m.empresa_id = p_empresa for update;
  if not found or v.estado = 'anulado' then
    raise exception 'El movimiento no existe o ya está anulado.';
  end if;
  -- Bloquea la cuenta que pierde el dinero al anular (misma regla que al registrar)
  perform 1 from public.fin_cuentas c
    where c.id = case when v.tipo = 'transferencia' then v.cuenta_destino_id else v.cuenta_id end
    for update;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Escribe el motivo de la anulación.';
  end if;
  -- Anular una entrada no puede dejar la cuenta en negativo
  if v.tipo in ('cobro', 'ingreso') then
    select s.saldo into v_saldo from public.fin_saldos_cuentas s where s.id = v.cuenta_id;
    if v.monto > coalesce(v_saldo, 0) + 0.005 then
      raise exception 'No se puede anular: la cuenta quedaría en negativo.';
    end if;
  elsif v.tipo = 'transferencia' then
    select s.saldo into v_saldo from public.fin_saldos_cuentas s where s.id = v.cuenta_destino_id;
    if v.monto > coalesce(v_saldo, 0) + 0.005 then
      raise exception 'No se puede anular: la cuenta de destino quedaría en negativo.';
    end if;
  end if;
  update public.fin_movimientos set estado = 'anulado' where id = v.id;
  perform public._conta_anular_auto(p_empresa, v.asiento_id, left('Movimiento anulado: ' || trim(p_motivo), 300));
end;
$$;

-- =====================================================================
-- Reportes: saldos por cuenta contable (solo asientos registrados)
-- =====================================================================
create or replace function public.conta_saldos(p_empresa uuid, p_desde date, p_hasta date)
returns table (cuenta text, debe numeric, haber numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.fin_tiene_alguna(p_empresa, '{contabilidad,finanzas}') then
    raise exception 'No tienes acceso a los reportes' using errcode = '42501';
  end if;
  return query
    select l.cuenta, sum(l.debe)::numeric, sum(l.haber)::numeric
    from public.conta_lineas l
    join public.conta_asientos a on a.id = l.asiento_id
    where a.empresa_id = p_empresa and a.estado = 'registrado'
      and (p_desde is null or a.fecha >= p_desde) and a.fecha <= p_hasta
    group by l.cuenta
    order by l.cuenta;
end;
$$;

-- =====================================================================
-- Contabilidad: un asiento automático no se edita ni se anula desde Contabilidad
-- (se anula el documento de origen). Misma función que antes + esa regla.
-- =====================================================================
create or replace function public.conta_cambiar_estado(
  p_empresa uuid, p_id uuid, p_accion text, p_comentario text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.conta_asientos;
  v_aprobador boolean;
  v_directo boolean;
  v_autor boolean;
  v_datos jsonb;
begin
  perform public._conta_exigir_acceso(p_empresa);
  select * into v from public.conta_asientos a where a.id = p_id and a.empresa_id = p_empresa for update;
  if not found then
    raise exception 'El asiento no existe.';
  end if;
  if v.automatico then
    raise exception 'Este asiento lo generó % : anula el documento de origen allí.',
      case v.origen when 'ventas' then 'Ventas' when 'compras' then 'Compras' else 'Caja y bancos' end;
  end if;

  v_aprobador := public.conta_es_aprobador(p_empresa);
  v_autor := v.creado_por = (select auth.uid());
  select c.contador_registra_directo into v_directo from public.conta_config c where c.empresa_id = p_empresa;

  select jsonb_build_object(
    'glosa', v.glosa, 'moneda', v.moneda, 'tipoCambio', v.tipo_cambio,
    'lineas', coalesce(jsonb_agg(jsonb_build_object('debe', l.debe, 'haber', l.haber)), '[]'::jsonb)
  ) into v_datos from public.conta_lineas l where l.asiento_id = v.id;

  case p_accion
    when 'enviar' then
      if v.estado not in ('borrador', 'observado') or not (v_autor or v_aprobador) then
        raise exception 'Este asiento no se puede enviar.';
      end if;
      perform public._conta_validar(v_datos);
      update public.conta_asientos set estado = 'por_aprobar', observacion = null, actualizado_en = now() where id = v.id;
      perform public._conta_anotar(p_empresa, v.id, v.numero, v.glosa, 'envio');

    when 'registrar' then
      if v.estado = 'por_aprobar' then
        if not v_aprobador then
          raise exception 'Solo el dueño puede aprobar asientos.' using errcode = '42501';
        end if;
      elsif v.estado = 'borrador' then
        if not (v_aprobador or (v_autor and coalesce(v_directo, false))) then
          raise exception 'No tienes permiso para registrar directo: envíalo al dueño.' using errcode = '42501';
        end if;
      else
        raise exception 'Este asiento no se puede registrar.';
      end if;
      perform public._conta_validar(v_datos);
      update public.conta_asientos
        set estado = 'registrado', registrado_por = (select auth.uid()), observacion = null, actualizado_en = now()
        where id = v.id;
      perform public._conta_anotar(p_empresa, v.id, v.numero, v.glosa,
        case when v.estado = 'por_aprobar' then 'aprobo' else 'registro' end);

    when 'observar' then
      if not v_aprobador then
        raise exception 'Solo el dueño puede observar asientos.' using errcode = '42501';
      end if;
      if v.estado <> 'por_aprobar' then
        raise exception 'Solo se observan asientos por aprobar.';
      end if;
      if coalesce(trim(p_comentario), '') = '' then
        raise exception 'Escribe qué debe corregir.';
      end if;
      update public.conta_asientos set estado = 'observado', observacion = trim(p_comentario), actualizado_en = now()
        where id = v.id;
      perform public._conta_anotar(p_empresa, v.id, v.numero, v.glosa, 'observo', trim(p_comentario));

    when 'anular' then
      if not v_aprobador then
        raise exception 'Solo el dueño puede anular asientos.' using errcode = '42501';
      end if;
      if v.estado <> 'registrado' then
        raise exception 'Solo se anulan asientos registrados.';
      end if;
      update public.conta_asientos set estado = 'anulado', actualizado_en = now() where id = v.id;
      perform public._conta_anotar(p_empresa, v.id, v.numero, v.glosa, 'anulo');

    when 'eliminar' then
      if v.estado <> 'borrador' or not (v_autor or v_aprobador) then
        raise exception 'Solo se eliminan borradores propios.';
      end if;
      perform public._conta_anotar(p_empresa, null, v.numero, v.glosa, 'elimino');
      delete from public.conta_asientos where id = v.id;

    else
      raise exception 'Acción no válida.';
  end case;
end;
$$;

-- =====================================================================
-- Seguridad por filas: lectura por área; la escritura va solo por las funciones
-- =====================================================================
alter table public.fin_cuentas enable row level security;
alter table public.fin_comprobantes enable row level security;
alter table public.fin_movimientos enable row level security;

create policy fin_cuentas_ver on public.fin_cuentas for select to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{finanzas,contabilidad}'));
create policy fin_comprobantes_ver on public.fin_comprobantes for select to authenticated
  using (public.fin_tiene_alguna(empresa_id,
    case operacion when 'venta' then '{ventas,finanzas,contabilidad}'::public.area_empresa[]
                   else '{finanzas,contabilidad}'::public.area_empresa[] end));
create policy fin_movimientos_ver on public.fin_movimientos for select to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{finanzas,contabilidad}'));

revoke all on public.fin_cuentas, public.fin_comprobantes, public.fin_movimientos,
  public.fin_saldos_comprobantes, public.fin_saldos_cuentas, public.fin_comprobantes_detalle,
  public.fin_movimientos_detalle from public, anon, authenticated;
grant select on public.fin_cuentas, public.fin_comprobantes, public.fin_movimientos,
  public.fin_saldos_comprobantes, public.fin_saldos_cuentas, public.fin_comprobantes_detalle,
  public.fin_movimientos_detalle to authenticated;

revoke execute on function
  public.fin_tiene_alguna(uuid, public.area_empresa[]),
  public._conta_asiento_auto(uuid, date, text, text, jsonb, jsonb),
  public._conta_anular_auto(uuid, uuid, text),
  public._fin_cuadrar(jsonb),
  public.fin_guardar_cuenta(uuid, uuid, jsonb),
  public.fin_registrar_comprobante(uuid, jsonb),
  public.fin_anular_comprobante(uuid, uuid, text),
  public.fin_registrar_movimiento(uuid, jsonb),
  public.fin_anular_movimiento(uuid, uuid, text),
  public.conta_saldos(uuid, date, date)
  from public, anon;
revoke execute on function
  public._conta_asiento_auto(uuid, date, text, text, jsonb, jsonb),
  public._conta_anular_auto(uuid, uuid, text),
  public._fin_cuadrar(jsonb)
  from authenticated;
grant execute on function
  public.fin_tiene_alguna(uuid, public.area_empresa[]),
  public.fin_guardar_cuenta(uuid, uuid, jsonb),
  public.fin_registrar_comprobante(uuid, jsonb),
  public.fin_anular_comprobante(uuid, uuid, text),
  public.fin_registrar_movimiento(uuid, jsonb),
  public.fin_anular_movimiento(uuid, uuid, text),
  public.conta_saldos(uuid, date, date)
  to authenticated;
