-- =====================================================================
-- COLDWORK ERP · Asistencia (registro de control de asistencia)
-- ---------------------------------------------------------------------
-- DS 004-2006-TR: el trabajador marca personalmente su ingreso y salida;
-- el registro se conserva 5 años y se muestra a SUNAFIL si lo pide.
--
-- Seguridad:
--  · Cada uno marca SOLO por sí mismo; la hora la pone el SERVIDOR (hora de Lima),
--    nunca el celular.
--  · Las marcas no se editan ni se borran (sin permisos de UPDATE/DELETE):
--    todo pasa por funciones que validan y dejan rastro (aprobado_por).
--  · El código de oficina se calcula en el servidor con un secreto por empresa
--    que nadie puede leer (tabla sin permisos).
--  · Quien no es del área Personal (ni dueño/admin) solo ve sus propias marcas.
--
-- Velocidad: índices por empresa+fecha y por persona+fecha; una fila por persona y día.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Horario de cada empresa ----------
create table public.asistencia_horario (
  empresa_id        uuid primary key references public.empresas (id) on delete cascade,
  entrada           time not null default '08:00',
  salida            time not null default '17:00',
  refrigerio_min    smallint not null default 60 check (refrigerio_min between 45 and 180),
  refrigerio_desde  time not null default '12:00',
  refrigerio_hasta  time not null default '15:00',
  tolerancia_min    smallint not null default 10 check (tolerancia_min between 0 and 30),
  metodos           text[] not null default '{gps,codigo,manual}'
                      check (metodos <@ array['gps', 'codigo', 'manual']),
  pedir_selfie      boolean not null default false,
  oficina_lat       numeric(9, 6) check (oficina_lat between -90 and 90),
  oficina_lng       numeric(9, 6) check (oficina_lng between -180 and 180),
  radio_oficina_m   smallint not null default 150 check (radio_oficina_m between 30 and 1000),
  actualizado_en    timestamptz not null default now()
);

-- Secreto del código de oficina: SIN permisos para nadie (solo lo usan las funciones)
create table public.asistencia_secretos (
  empresa_id  uuid primary key references public.empresas (id) on delete cascade,
  secreto     text not null
);

-- ---------- Marcas: una fila por persona y día ----------
create table public.asistencia_marcas (
  id               uuid primary key default gen_random_uuid(),
  empresa_id       uuid not null references public.empresas (id) on delete cascade,
  usuario_id       uuid not null references auth.users (id) on delete restrict,
  fecha            date not null,
  entrada          time not null,
  salida           time,
  metodo           text not null check (metodo in ('gps', 'codigo', 'manual', 'declarada')),
  metodo_salida    text check (metodo_salida in ('gps', 'codigo', 'manual', 'declarada')),
  lugar            text not null check (length(lugar) <= 80),
  lugar_salida     text check (length(lugar_salida) <= 80),
  lat              numeric(9, 6),
  lng              numeric(9, 6),
  salida_en_campo  boolean not null default false,
  motivo           text check (length(motivo) <= 300),
  pendiente        boolean not null default false,
  registrado_por   uuid not null references auth.users (id),
  aprobado_por     uuid references auth.users (id),
  creado_en        timestamptz not null default now(),
  unique (empresa_id, usuario_id, fecha),
  check (salida is null or salida > entrada)
);
create index asistencia_marcas_empresa_fecha on public.asistencia_marcas (empresa_id, fecha desc);
create index asistencia_marcas_pendientes on public.asistencia_marcas (empresa_id) where pendiente;

-- ---------- Ausencias justificadas ----------
create table public.asistencia_ausencias (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references public.empresas (id) on delete cascade,
  usuario_id   uuid not null references auth.users (id) on delete restrict,
  fecha        date not null,
  tipo         text not null check (tipo in ('descanso_medico', 'vacaciones', 'permiso', 'licencia')),
  sustento     text check (length(sustento) <= 300),
  registrado_por uuid not null references auth.users (id),
  creado_en    timestamptz not null default now(),
  unique (empresa_id, usuario_id, fecha)
);
create index asistencia_ausencias_empresa_fecha on public.asistencia_ausencias (empresa_id, fecha desc);

