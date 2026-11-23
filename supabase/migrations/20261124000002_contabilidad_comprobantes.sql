-- =====================================================================
-- Contabilidad: fotos o PDF de los comprobantes (Supabase Storage)
-- =====================================================================
-- Carpeta PRIVADA "comprobantes". Cada archivo va en {empresa_id}/{...}.
-- Solo los miembros con área contabilidad de esa empresa pueden subir, ver o borrar.
-- Límite: 5 MB; solo JPG, PNG, WEBP y PDF (lo mismo que valida la pantalla).
-- SUNAT puede pedir el sustento mientras el tributo no prescriba (mínimo 5 años): no se borra solo.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy comprobantes_ver on storage.objects for select to authenticated
  using (
    bucket_id = 'comprobantes'
    and public.tiene_area(((storage.foldername(name))[1])::uuid, 'contabilidad')
  );

create policy comprobantes_subir on storage.objects for insert to authenticated
  with check (
    bucket_id = 'comprobantes'
    and public.tiene_area(((storage.foldername(name))[1])::uuid, 'contabilidad')
  );

create policy comprobantes_borrar on storage.objects for delete to authenticated
  using (
    bucket_id = 'comprobantes'
    and public.tiene_area(((storage.foldername(name))[1])::uuid, 'contabilidad')
  );
