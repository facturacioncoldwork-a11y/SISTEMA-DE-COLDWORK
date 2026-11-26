-- =====================================================================
-- COLDWORK ERP · Migración 0015 · Operaciones en la base de datos
-- ---------------------------------------------------------------------
-- Cotizaciones, servicios (expedientes) con su historial, equipos de los
-- clientes, órdenes de trabajo con su informe técnico y mensajes, fotos en
-- un bucket privado, directorio del personal y tabletas de asistencia.
--
-- Seguridad (habrá pentest):
--  · Cada fila lleva empresa_id y RLS: solo la ven los miembros con el área
--    que corresponde (dueño y admin ven todo).
--  · Nadie escribe directo en las tablas: todo pasa por funciones que
--    validan área, que el cliente/equipo/técnico sea de LA MISMA empresa,
--    tamaños, estados y versión (dos personas no se pisan los cambios).
--  · Los números (cotización, expediente, OT) los pone el servidor.
--  · Una OT cerrada (firmada por el cliente) ya no se puede cambiar.
--  · Historial y mensajes: solo se agregan, no se editan ni borran.
--  · Tabletas: token aleatorio de 256 bits; en la base solo queda su hash.
-- Velocidad: índices por (empresa_id, …) en todo lo que se lista.
-- =====================================================================

-- ---------- Correlativos por empresa (sin choques aunque marquen a la vez) ----------
create table public.ope_correlativos (
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  clave       text not null check (clave ~ '^[A-Z0-9_-]{1,20}$'),
  ultimo      integer not null default 0,
  primary key (empresa_id, clave)
);
alter table public.ope_correlativos enable row level security;

create or replace function public._ope_siguiente(p_empresa uuid, p_clave text)
returns integer language sql security definer set search_path = '' as $$
  insert into public.ope_correlativos as c (empresa_id, clave, ultimo) values (p_empresa, p_clave, 1)
  on conflict (empresa_id, clave) do update set ultimo = c.ultimo + 1
  returning c.ultimo;
$$;

create or replace function public._ope_hoy()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Lima')::date;
$$;

/** ¿El tercero es cliente de ESTA empresa? (las FK no miran la empresa). */
create or replace function public._ope_cliente_ok(p_empresa uuid, p_cliente uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_cliente is null or exists (select 1 from public.terceros t where t.id = p_cliente and t.empresa_id = p_empresa);
$$;

create or replace function public._ope_miembro_ok(p_empresa uuid, p_usuario uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_usuario is null or exists (select 1 from public.miembros m where m.empresa_id = p_empresa and m.usuario_id = p_usuario);
$$;

create or replace function public._ope_nombre()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(trim(p.nombre), ''), 'Usuario') from public.perfiles p where p.id = (select auth.uid());
$$;

create or replace function public._ope_uuid(p_texto text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  if p_texto is null or p_texto = '' then return null; end if;
  return p_texto::uuid;
exception when others then
  raise exception 'Identificador inválido' using errcode = '22023';
end;
$$;

create or replace function public._ope_texto(p_valor text, p_max integer)
returns text language sql immutable set search_path = '' as $$
  select left(coalesce(trim(p_valor), ''), p_max);
$$;

-- =====================================================================
-- Tablas
-- =====================================================================
create table public.ope_cotizaciones (
  id              uuid primary key,
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  serie           text not null check (serie in ('PROY', 'SERV')),
  numero          text not null,
  cliente_id      uuid references public.terceros (id) on delete restrict,
  proyecto        text not null default '' check (length(proyecto) <= 300),
  fecha           date not null,
  validez_dias    integer not null check (validez_dias between 1 and 365),
  moneda          text not null check (moneda in ('PEN', 'USD')),
  estado          text not null default 'borrador' check (estado in ('borrador', 'enviada', 'aprobada', 'rechazada')),
  valor_venta     numeric(14, 2) not null default 0,
  total           numeric(14, 2) not null default 0,
  expediente_id   uuid,
  motivo_rechazo  text check (length(motivo_rechazo) <= 300),
  datos           jsonb not null check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) < 262144),
  version         integer not null default 1,
  creado_por      uuid references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (empresa_id, numero)
);
create index ope_cot_empresa_fecha_idx on public.ope_cotizaciones (empresa_id, fecha desc);
create index ope_cot_empresa_estado_idx on public.ope_cotizaciones (empresa_id, estado);

