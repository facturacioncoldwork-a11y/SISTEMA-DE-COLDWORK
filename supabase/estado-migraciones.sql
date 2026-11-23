-- =====================================================================
-- ¿Qué tiene esta base de datos y qué hago?
-- Supabase → SQL Editor → pega esto → Run.  Lee la columna "que_hacer".
-- =====================================================================
with e as (
  select
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'empresas') as m1,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'invitaciones') as m2,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'almacenes') as m3,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ordenes_compra' and column_name = 'plazo_texto') as m4,
    exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitaciones' and policyname = 'invitaciones_crear')
      and not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'invitaciones' and policyname = 'invitaciones_crear' and with_check ilike '%admin%') as m5,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ordenes_compra' and column_name = 'cotizacion_ref') as m6,
    -- restos de logística (tipos o tablas sueltas)
    (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace
       where n.nspname = 'public' and t.typname in ('tipo_producto', 'tipo_almacen', 'estado_oc', 'motivo_salida', 'tipo_movimiento')) as tipos,
    (select count(*) from information_schema.tables where table_schema = 'public'
       and table_name in ('terceros', 'almacenes', 'productos', 'stock', 'ordenes_compra', 'ordenes_compra_items', 'llegadas', 'salidas', 'movimientos')) as tablas
)
select
  m1 as "0001_base_empresas",
  m2 as "0002_equipo_areas",
  m3 as "0003_logistica",
  m4 as "0004_plazos_crud",
  m5 as "0005_accesos_solo_dueno",
  m6 as "0006_oc_formato_y_moneda",
  tipos || ' de 5' as tipos_logistica,
  tablas || ' de 9' as tablas_logistica,
  case
    when not (m1 and m2) then 'Faltan las migraciones base 0001/0002: ejecútalas primero.'
    when m3 and m4 and m5 and m6 and tipos = 5 and tablas = 9 then 'LISTO: logística ya está instalada. NO vuelvas a ejecutar instalar-logistica.sql. Sigue con datos-iniciales.sql.'
    when tipos = 0 and tablas = 0 then 'Ejecuta instalar-logistica.sql (una sola vez).'
    else 'INSTALACIÓN A MEDIAS: ejecuta limpiar-logistica-incompleta.sql y después instalar-logistica.sql.'
  end as que_hacer
from e;
