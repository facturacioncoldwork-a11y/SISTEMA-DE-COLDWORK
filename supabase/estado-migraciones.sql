-- =====================================================================
-- ¿Qué migraciones ya están en esta base de datos?
-- Supabase → SQL Editor → pega esto → Run.  Cada columna dice true/false.
-- Ejecuta, EN ORDEN, solo los archivos de supabase/migrations que salgan false.
-- =====================================================================
select
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'empresas')
    as "0001_base_empresas",
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invitaciones')
    as "0002_equipo_areas",
  exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'almacenes')
    as "0003_logistica",
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ordenes_compra' and column_name = 'plazo_texto')
    as "0004_plazos_crud",
  exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitaciones' and policyname = 'invitaciones_crear')
    and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitaciones' and policyname = 'invitaciones_crear' and with_check ilike '%admin%')
    as "0005_accesos_solo_dueno",
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ordenes_compra' and column_name = 'cotizacion_ref')
    as "0006_oc_formato_y_moneda";