-- =====================================================================
-- Ayudantes
-- =====================================================================
create or replace function public.asis_es_miembro(p_empresa uuid, p_usuario uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros m
    where m.empresa_id = p_empresa and m.usuario_id = coalesce(p_usuario, (select auth.uid())) and m.activo
  );
$$;

/** Gestiona asistencia: dueño, admin o área Personal. */
create or replace function public.asis_es_gestor(p_empresa uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.fin_tiene_alguna(p_empresa, '{personal}');
$$;

create or replace function public._asis_ahora()
returns timestamp language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Lima');
$$;

/** Distancia en metros (Haversine). */
create or replace function public._asis_distancia(a_lat numeric, a_lng numeric, b_lat numeric, b_lng numeric)
returns numeric language sql immutable set search_path = '' as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians((b_lat - a_lat)::float8) / 2), 2) +
    cos(radians(a_lat::float8)) * cos(radians(b_lat::float8)) * power(sin(radians((b_lng - a_lng)::float8) / 2), 2)
  ))::numeric;
$$;

/** Código de 6 dígitos de una ventana de 30 s (HMAC con el secreto de la empresa). */
create or replace function public._asis_codigo(p_empresa uuid, p_ventana bigint)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_secreto text;
  v_hash bytea;
begin
  select s.secreto into v_secreto from public.asistencia_secretos s where s.empresa_id = p_empresa;
  if v_secreto is null then
    v_secreto := encode(extensions.gen_random_bytes(32), 'hex');
    insert into public.asistencia_secretos (empresa_id, secreto) values (p_empresa, v_secreto)
    on conflict (empresa_id) do nothing;
    select s.secreto into v_secreto from public.asistencia_secretos s where s.empresa_id = p_empresa;
  end if;
  v_hash := extensions.hmac(p_ventana::text, v_secreto, 'sha256');
  return lpad(((('x' || substr(encode(v_hash, 'hex'), 1, 8))::bit(32)::bigint) % 1000000)::text, 6, '0');
end;
$$;

-- =====================================================================
-- Funciones que usa la app
-- =====================================================================

