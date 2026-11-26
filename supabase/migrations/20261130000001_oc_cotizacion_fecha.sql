-- =====================================================================
-- COLDWORK ERP · Fecha de la cotización del proveedor en la orden de compra
-- ---------------------------------------------------------------------
-- La OC ya guarda el n° de la cotización del proveedor (cotizacion_ref,
-- ej. "HC 1724"); ahora también su fecha. Al importar el PDF de la
-- cotización se llena sola con la fecha que trae. No crea tablas.
-- =====================================================================

-- (que no sea futura lo valida la API)
alter table public.ordenes_compra
  add column cotizacion_fecha date;

grant update (cotizacion_fecha) on public.ordenes_compra to authenticated;