create table public.ope_expedientes (
  id              uuid primary key,
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  codigo          text not null,
  cliente_id      uuid references public.terceros (id) on delete restrict,
  titulo          text not null default '' check (length(titulo) <= 300),
  responsable_id  uuid references auth.users (id) on delete set null,
  etapa           text not null default 'solicitud' check (etapa in
                    ('solicitud', 'cotizacion', 'orden_cliente', 'ingreso', 'ejecucion', 'conformidad', 'facturado', 'cobrado')),
  creado          date not null default public._ope_hoy(),
  datos           jsonb not null check (jsonb_typeof(datos) = 'object' and pg_column_size(datos) < 524288),
  version         integer not null default 1,
  creado_por      uuid references auth.users (id) on delete set null,
  actualizado_en  timestamptz not null default now(),
  unique (empresa_id, codigo)
);
create index ope_exp_empresa_act_idx on public.ope_expedientes (empresa_id, actualizado_en desc);
create index ope_exp_empresa_etapa_idx on public.ope_expedientes (empresa_id, etapa);

alter table public.ope_cotizaciones
  add constraint ope_cot_expediente_fk foreign key (expediente_id) references public.ope_expedientes (id) on delete set null;

create table public.ope_expediente_historial (
  id             bigint generated always as identity primary key,
  empresa_id     uuid not null references public.empresas (id) on delete cascade,
  expediente_id  uuid not null references public.ope_expedientes (id) on delete cascade,
  autor_id       uuid references auth.users (id) on delete set null,
  autor_nombre   text not null default '',
  texto          text not null check (length(texto) between 1 and 500),
  creado_en      timestamptz not null default now()
);
create index ope_hist_exp_idx on public.ope_expediente_historial (expediente_id, creado_en desc);

create table public.ope_equipos (
  id            uuid primary key,
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  cliente_id    uuid not null references public.terceros (id) on delete restrict,
  codigo        text not null check (length(codigo) between 1 and 40),
  tipo          text not null default '' check (length(tipo) <= 120),
  marca         text not null default '' check (length(marca) <= 120),
  modelo        text not null default '' check (length(modelo) <= 120),
  serie         text not null default '' check (length(serie) <= 120),
  refrigerante  text not null default '' check (length(refrigerante) <= 40),
  capacidad     text not null default '' check (length(capacidad) <= 60),
  ubicacion     text not null default '' check (length(ubicacion) <= 200),
  creado_en     timestamptz not null default now()
);
create index ope_equipos_cliente_idx on public.ope_equipos (empresa_id, cliente_id);

create table public.ope_ordenes (
  id              uuid primary key,
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  numero          text not null,
  cliente_id      uuid not null references public.terceros (id) on delete restrict,
  equipo_id       uuid not null references public.ope_equipos (id) on delete restrict,
  expediente_id   uuid references public.ope_expedientes (id) on delete set null,
  tipo            text not null check (tipo in ('preventivo', 'correctivo', 'instalacion', 'emergencia', 'inspeccion')),
  prioridad       text not null check (prioridad in ('baja', 'media', 'alta', 'urgente')),
  tecnicos        uuid[] not null default '{}' check (cardinality(tecnicos) <= 20),
  fecha           date not null,
  hora            time not null,
  descripcion     text not null default '' check (length(descripcion) <= 1000),
  estado          text not null default 'programada' check (estado in ('programada', 'en_curso', 'por_firmar', 'cerrada')),
  informe         jsonb not null check (jsonb_typeof(informe) = 'object' and pg_column_size(informe) < 1048576),
  version         integer not null default 1,
  cerrada_en      timestamptz,
  creado_por      uuid references auth.users (id) on delete set null,
  creado_en       timestamptz not null default now(),
  actualizado_en  timestamptz not null default now(),
  unique (empresa_id, numero)
);
create index ope_ordenes_empresa_fecha_idx on public.ope_ordenes (empresa_id, fecha desc);
create index ope_ordenes_empresa_estado_idx on public.ope_ordenes (empresa_id, estado);
create index ope_ordenes_expediente_idx on public.ope_ordenes (expediente_id) where expediente_id is not null;

