-- =====================================================================
-- COLDWORK ERP · Migración 0021 · Cuenta de detracción y CCI con guiones
-- ---------------------------------------------------------------------
-- · La cotización muestra la cuenta de detracciones (Banco de la Nación),
--   que se configura en Sistema → Configuración.
-- · El CCI se acepta como lo escriben los bancos (011-240-000100080120-97):
--   se valida que tenga 20 dígitos, con o sin guiones.
-- =====================================================================

alter table public.empresa_config
  add column cuenta_detraccion jsonb not null default '{}'::jsonb
    check (jsonb_typeof(cuenta_detraccion) = 'object');

/** ¿CCI válido? Vacío, o 20 dígitos con guiones o espacios opcionales. */
create or replace function public._cci_valido(p text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p, '') = '' or (p ~ '^[0-9 -]+$' and length(regexp_replace(p, '[^0-9]', '', 'g')) = 20);
$$;

create or replace function public.empresa_guardar_config(p_empresa uuid, p_datos jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cuenta jsonb;
  v_cuentas jsonb := '[]'::jsonb;
  v_det jsonb := coalesce(p_datos -> 'cuentaDetraccion', '{}'::jsonb);
  v_det_ok jsonb := '{}'::jsonb;
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
       or not public._cci_valido(v_cuenta ->> 'cci') then
      raise exception 'Revisa las cuentas bancarias: banco, moneda, número y CCI de 20 dígitos' using errcode = '22023';
    end if;
    v_cuentas := v_cuentas || jsonb_build_object('banco', trim(v_cuenta ->> 'banco'), 'moneda', v_cuenta ->> 'moneda',
                                                 'numero', v_cuenta ->> 'numero', 'cci', coalesce(v_cuenta ->> 'cci', ''));
  end loop;

  -- Cuenta de detracciones (opcional)
  if jsonb_typeof(v_det) = 'object' and coalesce(v_det ->> 'numero', '') <> '' then
    if (v_det ->> 'numero') !~ '^[0-9][0-9 -]{4,28}[0-9]$' or not public._cci_valido(v_det ->> 'cci') then
      raise exception 'Revisa la cuenta de detracciones' using errcode = '22023';
    end if;
    v_det_ok := jsonb_build_object('numero', v_det ->> 'numero', 'cci', coalesce(v_det ->> 'cci', ''));
  end if;

  insert into public.empresa_config as c (empresa_id, telefono, correo, web, correo_ordenes, cuentas, cuenta_detraccion,
    cot_prefijo, cot_validez_proy, cot_validez_serv, cot_detraccion, cot_notas, actualizado_por, actualizado_en)
  values (
    p_empresa,
    left(trim(coalesce(p_datos ->> 'telefono', '')), 30),
    lower(trim(coalesce(p_datos ->> 'correo', ''))),
    left(trim(coalesce(p_datos ->> 'web', '')), 120),
    lower(trim(coalesce(p_datos ->> 'correoOrdenes', ''))),
    v_cuentas,
    v_det_ok,
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
    cuentas = excluded.cuentas, cuenta_detraccion = excluded.cuenta_detraccion, cot_prefijo = excluded.cot_prefijo,
    cot_validez_proy = excluded.cot_validez_proy, cot_validez_serv = excluded.cot_validez_serv,
    cot_detraccion = excluded.cot_detraccion, cot_notas = excluded.cot_notas,
    actualizado_por = excluded.actualizado_por, actualizado_en = excluded.actualizado_en;
end;
$$;
