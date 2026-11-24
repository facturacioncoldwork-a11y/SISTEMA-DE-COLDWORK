-- =====================================================================
-- ¿Qué tiene esta base de datos y qué hago?  (logística, contabilidad, finanzas y antigüedad del inventario)
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
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'conta_asientos') as m7,
    exists (select 1 from storage.buckets where id = 'comprobantes') as m8,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fin_comprobantes') as m9,
    exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'logistica_ajustes') as m11,
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
  m7 as "0007_contabilidad",
  m8 as "0008_contabilidad_comprobantes",
  m9 as "0009_finanzas",
  m11 as "0011_logistica_antiguedad",
  tipos || ' de 5' as tipos_logistica,
  tablas || ' de 9' as tablas_logistica,
  case
    when not (m1 and m2) then 'Faltan las migraciones base 0001/0002: ejecútalas primero.'
    when tipos = 0 and tablas = 0 then 'Ejecuta instalar-logistica.sql (una sola vez).'
    when not (m3 and m4 and m5 and m6 and tipos = 5 and tablas = 9) then
      'INSTALACIÓN A MEDIAS: ejecuta limpiar-logistica-incompleta.sql y después instalar-logistica.sql.'
    when m7 and m8 and m9 and m11 then 'LISTO: todo está instalado. No vuelvas a ejecutar nada.'
    else 'Logística base LISTA (no vuelvas a ejecutar instalar-logistica.sql). Ejecuta, en este orden, solo lo que falta: '
      || concat_ws(' → ',
           case when not m7 then 'migrations/20261124000001_contabilidad.sql' end,
           case when not m8 then 'migrations/20261124000002_contabilidad_comprobantes.sql' end,
           case when not m9 then 'migrations/20261125000001_finanzas.sql y 20261125000002_finanzas_ajuste.sql' end,
           case when not m11 then 'migrations/20261126000001_logistica_antiguedad.sql' end)
  end as que_hacer
from e;
