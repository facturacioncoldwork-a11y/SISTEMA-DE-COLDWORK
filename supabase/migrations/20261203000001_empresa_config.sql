-- =====================================================================
-- COLDWORK ERP · Migración 0020 · Configuración de la empresa
-- ---------------------------------------------------------------------
-- Datos que cada empresa ajusta en Sistema → Configuración (dueño o admin):
-- contacto, cuentas bancarias (salen en las cotizaciones; NUNCA en el código),
-- y los valores por defecto de las cotizaciones (prefijo del número, validez,
-- detracción y notas). La lee todo miembro (sale en los PDF); se escribe solo
-- por función y solo dueño/admin.
-- =====================================================================

create table public.empresa_config (
  empresa_id         uuid primary key references public.empresas (id) on delete cascade,
  telefono           text not null default '' check (length(telefono) <= 30),
  correo             text not null default '' check (correo = '' or (length(correo) <= 120 and correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  web                text not null default '' check (length(web) <= 120),
  correo_ordenes     text not null default '' check (correo_ordenes = '' or (length(correo_ordenes) <= 120 and correo_ordenes ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  cuentas            jsonb not null default '[]' check (jsonb_typeof(cuentas) = 'array' and jsonb_array_length(cuentas) <= 10),
  cot_prefijo        text not null default 'COT-' check (cot_prefijo ~ '^[A-Z0-9-]{1,8}$'),
  cot_validez_proy   integer not null default 15 check (cot_validez_proy between 1 and 365),
  cot_validez_serv   integer not null default 7 check (cot_validez_serv between 1 and 365),
  cot_detraccion     numeric(5, 2) not null default 12 check (cot_detraccion between 0 and 100),
  cot_notas          text not null default 'No incluye obras civiles ni acometidas eléctricas.' check (length(cot_notas) <= 1000),
  actualizado_por    uuid references auth.users (id) on delete set null,
  actualizado_en     timestamptz not null default now()
);

alter table public.empresa_config enable row level security;
create policy empresa_config_ver on public.empresa_config for select to authenticated
  using (public.es_miembro(empresa_id));
revoke all on public.empresa_config from public, anon, authenticated;
grant select on public.empresa_config to authenticated;

-- Las empresas que ya cotizaban siguen con su prefijo de siempre
insert into public.empresa_config (empresa_id, cot_prefijo)
select distinct c.empresa_id, 'YG-' from public.ope_cotizaciones c
on conflict (empresa_id) do nothing;

create or replace function public.empresa_guardar_config(p_empresa uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cuenta jsonb;
  v_cuentas jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.miembros m where m.empresa_id = p_empresa and m.usuario_id = (select auth.uid())
                 and m.activo and m.rol in ('dueno', 'admin')) then
    raise exception 'Solo el dueño o un administrador cambian la configuración' using errcode = '42501';
  end if;
  if jsonb_typeof(p_datos) <> 'object' then raise exception 'Datos inválidos' using errcode = '22023'; end if;

  -- Cuentas bancarias: solo banco, moneda, número y CCI, validados
  for v_cuenta in select * from jsonb_array_elements(coalesce(p_datos -> 'cuentas', '[]'::jsonb)) loop
    if coalesce(v_cuenta ->> 'moneda', '') not in ('PEN', 'USD')
       or length(trim(coalesce(v_cuenta ->> 'banco', ''))) not between 2 and 60
       or coalesce(v_cuenta ->> 'numero', '') !~ '^[0-9][0-9 -]{4,28}[0-9]$'
       or coalesce(v_cuenta ->> 'cci', '') !~ '^([0-9]{20})?$' then
      raise exception 'Revisa las cuentas bancarias: banco, moneda, número y CCI de 20 dígitos' using errcode = '22023';
    end if;
    v_cuentas := v_cuentas || jsonb_build_object('banco', trim(v_cuenta ->> 'banco'), 'moneda', v_cuenta ->> 'moneda',
                                                 'numero', v_cuenta ->> 'numero', 'cci', coalesce(v_cuenta ->> 'cci', ''));
  end loop;

  insert into public.empresa_config as c (empresa_id, telefono, correo, web, correo_ordenes, cuentas, cot_prefijo,
    cot_validez_proy, cot_validez_serv, cot_detraccion, cot_notas, actualizado_por, actualizado_en)
  values (
    p_empresa,
    left(trim(coalesce(p_datos ->> 'telefono', '')), 30),
    lower(trim(coalesce(p_datos ->> 'correo', ''))),
    left(trim(coalesce(p_datos ->> 'web', '')), 120),
    lower(trim(coalesce(p_datos ->> 'correoOrdenes', ''))),
    v_cuentas,
    upper(trim(coalesce(nullif(p_datos ->> 'cotPrefijo', ''), 'COT-'))),
    coalesce((p_datos ->> 'cotValidezProy')::integer, 15),
    coalesce((p_datos ->> 'cotValidezServ')::integer, 7),
    coalesce((p_datos ->> 'cotDetraccion')::numeric, 12),
    left(coalesce(p_datos ->> 'cotNotas', ''), 1000),
    (select auth.uid()),
    now()
  )
  on conflict (empresa_id) do update set
    telefono = excluded.telefono, correo = excluded.correo, web = excluded.web, correo_ordenes = excluded.correo_ordenes,
    cuentas = excluded.cuentas, cot_prefijo = excluded.cot_prefijo, cot_validez_proy = excluded.cot_validez_proy,
    cot_validez_serv = excluded.cot_validez_serv, cot_detraccion = excluded.cot_detraccion, cot_notas = excluded.cot_notas,
    actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en;
end;
$$;

revoke all on function public.empresa_guardar_config(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.empresa_guardar_config(uuid, jsonb) to authenticated;

-- ---------- El número de cotización usa el prefijo de la empresa ----------
create or replace function public._ope_prefijo_cot(p_empresa uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select c.cot_prefijo from public.empresa_config c where c.empresa_id = p_empresa), 'COT-');
$$;
revoke all on function public._ope_prefijo_cot(uuid) from public, anon, authenticated;

create or replace function public.ope_guardar_cotizacion(p_empresa uuid, p_id uuid, p_datos jsonb, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actual public.ope_cotizaciones;
  v_serie text := p_datos ->> 'serie';
  v_cliente uuid := public._ope_uuid(p_datos ->> 'clienteId');
  v_valor numeric(14, 2);
  v_doc jsonb;
  v_anio integer := extract(year from public._ope_hoy());
  v_numero text;
begin
  if not public.fin_tiene_alguna(p_empresa, '{ventas}') then
    raise exception 'Solo el área de Ventas puede editar cotizaciones' using errcode = '42501';
  end if;
  if jsonb_typeof(p_datos) <> 'object' or jsonb_typeof(p_datos -> 'secciones') <> 'array' or jsonb_typeof(p_datos -> 'hitos') <> 'array' then
    raise exception 'Datos de cotización inválidos' using errcode = '22023';
  end if;
  if not public._ope_cliente_ok(p_empresa, v_cliente) then
    raise exception 'El cliente no pertenece a la empresa' using errcode = '42501';
  end if;
  if coalesce(p_datos ->> 'moneda', '') not in ('PEN', 'USD') then
    raise exception 'Moneda inválida' using errcode = '22023';
  end if;

  select coalesce(round(sum(coalesce((l ->> 'cantidad')::numeric, 0) * coalesce((l ->> 'precio')::numeric, 0)), 2), 0)
    into v_valor
  from jsonb_array_elements(p_datos -> 'secciones') s, jsonb_array_elements(s -> 'lineas') l;
  if v_valor < 0 then raise exception 'Los importes no pueden ser negativos' using errcode = '22023'; end if;

  v_doc := p_datos - 'id' - 'numero' - 'estado' - 'expedienteId' - 'motivoRechazo' - 'serie' - 'clienteId'
                   - 'proyecto' - 'fecha' - 'validezDias' - 'moneda';

  select * into v_actual from public.ope_cotizaciones c where c.id = p_id for update;
  if found then
    if v_actual.empresa_id <> p_empresa then raise exception 'No encontrado' using errcode = 'P0002'; end if;
    if v_actual.estado <> 'borrador' then
      raise exception 'Solo se edita una cotización en borrador' using errcode = '22023';
    end if;
    if v_actual.version <> p_version then
      raise exception 'Alguien más cambió esta cotización. Recarga para ver los cambios.' using errcode = '40001';
    end if;
    update public.ope_cotizaciones set
      cliente_id = v_cliente,
      proyecto = public._ope_texto(p_datos ->> 'proyecto', 300),
      fecha = coalesce((p_datos ->> 'fecha')::date, fecha),
      validez_dias = least(greatest(coalesce((p_datos ->> 'validezDias')::integer, 7), 1), 365),
      moneda = p_datos ->> 'moneda',
      valor_venta = v_valor,
      total = round(v_valor * 1.18, 2),
      datos = v_doc,
      version = version + 1,
      actualizado_en = now()
    where id = p_id;
    return jsonb_build_object('numero', v_actual.numero, 'version', v_actual.version + 1);
  end if;

  if v_serie not in ('PROY', 'SERV') then raise exception 'Serie inválida' using errcode = '22023'; end if;
  v_numero := public._ope_prefijo_cot(p_empresa) || v_serie || v_anio
              || lpad(public._ope_siguiente(p_empresa, 'COT-' || v_anio)::text, 5, '0');
  insert into public.ope_cotizaciones
    (id, empresa_id, serie, numero, cliente_id, proyecto, fecha, validez_dias, moneda, valor_venta, total, datos, creado_por)
  values
    (p_id, p_empresa, v_serie, v_numero, v_cliente, public._ope_texto(p_datos ->> 'proyecto', 300),
     coalesce((p_datos ->> 'fecha')::date, public._ope_hoy()),
     least(greatest(coalesce((p_datos ->> 'validezDias')::integer, 7), 1), 365),
     p_datos ->> 'moneda', v_valor, round(v_valor * 1.18, 2), v_doc, (select auth.uid()));
  return jsonb_build_object('numero', v_numero, 'version', 1);
end;
$$;