create table public.ope_orden_mensajes (
  id            bigint generated always as identity primary key,
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  orden_id      uuid not null references public.ope_ordenes (id) on delete cascade,
  autor_id      uuid references auth.users (id) on delete set null,
  autor_nombre  text not null default '',
  texto         text not null check (length(texto) between 1 and 500),
  creado_en     timestamptz not null default now()
);
create index ope_msj_orden_idx on public.ope_orden_mensajes (orden_id, creado_en);

create table public.asistencia_tabletas (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  nombre      text not null check (length(nombre) between 1 and 60),
  token_hash  bytea not null unique,
  activa      boolean not null default true,
  creado_por  uuid references auth.users (id) on delete set null,
  creado_en   timestamptz not null default now(),
  ultimo_uso  timestamptz
);
create index asis_tabletas_empresa_idx on public.asistencia_tabletas (empresa_id);

-- =====================================================================
-- RLS: lectura por área; escritura solo por funciones
-- =====================================================================
alter table public.ope_cotizaciones enable row level security;
alter table public.ope_expedientes enable row level security;
alter table public.ope_expediente_historial enable row level security;
alter table public.ope_equipos enable row level security;
alter table public.ope_ordenes enable row level security;
alter table public.ope_orden_mensajes enable row level security;
alter table public.asistencia_tabletas enable row level security;

create policy ope_cot_ver on public.ope_cotizaciones for select to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{ventas,finanzas}'));
create policy ope_exp_ver on public.ope_expedientes for select to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{ventas,tecnica,finanzas}'));
create policy ope_hist_ver on public.ope_expediente_historial for select to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{ventas,tecnica,finanzas}'));
create policy ope_equipos_ver on public.ope_equipos for select to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{tecnica,ventas}'));
create policy ope_ordenes_ver on public.ope_ordenes for select to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{tecnica,ventas}'));
create policy ope_msj_ver on public.ope_orden_mensajes for select to authenticated
  using (public.fin_tiene_alguna(empresa_id, '{tecnica,ventas}'));
create policy asis_tabletas_ver on public.asistencia_tabletas for select to authenticated
  using (public.asis_es_gestor(empresa_id));

revoke all on public.ope_correlativos, public.ope_cotizaciones, public.ope_expedientes, public.ope_expediente_historial,
  public.ope_equipos, public.ope_ordenes, public.ope_orden_mensajes, public.asistencia_tabletas
  from public, anon, authenticated;
grant select on public.ope_cotizaciones, public.ope_expedientes, public.ope_expediente_historial,
  public.ope_equipos, public.ope_ordenes, public.ope_orden_mensajes to authenticated;
-- De las tabletas nunca se expone el hash del token
grant select (id, empresa_id, nombre, activa, creado_en, ultimo_uso) on public.asistencia_tabletas to authenticated;

-- =====================================================================
-- Directorio del personal (nombres y áreas; sin correos) para todo miembro
-- =====================================================================
create or replace function public.empresa_directorio(p_empresa uuid)
returns table (usuario_id uuid, nombre text, rol public.rol_empresa, areas public.area_empresa[], activo boolean)
language sql stable security definer set search_path = '' as $$
  select m.usuario_id, coalesce(nullif(trim(p.nombre), ''), 'Sin nombre'), m.rol, m.areas, m.activo
  from public.miembros m
  left join public.perfiles p on p.id = m.usuario_id
  where m.empresa_id = p_empresa
    and exists (select 1 from public.miembros yo where yo.empresa_id = p_empresa and yo.usuario_id = (select auth.uid()) and yo.activo)
  order by 2;
$$;

-- =====================================================================
-- Cotizaciones
-- =====================================================================
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

  -- El servidor recalcula el valor de venta (no se confía en el navegador)
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
  v_numero := 'YG-' || v_serie || v_anio || lpad(public._ope_siguiente(p_empresa, 'COT-' || v_anio)::text, 5, '0');
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

