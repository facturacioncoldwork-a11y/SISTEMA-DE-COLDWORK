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
