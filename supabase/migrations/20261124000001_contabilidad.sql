-- =====================================================================
-- Contabilidad: asientos (partida doble), líneas, actividad y configuración
-- =====================================================================
-- Seguridad:
--   · Leer: cualquier miembro con área "contabilidad" (dueño y admin ven todo).
--   · Escribir: SOLO por funciones (RPC) que aplican las reglas:
--       partida doble, correlativo por periodo, flujo borrador → por aprobar → registrado,
--       quién puede aprobar, anular u observar, y el registro de actividad (trazabilidad).
--   · Nadie edita un asiento registrado: se anula o se ajusta (exigencia del PLE/SUNAT).
-- =====================================================================

-- ---------- Configuración contable por empresa ----------
create table public.conta_config (
  empresa_id                uuid primary key references public.empresas (id) on delete cascade,
  regimen                   text not null default 'rmt' check (regimen in ('rmt', 'general', 'rer')),
  tramo                     text not null default 'hasta300'
                              check (tramo in ('hasta300', 'hasta500', 'hasta1700', 'mas1700')),
  contador_registra_directo boolean not null default false,
  contador_ve_libros        boolean not null default true,
  actualizado_en            timestamptz not null default now()
);

-- ---------- Asientos ----------
create table public.conta_asientos (
  id                 uuid primary key default gen_random_uuid(),
  empresa_id         uuid not null references public.empresas (id) on delete cascade,
  numero             integer not null check (numero > 0),
  periodo            text not null check (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  fecha              date not null,
  origen             text not null check (origen in ('apertura', 'diario', 'ventas', 'compras', 'caja', 'cierre')),
  glosa              text not null check (length(trim(glosa)) between 1 and 300),
  moneda             text not null default 'PEN' check (moneda in ('PEN', 'USD')),
  tipo_cambio        numeric(10, 3) check (tipo_cambio is null or tipo_cambio > 0),
  documento          jsonb,
  adjuntos           jsonb not null default '[]'::jsonb,
  estado             text not null default 'borrador'
                       check (estado in ('borrador', 'por_aprobar', 'observado', 'registrado', 'anulado')),
  observacion        text,
  creado_por         uuid references auth.users (id) on delete set null,
  creado_por_nombre  text,
  registrado_por     uuid references auth.users (id) on delete set null,
  creado_en          timestamptz not null default now(),
  actualizado_en     timestamptz not null default now(),
  unique (empresa_id, periodo, numero)
);
create index conta_asientos_empresa_periodo on public.conta_asientos (empresa_id, periodo);
create index conta_asientos_por_aprobar on public.conta_asientos (empresa_id) where estado = 'por_aprobar';

-- ---------- Líneas (cargos y abonos) ----------
create table public.conta_lineas (
  id          uuid primary key default gen_random_uuid(),
  asiento_id  uuid not null references public.conta_asientos (id) on delete cascade,
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  orden       smallint not null,
  cuenta      text not null check (cuenta ~ '^\d{3,8}$'),
  debe        numeric(14, 2) not null default 0 check (debe >= 0),
  haber       numeric(14, 2) not null default 0 check (haber >= 0),
  glosa       text,
  check (not (debe > 0 and haber > 0)),
  check (debe > 0 or haber > 0)
);
create index conta_lineas_asiento on public.conta_lineas (asiento_id);
create index conta_lineas_empresa_cuenta on public.conta_lineas (empresa_id, cuenta);

-- ---------- Actividad (quién hizo qué y cuándo) ----------
create table public.conta_actividad (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  asiento_id      uuid references public.conta_asientos (id) on delete set null,
  numero          integer,
  glosa           text,
  persona_id      uuid references auth.users (id) on delete set null,
  persona_nombre  text,
  accion          text not null
                    check (accion in ('creo', 'edito', 'envio', 'aprobo', 'observo', 'registro', 'anulo', 'elimino')),
  detalle         text,
  fecha           timestamptz not null default now()
);
create index conta_actividad_empresa_fecha on public.conta_actividad (empresa_id, fecha desc);

-- =====================================================================
-- Ayudantes
-- =====================================================================

/** Dueño o admin activo de la empresa: aprueba, anula y configura. */
create or replace function public.conta_es_aprobador(p_empresa uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.miembros m
    where m.empresa_id = p_empresa and m.usuario_id = (select auth.uid()) and m.activo
      and m.rol in ('dueno', 'admin')
  );
$$;

/** Nombre visible de quien hace la acción (perfil o correo). */
create or replace function public._conta_nombre()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(u.raw_user_meta_data ->> 'nombre', ''), u.email, 'Usuario')
  from auth.users u where u.id = (select auth.uid());
