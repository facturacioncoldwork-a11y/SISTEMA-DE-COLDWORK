-- =====================================================================
-- COLDWORK · Limpiar una instalación de logística que quedó A MEDIAS
-- ---------------------------------------------------------------------
-- Úsalo SOLO si estado-migraciones.sql dice "INSTALACIÓN A MEDIAS".
-- Borra lo que exista de logística (tablas, tipos y funciones) para que
-- instalar-logistica.sql pueda correr limpio.
--
-- NO toca empresas, perfiles, miembros ni invitaciones.
-- SEGURIDAD: si alguna tabla de logística ya tiene datos, NO borra nada
-- y se detiene con un aviso (para no perder información real).
-- Después de esto: ejecuta instalar-logistica.sql.
-- =====================================================================
begin;

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['terceros', 'almacenes', 'productos', 'stock', 'ordenes_compra',
                           'ordenes_compra_items', 'llegadas', 'salidas', 'movimientos'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if n > 0 then
        raise exception 'La tabla % ya tiene % registro(s). No borro nada: escríbeme antes de seguir.', t, n;
      end if;
    end if;
  end loop;
end $$;

-- Tablas (cascade quita también sus políticas, índices y triggers)
drop table if exists public.movimientos, public.salidas, public.llegadas, public.ordenes_compra_items,
  public.ordenes_compra, public.stock, public.productos, public.almacenes, public.terceros cascade;

-- Funciones de logística
drop function if exists public.es_logistica(uuid), public.siguiente_numero(uuid, text),
  public._stock_sumar(uuid, uuid, uuid, numeric), public.crear_orden_compra(uuid, jsonb),
  public.registrar_llegada(uuid, jsonb), public.registrar_salida(uuid, jsonb),
  public.resumen_logistica(uuid), public.reemplazar_items_oc(uuid, uuid, jsonb),
  public._recalcular_oc(uuid), public._limpiar_stock(uuid),
  public.eliminar_llegada(uuid, uuid), public.eliminar_salida(uuid, uuid) cascade;
do $$ begin
  -- usa el tipo estado_oc en su firma: se borra antes que el tipo
  drop function if exists public.cambiar_estado_oc(uuid, uuid, public.estado_oc) cascade;
exception when undefined_object then null;
end $$;

-- Tipos
drop type if exists public.tipo_producto, public.tipo_almacen, public.estado_oc,
  public.motivo_salida, public.tipo_movimiento cascade;

commit;

select 'Listo: ahora ejecuta instalar-logistica.sql' as siguiente_paso;
