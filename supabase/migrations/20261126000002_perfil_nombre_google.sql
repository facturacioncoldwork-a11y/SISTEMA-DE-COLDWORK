-- =====================================================================
-- COLDWORK ERP · Migración 0012 · Nombre del perfil también con Google
-- ---------------------------------------------------------------------
-- Al registrarse con correo y contraseña, el nombre que la persona escribe
-- ya se guarda en perfiles.nombre. Si entra con Google, el nombre viene en
-- otro campo (full_name / name) y se guardaba la parte del correo antes de
-- la @. Ahora se usa el nombre de Google. No crea tablas.
-- =====================================================================

create or replace function public.crear_perfil_usuario()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfiles (id, nombre)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(new.email, '@', 1),
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- Corrige los perfiles ya creados con Google que quedaron con la parte del correo
update public.perfiles p
set nombre = coalesce(
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  nullif(trim(u.raw_user_meta_data ->> 'name'), '')
)
from auth.users u
where u.id = p.id
  and p.nombre = split_part(u.email, '@', 1)
  and nullif(trim(u.raw_user_meta_data ->> 'nombre'), '') is null
  and coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), '')) is not null;