$$;

/** Exige área contabilidad; si no, error de permiso. */
create or replace function public._conta_exigir_acceso(p_empresa uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.tiene_area(p_empresa, 'contabilidad') then
    raise exception 'No tienes acceso a contabilidad' using errcode = '42501';
  end if;
end;
$$;

/** Partida doble y datos mínimos. Mensajes pensados para el usuario. */
create or replace function public._conta_validar(p_datos jsonb)
returns void language plpgsql immutable set search_path = '' as $$
declare
  v_debe numeric := 0;
  v_haber numeric := 0;
  v_lineas int := 0;
  l jsonb;
begin
  if coalesce(trim(p_datos ->> 'glosa'), '') = '' then
    raise exception 'Escribe la glosa (descripción de la operación).';
  end if;
  if p_datos ->> 'moneda' = 'USD' and coalesce((p_datos ->> 'tipoCambio')::numeric, 0) <= 0 then
    raise exception 'Indica el tipo de cambio para operaciones en dólares.';
  end if;
  for l in select * from jsonb_array_elements(coalesce(p_datos -> 'lineas', '[]'::jsonb)) loop
    v_lineas := v_lineas + 1;
    v_debe := v_debe + coalesce((l ->> 'debe')::numeric, 0);
    v_haber := v_haber + coalesce((l ->> 'haber')::numeric, 0);
  end loop;
  if v_lineas < 2 then
    raise exception 'Un asiento necesita al menos dos líneas (un cargo y un abono).';
  end if;
  if v_debe = 0 then
    raise exception 'El asiento no tiene importes.';
  end if;
  if round(v_debe, 2) <> round(v_haber, 2) then
    raise exception 'No cuadra: el Debe y el Haber difieren en %.', round(v_debe - v_haber, 2);
  end if;
end;
$$;

/** Anota en la actividad. */
create or replace function public._conta_anotar(
  p_empresa uuid, p_asiento uuid, p_numero int, p_glosa text, p_accion text, p_detalle text default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.conta_actividad (empresa_id, asiento_id, numero, glosa, persona_id, persona_nombre, accion, detalle)
  values (p_empresa, p_asiento, p_numero, p_glosa, (select auth.uid()), public._conta_nombre(), p_accion, p_detalle);
$$;

/** Reemplaza las líneas de un asiento. */
create or replace function public._conta_poner_lineas(p_empresa uuid, p_asiento uuid, p_lineas jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l jsonb;
  v_orden int := 0;
begin
  delete from public.conta_lineas where asiento_id = p_asiento;
  for l in select * from jsonb_array_elements(coalesce(p_lineas, '[]'::jsonb)) loop
    v_orden := v_orden + 1;
    insert into public.conta_lineas (asiento_id, empresa_id, orden, cuenta, debe, haber, glosa)
    values (
      p_asiento, p_empresa, v_orden, l ->> 'cuenta',
      round(coalesce((l ->> 'debe')::numeric, 0), 2), round(coalesce((l ->> 'haber')::numeric, 0), 2),
      nullif(trim(coalesce(l ->> 'glosa', '')), '')
    );
  end loop;
end;
$$;

-- =====================================================================
-- Funciones públicas (las usa la API)
-- =====================================================================

/**
 * Crea (p_id null) o corrige un asiento.
 *  p_confirmar = false → queda en borrador (o sigue observado al editar uno observado).
 *  p_confirmar = true  → valida partida doble y queda registrado (aprobador o contador con permiso)
 *                        o por aprobar (contador sin permiso).
 */
create or replace function public.conta_guardar_asiento(
  p_empresa uuid, p_id uuid, p_datos jsonb, p_confirmar boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_aprobador boolean;
  v_directo boolean;
  v_periodo text;
  v_numero int;
  v_estado text;
  v_actual public.conta_asientos;
  v_id uuid;
begin
  perform public._conta_exigir_acceso(p_empresa);
  if p_confirmar then
    perform public._conta_validar(p_datos);
  elsif coalesce(trim(p_datos ->> 'glosa'), '') = '' then
    raise exception 'Escribe la glosa (descripción de la operación).';
  end if;

  v_aprobador := public.conta_es_aprobador(p_empresa);
  select c.contador_registra_directo into v_directo from public.conta_config c where c.empresa_id = p_empresa;
  v_periodo := to_char((p_datos ->> 'fecha')::date, 'YYYY-MM');

  if p_id is not null then
    select * into v_actual from public.conta_asientos a where a.id = p_id and a.empresa_id = p_empresa for update;
    if not found then
      raise exception 'El asiento no existe.';
    end if;
    if v_actual.estado not in ('borrador', 'observado') then
      raise exception 'Este asiento ya no se puede editar.';
    end if;
    if not v_aprobador and v_actual.creado_por is distinct from (select auth.uid()) then
      raise exception 'Solo su autor o el dueño pueden editarlo.' using errcode = '42501';
    end if;
  end if;

  v_estado := case
    when not p_confirmar then coalesce(v_actual.estado, 'borrador')
    when v_aprobador or coalesce(v_directo, false) then 'registrado'
    else 'por_aprobar'
  end;

  -- Correlativo por periodo, sin huecos ni duplicados aunque dos personas guarden a la vez
  if p_id is null or v_actual.periodo <> v_periodo then
    perform pg_advisory_xact_lock(hashtextextended(p_empresa::text || v_periodo, 0));
    select coalesce(max(a.numero), 0) + 1 into v_numero
    from public.conta_asientos a where a.empresa_id = p_empresa and a.periodo = v_periodo;
  else
    v_numero := v_actual.numero;
  end if;

  if p_id is null then
    insert into public.conta_asientos (
      empresa_id, numero, periodo, fecha, origen, glosa, moneda, tipo_cambio, documento, adjuntos,
      estado, creado_por, creado_por_nombre, registrado_por
    ) values (
      p_empresa, v_numero, v_periodo, (p_datos ->> 'fecha')::date, p_datos ->> 'origen', trim(p_datos ->> 'glosa'),
      coalesce(p_datos ->> 'moneda', 'PEN'), nullif(p_datos ->> 'tipoCambio', '')::numeric,
      p_datos -> 'documento', coalesce(p_datos -> 'adjuntos', '[]'::jsonb),
      v_estado, (select auth.uid()), public._conta_nombre(),
      case when v_estado = 'registrado' then (select auth.uid()) end
    ) returning id into v_id;
  else
    update public.conta_asientos set
      numero = v_numero, periodo = v_periodo, fecha = (p_datos ->> 'fecha')::date, origen = p_datos ->> 'origen',
      glosa = trim(p_datos ->> 'glosa'), moneda = coalesce(p_datos ->> 'moneda', 'PEN'),
      tipo_cambio = nullif(p_datos ->> 'tipoCambio', '')::numeric, documento = p_datos -> 'documento',
      adjuntos = coalesce(p_datos -> 'adjuntos', '[]'::jsonb), estado = v_estado,
      observacion = case when p_confirmar then null else observacion end,
      registrado_por = case when v_estado = 'registrado' then (select auth.uid()) end,
      actualizado_en = now()
    where id = p_id
    returning id into v_id;
  end if;

  perform public._conta_poner_lineas(p_empresa, v_id, p_datos -> 'lineas');
  perform public._conta_anotar(
    p_empresa, v_id, v_numero, trim(p_datos ->> 'glosa'),
    case v_estado when 'registrado' then 'registro' when 'por_aprobar' then 'envio'
                  else case when p_id is null then 'creo' else 'edito' end end
  );
  return v_id;
end;
$$;

/**
 * Cambia el estado de un asiento:
 *  enviar    borrador/observado → por_aprobar   (autor o aprobador)
 *  registrar borrador → registrado (con permiso) · por_aprobar → registrado (aprobador = "aprobó")
 *  observar  por_aprobar → observado            (aprobador, con comentario)
 *  anular    registrado → anulado               (aprobador; el número queda en el libro)
 *  eliminar  borra un borrador                  (autor o aprobador)
 */
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

  v_aprobador := public.conta_es_aprobador(p_empresa);
  v_autor := v.creado_por = (select auth.uid());
  select c.contador_registra_directo into v_directo from public.conta_config c where c.empresa_id = p_empresa;

  -- Datos del asiento para validar la partida doble antes de enviar o registrar
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

/** Guarda la configuración contable (solo dueño o admin). */
create or replace function public.conta_guardar_config(p_empresa uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.conta_es_aprobador(p_empresa) then
    raise exception 'Solo el dueño puede cambiar la configuración contable.' using errcode = '42501';
  end if;
  insert into public.conta_config as c (
    empresa_id, regimen, tramo, contador_registra_directo, contador_ve_libros, actualizado_en
  ) values (
    p_empresa,
    coalesce(p_datos ->> 'regimen', 'rmt'),
    coalesce(p_datos ->> 'tramo', 'hasta300'),
    coalesce((p_datos ->> 'contadorRegistraDirecto')::boolean, false),
    coalesce((p_datos ->> 'contadorVeLibros')::boolean, true),
    now()
  )
  on conflict (empresa_id) do update set
    regimen = excluded.regimen, tramo = excluded.tramo,
    contador_registra_directo = excluded.contador_registra_directo,
    contador_ve_libros = excluded.contador_ve_libros, actualizado_en = now();
end;
$$;

-- =====================================================================
-- Seguridad por filas (RLS): solo lectura directa; la escritura va por las funciones
-- =====================================================================
alter table public.conta_config enable row level security;
alter table public.conta_asientos enable row level security;
alter table public.conta_lineas enable row level security;
alter table public.conta_actividad enable row level security;

create policy conta_config_ver on public.conta_config for select to authenticated
  using (public.tiene_area(empresa_id, 'contabilidad'));
create policy conta_asientos_ver on public.conta_asientos for select to authenticated
  using (public.tiene_area(empresa_id, 'contabilidad'));
create policy conta_lineas_ver on public.conta_lineas for select to authenticated
  using (public.tiene_area(empresa_id, 'contabilidad'));
create policy conta_actividad_ver on public.conta_actividad for select to authenticated
  using (public.tiene_area(empresa_id, 'contabilidad'));

revoke all on public.conta_config, public.conta_asientos, public.conta_lineas, public.conta_actividad
  from public, anon, authenticated;
grant select on public.conta_config, public.conta_asientos, public.conta_lineas, public.conta_actividad
  to authenticated;

-- Funciones: las públicas para usuarios con sesión; las internas (con "_") nadie las llama directo
revoke execute on function
  public.conta_es_aprobador(uuid), public._conta_nombre(), public._conta_exigir_acceso(uuid),
  public._conta_validar(jsonb), public._conta_anotar(uuid, uuid, int, text, text, text),
  public._conta_poner_lineas(uuid, uuid, jsonb),
  public.conta_guardar_asiento(uuid, uuid, jsonb, boolean),
  public.conta_cambiar_estado(uuid, uuid, text, text),
  public.conta_guardar_config(uuid, jsonb)
  from public, anon;
revoke execute on function
  public._conta_nombre(), public._conta_exigir_acceso(uuid), public._conta_validar(jsonb),
  public._conta_anotar(uuid, uuid, int, text, text, text), public._conta_poner_lineas(uuid, uuid, jsonb)
  from authenticated;
grant execute on function
  public.conta_es_aprobador(uuid),
  public.conta_guardar_asiento(uuid, uuid, jsonb, boolean),
  public.conta_cambiar_estado(uuid, uuid, text, text),
  public.conta_guardar_config(uuid, jsonb)
  to authenticated;

-- =====================================================================
-- En vivo: el dueño ve al instante lo que hace el contador (Supabase Realtime respeta RLS)
-- =====================================================================
alter publication supabase_realtime add table public.conta_asientos, public.conta_actividad;