/** Código vigente para la tablet de la oficina (solo dueño, admin o Personal). */
create or replace function public.asis_codigo_oficina(p_empresa uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_seg bigint := floor(extract(epoch from now()))::bigint;
begin
  if not public.asis_es_gestor(p_empresa) then
    raise exception 'Solo el dueño o el área de Personal pueden mostrar el código' using errcode = '42501';
  end if;
  return jsonb_build_object('codigo', public._asis_codigo(p_empresa, v_seg / 30), 'segundos', 30 - (v_seg % 30));
end;
$$;

/** Guarda el horario (dueño, admin o Personal). */
create or replace function public.asis_guardar_horario(p_empresa uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_entrada time := (p_datos ->> 'entrada')::time;
  v_salida time := (p_datos ->> 'salida')::time;
  v_refrigerio int := (p_datos ->> 'refrigerio')::int;
begin
  if not public.asis_es_gestor(p_empresa) then
    raise exception 'Solo el dueño o el área de Personal cambian el horario' using errcode = '42501';
  end if;
  if v_salida <= v_entrada then
    raise exception 'La hora de salida debe ser después de la entrada.';
  end if;
  if extract(epoch from (v_salida - v_entrada)) / 60 - v_refrigerio > 480 then
    raise exception 'La jornada ordinaria no puede pasar de 8 horas diarias.';
  end if;
  insert into public.asistencia_horario as h (
    empresa_id, entrada, salida, refrigerio_min, refrigerio_desde, refrigerio_hasta, tolerancia_min,
    metodos, pedir_selfie, oficina_lat, oficina_lng, radio_oficina_m, actualizado_en
  ) values (
    p_empresa, v_entrada, v_salida, v_refrigerio,
    (p_datos ->> 'refrigerioDesde')::time, (p_datos ->> 'refrigerioHasta')::time,
    (p_datos ->> 'tolerancia')::int,
    array(select jsonb_array_elements_text(p_datos -> 'metodos')),
    coalesce((p_datos ->> 'selfie')::boolean, false),
    nullif(p_datos ->> 'oficinaLat', '')::numeric, nullif(p_datos ->> 'oficinaLng', '')::numeric,
    (p_datos ->> 'radioOficina')::int, now()
  )
  on conflict (empresa_id) do update set
    entrada = excluded.entrada, salida = excluded.salida, refrigerio_min = excluded.refrigerio_min,
    refrigerio_desde = excluded.refrigerio_desde, refrigerio_hasta = excluded.refrigerio_hasta,
    tolerancia_min = excluded.tolerancia_min, metodos = excluded.metodos, pedir_selfie = excluded.pedir_selfie,
    oficina_lat = excluded.oficina_lat, oficina_lng = excluded.oficina_lng,
    radio_oficina_m = excluded.radio_oficina_m, actualizado_en = now();
end;
$$;

/**
 * El trabajador marca su propia entrada o salida. La hora es la del servidor (Lima).
 * p_datos: { metodo: gps|codigo|declarada, lat, lng, codigo, hora (solo declarada), motivo }
 */
create or replace function public.asis_marcar(p_empresa uuid, p_datos jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_yo uuid := (select auth.uid());
  v_ahora timestamp := public._asis_ahora();
  v_fecha date := v_ahora::date;
  v_hora time := date_trunc('minute', v_ahora)::time;
  v_metodo text := p_datos ->> 'metodo';
  v_h public.asistencia_horario;
  v_m public.asistencia_marcas;
  v_lat numeric := nullif(p_datos ->> 'lat', '')::numeric;
  v_lng numeric := nullif(p_datos ->> 'lng', '')::numeric;
  v_lugar text;
  v_campo boolean := false;
  v_pendiente boolean := false;
  v_motivo text := nullif(left(trim(coalesce(p_datos ->> 'motivo', '')), 300), '');
  v_seg bigint := floor(extract(epoch from now()))::bigint;
  v_dist numeric;
begin
  if v_yo is null or not public.asis_es_miembro(p_empresa) then
    raise exception 'No perteneces a esta empresa' using errcode = '42501';
  end if;
  select * into v_h from public.asistencia_horario h where h.empresa_id = p_empresa;
  if not found then
    -- Valores por defecto mientras la empresa no guarde su horario
    v_h.metodos := '{gps,codigo,manual}';
    v_h.radio_oficina_m := 150;
  end if;

  case v_metodo
    when 'gps' then
      if not ('gps' = any (v_h.metodos)) then raise exception 'La empresa no permite marcar con GPS.'; end if;
      if v_lat is null or v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180 then
        raise exception 'No se recibió tu ubicación.';
      end if;
      if v_h.oficina_lat is null then
        raise exception 'Falta fijar la ubicación de la oficina (Asistencia · Horario y métodos).';
      end if;
      v_dist := public._asis_distancia(v_lat, v_lng, v_h.oficina_lat, v_h.oficina_lng);
      if v_dist <= v_h.radio_oficina_m then
        v_lugar := 'Oficina';
      elsif public.fin_tiene_alguna(p_empresa, '{tecnica}') then
        v_lugar := 'Campo';
        v_campo := true;
      else
        raise exception 'Estás a % m de la oficina: el personal de oficina marca dentro de ella.', round(v_dist);
      end if;
    when 'codigo' then
      if not ('codigo' = any (v_h.metodos)) then raise exception 'La empresa no permite marcar con código.'; end if;
      -- Vale el código actual o el anterior (por si cambió mientras lo escribía)
      if coalesce(p_datos ->> 'codigo', '') not in (public._asis_codigo(p_empresa, v_seg / 30), public._asis_codigo(p_empresa, v_seg / 30 - 1)) then
        raise exception 'Código incorrecto o vencido. Escribe el que ves ahora en la tablet.';
      end if;
      v_lugar := 'Oficina';
      v_lat := null;
      v_lng := null;
    when 'declarada' then
      -- Celular que falla o sin señal: el trabajador indica la hora y el motivo; lo aprueba el supervisor
      if v_motivo is null or length(v_motivo) < 5 then raise exception 'Cuenta brevemente qué pasó.'; end if;
      if coalesce(p_datos ->> 'hora', '') !~ '^\d{2}:\d{2}$' then raise exception 'Indica la hora (HH:MM).'; end if;
      v_hora := (p_datos ->> 'hora')::time;
      if v_hora > v_ahora::time + interval '5 minutes' then raise exception 'La hora no puede ser futura.'; end if;
      v_lugar := 'Sin GPS (declarada)';
      v_pendiente := true;
      v_lat := null;
      v_lng := null;
    else
      raise exception 'Forma de marcar no válida.';
  end case;

  select * into v_m from public.asistencia_marcas m
    where m.empresa_id = p_empresa and m.usuario_id = v_yo and m.fecha = v_fecha
    for update;

  if not found then
    insert into public.asistencia_marcas (empresa_id, usuario_id, fecha, entrada, metodo, lugar, lat, lng, motivo, pendiente, registrado_por)
    values (p_empresa, v_yo, v_fecha, v_hora, v_metodo, v_lugar, v_lat, v_lng, v_motivo, v_pendiente, v_yo);
    return jsonb_build_object('accion', 'entrada', 'hora', to_char(v_hora, 'HH24:MI'), 'lugar', v_lugar, 'pendiente', v_pendiente);
  end if;

  if v_m.salida is not null then
    raise exception 'Ya marcaste entrada y salida hoy.';
  end if;
  if v_hora <= v_m.entrada then
    raise exception 'La salida debe ser después de tu entrada (%).', to_char(v_m.entrada, 'HH24:MI');
  end if;
  update public.asistencia_marcas set
    salida = v_hora, metodo_salida = v_metodo, lugar_salida = v_lugar, salida_en_campo = v_campo or v_metodo = 'declarada',
    pendiente = pendiente or v_pendiente, motivo = coalesce(v_motivo, motivo)
  where id = v_m.id;
  return jsonb_build_object('accion', 'salida', 'hora', to_char(v_hora, 'HH24:MI'), 'lugar', v_lugar, 'pendiente', v_pendiente);
end;
$$;

/** El supervisor registra la entrada o salida de un trabajador (ahora mismo), con motivo. */
create or replace function public.asis_marcar_manual(p_empresa uuid, p_usuario uuid, p_motivo text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_yo uuid := (select auth.uid());
  v_ahora timestamp := public._asis_ahora();
  v_hora time := date_trunc('minute', v_ahora)::time;
  v_motivo text := nullif(left(trim(coalesce(p_motivo, '')), 300), '');
  v_h public.asistencia_horario;
  v_m public.asistencia_marcas;
begin
  if not public.asis_es_gestor(p_empresa) then
    raise exception 'Solo el dueño o el área de Personal registran marcas manuales' using errcode = '42501';
  end if;
  if not public.asis_es_miembro(p_empresa, p_usuario) then
    raise exception 'Esa persona no pertenece a la empresa.';
  end if;
  if v_motivo is null or length(v_motivo) < 5 then
    raise exception 'Escribe el motivo (queda registrado).';
  end if;
  select * into v_h from public.asistencia_horario h where h.empresa_id = p_empresa;
  if found and not ('manual' = any (v_h.metodos)) then
    raise exception 'La empresa no permite marcas manuales.';
  end if;
  select * into v_m from public.asistencia_marcas m
    where m.empresa_id = p_empresa and m.usuario_id = p_usuario and m.fecha = v_ahora::date for update;
  if not found then
    insert into public.asistencia_marcas (empresa_id, usuario_id, fecha, entrada, metodo, lugar, motivo, registrado_por, aprobado_por)
    values (p_empresa, p_usuario, v_ahora::date, v_hora, 'manual', 'Registrada por el supervisor', v_motivo, v_yo, v_yo);
    return jsonb_build_object('accion', 'entrada', 'hora', to_char(v_hora, 'HH24:MI'));
  end if;
  if v_m.salida is not null then
    raise exception 'Ya tiene entrada y salida hoy.';
  end if;
  if v_hora <= v_m.entrada then
    raise exception 'La salida debe ser después de la entrada.';
  end if;
  update public.asistencia_marcas set salida = v_hora, metodo_salida = 'manual', lugar_salida = 'Registrada por el supervisor',
    motivo = coalesce(motivo || ' · ', '') || v_motivo
  where id = v_m.id;
  return jsonb_build_object('accion', 'salida', 'hora', to_char(v_hora, 'HH24:MI'));
end;
$$;

/** Aprueba una marca declarada sin GPS. */
create or replace function public.asis_aprobar(p_empresa uuid, p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.asis_es_gestor(p_empresa) then
    raise exception 'Solo el dueño o el área de Personal aprueban marcas' using errcode = '42501';
  end if;
  update public.asistencia_marcas set pendiente = false, aprobado_por = (select auth.uid())
  where id = p_id and empresa_id = p_empresa and pendiente;
  if not found then
    raise exception 'La marca no existe o ya estaba aprobada.';
  end if;
end;
$$;

/** Registra una ausencia justificada (descanso médico, vacaciones…). */
create or replace function public.asis_registrar_ausencia(p_empresa uuid, p_usuario uuid, p_fecha date, p_tipo text, p_sustento text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.asis_es_gestor(p_empresa) then
    raise exception 'Solo el dueño o el área de Personal registran ausencias' using errcode = '42501';
  end if;
  if not public.asis_es_miembro(p_empresa, p_usuario) then
    raise exception 'Esa persona no pertenece a la empresa.';
  end if;
  insert into public.asistencia_ausencias (empresa_id, usuario_id, fecha, tipo, sustento, registrado_por)
  values (p_empresa, p_usuario, p_fecha, p_tipo, nullif(left(trim(coalesce(p_sustento, '')), 300), ''), (select auth.uid()))
  on conflict (empresa_id, usuario_id, fecha) do update set tipo = excluded.tipo, sustento = excluded.sustento;
end;
$$;

-- =====================================================================
-- Seguridad por filas y permisos
-- =====================================================================
alter table public.asistencia_horario enable row level security;
alter table public.asistencia_secretos enable row level security;
alter table public.asistencia_marcas enable row level security;
alter table public.asistencia_ausencias enable row level security;

create policy asistencia_horario_ver on public.asistencia_horario for select to authenticated
  using (public.asis_es_miembro(empresa_id));
create policy asistencia_marcas_ver on public.asistencia_marcas for select to authenticated
  using (usuario_id = (select auth.uid()) or public.asis_es_gestor(empresa_id));
create policy asistencia_ausencias_ver on public.asistencia_ausencias for select to authenticated
  using (usuario_id = (select auth.uid()) or public.asis_es_gestor(empresa_id));
-- asistencia_secretos: sin políticas = nadie la lee ni la escribe directamente

revoke all on public.asistencia_horario, public.asistencia_secretos, public.asistencia_marcas, public.asistencia_ausencias
  from public, anon, authenticated;
grant select on public.asistencia_horario, public.asistencia_marcas, public.asistencia_ausencias to authenticated;

revoke execute on function
  public.asis_es_miembro(uuid, uuid), public.asis_es_gestor(uuid), public._asis_ahora(),
  public._asis_distancia(numeric, numeric, numeric, numeric), public._asis_codigo(uuid, bigint),
  public.asis_codigo_oficina(uuid), public.asis_guardar_horario(uuid, jsonb), public.asis_marcar(uuid, jsonb),
  public.asis_marcar_manual(uuid, uuid, text), public.asis_aprobar(uuid, uuid),
  public.asis_registrar_ausencia(uuid, uuid, date, text, text)
  from public, anon;
revoke execute on function public._asis_codigo(uuid, bigint) from authenticated;
grant execute on function
  public.asis_es_miembro(uuid, uuid), public.asis_es_gestor(uuid), public._asis_ahora(),
  public._asis_distancia(numeric, numeric, numeric, numeric),
  public.asis_codigo_oficina(uuid), public.asis_guardar_horario(uuid, jsonb), public.asis_marcar(uuid, jsonb),
  public.asis_marcar_manual(uuid, uuid, text), public.asis_aprobar(uuid, uuid),
  public.asis_registrar_ausencia(uuid, uuid, date, text, text)
  to authenticated;