create or replace function public.ope_estado_cotizacion(p_empresa uuid, p_id uuid, p_estado text, p_motivo text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actual text;
begin
  if not public.fin_tiene_alguna(p_empresa, '{ventas}') then
    raise exception 'Solo el área de Ventas puede cambiar cotizaciones' using errcode = '42501';
  end if;
  select c.estado into v_actual from public.ope_cotizaciones c where c.id = p_id and c.empresa_id = p_empresa for update;
  if v_actual is null then raise exception 'No encontrado' using errcode = 'P0002'; end if;
  if not ((v_actual = 'borrador' and p_estado = 'enviada')
       or (v_actual = 'enviada' and p_estado in ('borrador', 'rechazada'))
       or (v_actual = 'rechazada' and p_estado = 'borrador')) then
    raise exception 'Ese cambio de estado no está permitido' using errcode = '22023';
  end if;
  if p_estado = 'enviada' and not exists (
    select 1 from public.ope_cotizaciones c where c.id = p_id and c.cliente_id is not null and c.valor_venta > 0) then
    raise exception 'Falta el cliente o los importes' using errcode = '22023';
  end if;
  update public.ope_cotizaciones set
    estado = p_estado,
    fecha = case when p_estado = 'enviada' then public._ope_hoy() else fecha end,
    motivo_rechazo = case when p_estado = 'rechazada' then coalesce(public._ope_texto(p_motivo, 300), 'Sin motivo') else null end,
    version = version + 1,
    actualizado_en = now()
  where id = p_id;
end;
$$;

/** El cliente aprobó: la cotización queda aprobada y se abre (o actualiza) su servicio, todo junto. */
create or replace function public.ope_aprobar_cotizacion(
  p_empresa uuid, p_id uuid, p_orden_cliente text, p_expediente_id uuid, p_expediente jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_cot public.ope_cotizaciones;
  v_exp uuid;
  v_codigo text;
  v_orden text := public._ope_texto(p_orden_cliente, 60);
  v_nota text;
begin
  if not public.fin_tiene_alguna(p_empresa, '{ventas}') then
    raise exception 'Solo el área de Ventas puede aprobar cotizaciones' using errcode = '42501';
  end if;
  if v_orden = '' then raise exception 'Indica la orden del cliente' using errcode = '22023'; end if;
  if jsonb_typeof(p_expediente) <> 'object' or pg_column_size(p_expediente) > 131072 then
    raise exception 'Datos inválidos' using errcode = '22023';
  end if;
  select * into v_cot from public.ope_cotizaciones c where c.id = p_id and c.empresa_id = p_empresa for update;
  if not found then raise exception 'No encontrado' using errcode = 'P0002'; end if;
  if v_cot.estado <> 'enviada' then raise exception 'Solo se aprueba una cotización enviada' using errcode = '22023'; end if;

  v_nota := format('El cliente aprobó la cotización %s: orden %s.', v_cot.numero, v_orden);
  select e.id into v_exp from public.ope_expedientes e where e.id = v_cot.expediente_id and e.empresa_id = p_empresa for update;
  if v_exp is null then
    v_exp := coalesce(p_expediente_id, gen_random_uuid());
    v_codigo := 'EXP-' || extract(year from public._ope_hoy()) || '-'
                || lpad(public._ope_siguiente(p_empresa, 'EXP-' || extract(year from public._ope_hoy()))::text, 3, '0');
    insert into public.ope_expedientes (id, empresa_id, codigo, cliente_id, titulo, responsable_id, etapa, datos, creado_por)
    values (v_exp, p_empresa, v_codigo, v_cot.cliente_id, v_cot.proyecto, (select auth.uid()), 'orden_cliente',
            jsonb_build_object('solicitud', 'Cotización ' || v_cot.numero, 'tareas', '[]'::jsonb, 'compras', '[]'::jsonb,
                               'ordenesTrabajo', '[]'::jsonb,
                               'ingreso', jsonb_build_object('personal', '[]'::jsonb, 'sctrEnviado', false, 'induccion', false,
                                                             'guiaRemision', false, 'correoEnviado', false))
            || p_expediente,
            (select auth.uid()));
    insert into public.ope_expediente_historial (empresa_id, expediente_id, autor_id, autor_nombre, texto)
    values (p_empresa, v_exp, (select auth.uid()), public._ope_nombre(), 'Se abrió el servicio desde la cotización ' || v_cot.numero || '.');
  else
    update public.ope_expedientes set etapa = 'orden_cliente', datos = datos || p_expediente, version = version + 1, actualizado_en = now()
    where id = v_exp;
  end if;
  insert into public.ope_expediente_historial (empresa_id, expediente_id, autor_id, autor_nombre, texto)
  values (p_empresa, v_exp, (select auth.uid()), public._ope_nombre(), v_nota);

  update public.ope_cotizaciones set estado = 'aprobada', expediente_id = v_exp, version = version + 1, actualizado_en = now()
  where id = p_id;
  return jsonb_build_object('expedienteId', v_exp);
end;
$$;

-- =====================================================================
-- Servicios (expedientes)
-- =====================================================================
create or replace function public.ope_guardar_expediente(
  p_empresa uuid, p_id uuid, p_datos jsonb, p_version integer, p_nota text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actual public.ope_expedientes;
  v_cliente uuid := public._ope_uuid(p_datos ->> 'clienteId');
  v_resp uuid := public._ope_uuid(p_datos ->> 'responsableId');
  v_doc jsonb;
  v_codigo text;
  v_nota text := nullif(public._ope_texto(p_nota, 500), '');
  v_etapa text := coalesce(p_datos ->> 'etapa', 'solicitud');
begin
  if not public.fin_tiene_alguna(p_empresa, '{ventas,tecnica}') then
    raise exception 'Solo Ventas o el área técnica pueden editar servicios' using errcode = '42501';
  end if;
  if jsonb_typeof(p_datos) <> 'object' then raise exception 'Datos inválidos' using errcode = '22023'; end if;
  if not public._ope_cliente_ok(p_empresa, v_cliente) then
    raise exception 'El cliente no pertenece a la empresa' using errcode = '42501';
  end if;
  if not public._ope_miembro_ok(p_empresa, v_resp) then v_resp := null; end if;

  v_doc := p_datos - 'id' - 'codigo' - 'creado' - 'historial' - 'etapa' - 'clienteId' - 'titulo' - 'responsableId' - 'version';

  select * into v_actual from public.ope_expedientes e where e.id = p_id for update;
  if found then
    if v_actual.empresa_id <> p_empresa then raise exception 'No encontrado' using errcode = 'P0002'; end if;
    if v_actual.version <> p_version then
      raise exception 'Alguien más cambió este servicio. Recarga para ver los cambios.' using errcode = '40001';
    end if;
    update public.ope_expedientes set
      cliente_id = v_cliente, titulo = public._ope_texto(p_datos ->> 'titulo', 300), responsable_id = v_resp,
      etapa = v_etapa, datos = v_doc, version = version + 1, actualizado_en = now()
    where id = p_id;
    v_codigo := v_actual.codigo;
  else
    v_codigo := 'EXP-' || extract(year from public._ope_hoy()) || '-'
                || lpad(public._ope_siguiente(p_empresa, 'EXP-' || extract(year from public._ope_hoy()))::text, 3, '0');
    insert into public.ope_expedientes (id, empresa_id, codigo, cliente_id, titulo, responsable_id, etapa, datos, creado_por)
    values (p_id, p_empresa, v_codigo, v_cliente, public._ope_texto(p_datos ->> 'titulo', 300), v_resp, v_etapa, v_doc, (select auth.uid()));
    insert into public.ope_expediente_historial (empresa_id, expediente_id, autor_id, autor_nombre, texto)
    values (p_empresa, p_id, (select auth.uid()), public._ope_nombre(), 'Se abrió el expediente con la solicitud del cliente.');
  end if;
  if v_nota is not null then
    insert into public.ope_expediente_historial (empresa_id, expediente_id, autor_id, autor_nombre, texto)
    values (p_empresa, p_id, (select auth.uid()), public._ope_nombre(), v_nota);
  end if;
  return jsonb_build_object('codigo', v_codigo, 'version', coalesce(v_actual.version, 0) + 1);
end;
$$;

-- =====================================================================
-- Equipos de los clientes
-- =====================================================================
create or replace function public.ope_guardar_equipo(p_empresa uuid, p_id uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cliente uuid := public._ope_uuid(p_datos ->> 'clienteId');
begin
  if not public.fin_tiene_alguna(p_empresa, '{tecnica,ventas}') then
    raise exception 'Solo el área técnica o Ventas pueden registrar equipos' using errcode = '42501';
  end if;
  if v_cliente is null or not public._ope_cliente_ok(p_empresa, v_cliente) then
    raise exception 'Elige un cliente de la empresa' using errcode = '22023';
  end if;
  if public._ope_texto(p_datos ->> 'codigo', 40) = '' then raise exception 'Indica el código del equipo' using errcode = '22023'; end if;
  if exists (select 1 from public.ope_equipos q where q.id = p_id and q.empresa_id <> p_empresa) then
    raise exception 'No encontrado' using errcode = 'P0002';
  end if;
  insert into public.ope_equipos (id, empresa_id, cliente_id, codigo, tipo, marca, modelo, serie, refrigerante, capacidad, ubicacion)
  values (p_id, p_empresa, v_cliente, public._ope_texto(p_datos ->> 'codigo', 40), public._ope_texto(p_datos ->> 'tipo', 120),
          public._ope_texto(p_datos ->> 'marca', 120), public._ope_texto(p_datos ->> 'modelo', 120), public._ope_texto(p_datos ->> 'serie', 120),
          public._ope_texto(p_datos ->> 'refrigerante', 40), public._ope_texto(p_datos ->> 'capacidad', 60), public._ope_texto(p_datos ->> 'ubicacion', 200))
  on conflict (id) do update set
    cliente_id = excluded.cliente_id, codigo = excluded.codigo, tipo = excluded.tipo, marca = excluded.marca,
    modelo = excluded.modelo, serie = excluded.serie, refrigerante = excluded.refrigerante,
    capacidad = excluded.capacidad, ubicacion = excluded.ubicacion;
end;
$$;

-- =====================================================================
-- Órdenes de trabajo e informe técnico
-- =====================================================================
create or replace function public.ope_guardar_orden(p_empresa uuid, p_id uuid, p_datos jsonb, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actual public.ope_ordenes;
  v_cliente uuid := public._ope_uuid(p_datos ->> 'clienteId');
  v_equipo uuid := public._ope_uuid(p_datos ->> 'equipoId');
  v_exp uuid := public._ope_uuid(p_datos ->> 'expedienteId');
  v_estado text := coalesce(p_datos ->> 'estado', 'programada');
  v_informe jsonb := coalesce(p_datos -> 'informe', '{}'::jsonb);
  v_tecnicos uuid[];
  v_numero text;
  v_foto jsonb;
begin
  if not public.fin_tiene_alguna(p_empresa, '{tecnica,ventas}') then
    raise exception 'Solo el área técnica o Ventas pueden editar órdenes' using errcode = '42501';
  end if;
  if jsonb_typeof(v_informe) <> 'object' then raise exception 'Informe inválido' using errcode = '22023'; end if;
  if v_cliente is null or not public._ope_cliente_ok(p_empresa, v_cliente) then
    raise exception 'El cliente no pertenece a la empresa' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ope_equipos q where q.id = v_equipo and q.empresa_id = p_empresa and q.cliente_id = v_cliente) then
    raise exception 'El equipo no es de ese cliente' using errcode = '22023';
  end if;
  if v_exp is not null and not exists (select 1 from public.ope_expedientes e where e.id = v_exp and e.empresa_id = p_empresa) then
    v_exp := null;
  end if;
  select coalesce(array_agg(t::uuid), '{}') into v_tecnicos
  from jsonb_array_elements_text(coalesce(p_datos -> 'tecnicos', '[]'::jsonb)) t;
  if exists (select 1 from unnest(v_tecnicos) t where not public._ope_miembro_ok(p_empresa, t)) then
    raise exception 'Un técnico no pertenece a la empresa' using errcode = '22023';
  end if;
  -- Firma: solo una imagen PNG pequeña. Fotos: solo rutas del bucket privado de ESTA empresa.
  if coalesce(v_informe ->> 'firmaCliente', '') <> ''
     and (left(v_informe ->> 'firmaCliente', 22) <> 'data:image/png;base64,' or length(v_informe ->> 'firmaCliente') > 300000) then
    raise exception 'Firma inválida' using errcode = '22023';
  end if;
  for v_foto in select * from jsonb_array_elements(coalesce(v_informe -> 'fotos', '[]'::jsonb)) loop
    if left(coalesce(v_foto ->> 'url', ''), 37) <> p_empresa::text || '/' then
      raise exception 'Foto inválida' using errcode = '22023';
    end if;
  end loop;
  if v_estado = 'cerrada' and (coalesce(v_informe ->> 'firmaCliente', '') = '' or public._ope_texto(v_informe ->> 'firmaNombre', 120) = '') then
    raise exception 'Para cerrar, el cliente debe firmar y escribir su nombre' using errcode = '22023';
  end if;

  select * into v_actual from public.ope_ordenes o where o.id = p_id for update;
  if found then
    if v_actual.empresa_id <> p_empresa then raise exception 'No encontrado' using errcode = 'P0002'; end if;
    if v_actual.estado = 'cerrada' then
      raise exception 'La orden ya está cerrada y firmada: no se puede cambiar' using errcode = '22023';
    end if;
    if v_actual.version <> p_version then
      raise exception 'Alguien más cambió esta orden. Recarga para ver los cambios.' using errcode = '40001';
    end if;
    update public.ope_ordenes set
      cliente_id = v_cliente, equipo_id = v_equipo, expediente_id = v_exp,
      tipo = p_datos ->> 'tipo', prioridad = p_datos ->> 'prioridad', tecnicos = v_tecnicos,
      fecha = (p_datos ->> 'fecha')::date, hora = (p_datos ->> 'hora')::time,
      descripcion = public._ope_texto(p_datos ->> 'descripcion', 1000), estado = v_estado, informe = v_informe,
      cerrada_en = case when v_estado = 'cerrada' then now() else null end,
      version = version + 1, actualizado_en = now()
    where id = p_id;
    return jsonb_build_object('numero', v_actual.numero, 'version', v_actual.version + 1);
  end if;

  v_numero := 'OT-' || lpad(public._ope_siguiente(p_empresa, 'OT')::text, 6, '0');
  insert into public.ope_ordenes
    (id, empresa_id, numero, cliente_id, equipo_id, expediente_id, tipo, prioridad, tecnicos, fecha, hora, descripcion, estado, informe, creado_por)
  values
    (p_id, p_empresa, v_numero, v_cliente, v_equipo, v_exp, p_datos ->> 'tipo', p_datos ->> 'prioridad', v_tecnicos,
     (p_datos ->> 'fecha')::date, (p_datos ->> 'hora')::time, public._ope_texto(p_datos ->> 'descripcion', 1000),
     'programada', v_informe, (select auth.uid()));
  return jsonb_build_object('numero', v_numero, 'version', 1);
end;
$$;

create or replace function public.ope_enviar_mensaje(p_empresa uuid, p_orden uuid, p_texto text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_texto text := public._ope_texto(p_texto, 500);
  v_fila public.ope_orden_mensajes;
begin
  if not public.fin_tiene_alguna(p_empresa, '{tecnica,ventas}') then
    raise exception 'Sin acceso a la orden' using errcode = '42501';
  end if;
  if v_texto = '' then raise exception 'Escribe el mensaje' using errcode = '22023'; end if;
  if not exists (select 1 from public.ope_ordenes o where o.id = p_orden and o.empresa_id = p_empresa) then
    raise exception 'No encontrado' using errcode = 'P0002';
  end if;
  insert into public.ope_orden_mensajes (empresa_id, orden_id, autor_id, autor_nombre, texto)
  values (p_empresa, p_orden, (select auth.uid()), public._ope_nombre(), v_texto)
  returning * into v_fila;
  return jsonb_build_object('autorId', v_fila.autor_id, 'autor', v_fila.autor_nombre, 'texto', v_fila.texto,
                            'hora', to_char(v_fila.creado_en at time zone 'America/Lima', 'HH24:MI'));
end;
$$;

-- =====================================================================
-- Tabletas de asistencia (la tablet de la oficina muestra el código sin iniciar sesión)
-- =====================================================================
create or replace function public.asis_crear_tableta(p_empresa uuid, p_nombre text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_nombre text := public._ope_texto(p_nombre, 60);
  v_id uuid;
begin
  if not public.asis_es_gestor(p_empresa) then
    raise exception 'Solo el dueño o el encargado de asistencia pueden crear tabletas' using errcode = '42501';
  end if;
  if v_nombre = '' then raise exception 'Ponle un nombre (ej. Tablet de la entrada)' using errcode = '22023'; end if;
  if (select count(*) from public.asistencia_tabletas t where t.empresa_id = p_empresa and t.activa) >= 10 then
    raise exception 'Máximo 10 tabletas activas: desactiva una antes' using errcode = '22023';
  end if;
  insert into public.asistencia_tabletas (empresa_id, nombre, token_hash, creado_por)
  values (p_empresa, v_nombre, extensions.digest(v_token, 'sha256'), (select auth.uid()))
  returning id into v_id;
  -- El token se muestra UNA sola vez; en la base queda solo su hash
  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;

create or replace function public.asis_desactivar_tableta(p_empresa uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.asis_es_gestor(p_empresa) then
    raise exception 'Solo el dueño o el encargado de asistencia' using errcode = '42501';
  end if;
  update public.asistencia_tabletas set activa = false where id = p_id and empresa_id = p_empresa;
  if not found then raise exception 'No encontrado' using errcode = 'P0002'; end if;
end;
$$;

/** Lo llama la tablet SIN sesión: con un token válido devuelve el código del momento. */
create or replace function public.asis_codigo_tableta(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_tab public.asistencia_tabletas;
  v_seg bigint := floor(extract(epoch from now()))::bigint;
  v_empresa text;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Tableta no autorizada' using errcode = '42501';
  end if;
  select * into v_tab from public.asistencia_tabletas t where t.token_hash = extensions.digest(p_token, 'sha256') and t.activa;
  if not found then raise exception 'Tableta no autorizada' using errcode = '42501'; end if;
  if exists (select 1 from public.asistencia_horario h where h.empresa_id = v_tab.empresa_id and not ('codigo' = any (h.metodos))) then
    raise exception 'El código de oficina está desactivado en el horario' using errcode = '22023';
  end if;
  if v_tab.ultimo_uso is null or v_tab.ultimo_uso < now() - interval '5 minutes' then
    update public.asistencia_tabletas set ultimo_uso = now() where id = v_tab.id;
  end if;
  select e.razon_social into v_empresa from public.empresas e where e.id = v_tab.empresa_id;
  return jsonb_build_object('codigo', public._asis_codigo(v_tab.empresa_id, v_seg / 30), 'segundos', 30 - (v_seg % 30),
                            'empresa', v_empresa, 'tableta', v_tab.nombre);
end;
$$;

-- ---------- Permisos de ejecución ----------
revoke all on function public._ope_siguiente(uuid, text), public._ope_hoy(), public._ope_cliente_ok(uuid, uuid),
  public._ope_miembro_ok(uuid, uuid), public._ope_nombre(), public._ope_uuid(text), public._ope_texto(text, integer),
  public.empresa_directorio(uuid), public.ope_guardar_cotizacion(uuid, uuid, jsonb, integer),
  public.ope_estado_cotizacion(uuid, uuid, text, text), public.ope_aprobar_cotizacion(uuid, uuid, text, uuid, jsonb),
  public.ope_guardar_expediente(uuid, uuid, jsonb, integer, text), public.ope_guardar_equipo(uuid, uuid, jsonb),
  public.ope_guardar_orden(uuid, uuid, jsonb, integer), public.ope_enviar_mensaje(uuid, uuid, text),
  public.asis_crear_tableta(uuid, text), public.asis_desactivar_tableta(uuid, uuid), public.asis_codigo_tableta(text)
  from public, anon, authenticated;

grant execute on function public._ope_hoy() to authenticated;
grant execute on function public.empresa_directorio(uuid), public.ope_guardar_cotizacion(uuid, uuid, jsonb, integer),
  public.ope_estado_cotizacion(uuid, uuid, text, text), public.ope_aprobar_cotizacion(uuid, uuid, text, uuid, jsonb),
  public.ope_guardar_expediente(uuid, uuid, jsonb, integer, text), public.ope_guardar_equipo(uuid, uuid, jsonb),
  public.ope_guardar_orden(uuid, uuid, jsonb, integer), public.ope_enviar_mensaje(uuid, uuid, text),
  public.asis_crear_tableta(uuid, text), public.asis_desactivar_tableta(uuid, uuid)
  to authenticated;
-- La tablet no tiene sesión: solo esta función, y solo con un token válido
grant execute on function public.asis_codigo_tableta(text) to anon, authenticated;

-- =====================================================================
-- Fotos de los informes: bucket PRIVADO, carpeta = empresa
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ope-fotos', 'ope-fotos', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public._ope_carpeta_empresa(p_nombre text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p_nombre, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function public._ope_carpeta_empresa(text) to authenticated;

create policy ope_fotos_ver on storage.objects for select to authenticated
  using (bucket_id = 'ope-fotos' and public.fin_tiene_alguna(public._ope_carpeta_empresa(name), '{tecnica,ventas}'));
create policy ope_fotos_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'ope-fotos' and public.fin_tiene_alguna(public._ope_carpeta_empresa(name), '{tecnica,ventas}'));
-- Sin políticas de update/delete: una foto de un informe no se reemplaza ni se borra.
