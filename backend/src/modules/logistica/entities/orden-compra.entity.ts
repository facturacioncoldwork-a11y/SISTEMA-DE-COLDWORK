export enum EstadoOc {
  Borrador = 'borrador',
  Enviada = 'enviada',
  Parcial = 'parcial',
  Recibida = 'recibida',
  Anulada = 'anulada',
}

/** Entidad `public.ordenes_compra` con proveedor, almacén e ítems (select con join). */
export interface FilaOrdenCompra {
  id: string;
  numero: number;
  estado: EstadoOc;
  fecha: string;
  plazo_texto: string | null;
  entrega_desde: string | null;
  entrega_hasta: string | null;
  fecha_llegada_real: string | null;
  cliente: string | null;
  compromiso_cliente: string | null;
  entregado_cliente: string | null;
  moneda: 'PEN' | 'USD';
  condiciones_pago: string | null;
  lugar_entrega: string | null;
  atencion: string | null;
  solicitado_por: string | null;
  cotizacion_ref: string | null;
  cotizacion_fecha: string | null;
  proyecto_id: string | null;
  proyecto_codigo: string | null;
  proyecto_nombre: string | null;
  fecha_aprobado: string | null;
  notas: string | null;
  creado_en: string;
  proveedor: {
    id: string;
    razon_social: string;
    numero_documento: string;
    direccion: string | null;
    dias_credito: number | null;
  } | null;
  almacen: { id: string; nombre: string; codigo: string } | null;
  items: {
    id: string;
    producto_id: string;
    cantidad: number;
    cantidad_recibida: number;
    costo_unitario: number;
    producto: { sku: string; nombre: string; unidad: string } | null;
  }[];
}

export const SELECT_ORDEN_COMPRA = `id, numero, estado, fecha, plazo_texto, entrega_desde, entrega_hasta, fecha_llegada_real,
  cliente, compromiso_cliente, entregado_cliente, moneda, notas, creado_en,
  condiciones_pago, lugar_entrega, atencion, solicitado_por, cotizacion_ref,
  proyecto_id, proyecto_codigo, proyecto_nombre, fecha_aprobado, cotizacion_fecha,
  proveedor:terceros!ordenes_compra_proveedor_id_fkey(id, razon_social, numero_documento, direccion, dias_credito),
  almacen:almacenes!ordenes_compra_almacen_id_fkey(id, nombre, codigo),
  items:ordenes_compra_items(id, producto_id, cantidad, cantidad_recibida, costo_unitario,
    producto:productos(sku, nombre, unidad))`;

/**
 * El mismo SELECT sin proyecto ni fecha de aprobación: lo usa la API si la base aún no tiene
 * la migración 20261129000001_oc_pagos.sql (así las órdenes de compra siguen funcionando).
 */
export const SELECT_ORDEN_COMPRA_SIN_PROYECTO = SELECT_ORDEN_COMPRA.replace(
  'proyecto_id, proyecto_codigo, proyecto_nombre, fecha_aprobado, cotizacion_fecha,',
  '',
);

/** Columnas que agrega la migración de pagos (se omiten si la base aún no las tiene). */
export const COLUMNAS_PROYECTO_OC = [
  'proyecto_id',
  'fecha_aprobado',
  'cotizacion_fecha',
] as const;

/** Columnas de la cabecera que se pueden editar (UPDATE directo). */
export interface CambiosOrdenCompra {
  proveedor_id?: string;
  almacen_id?: string;
  plazo_texto?: string | null;
  entrega_desde?: string | null;
  entrega_hasta?: string | null;
  notas?: string | null;
  cliente?: string | null;
  compromiso_cliente?: string | null;
  entregado_cliente?: string | null;
  moneda?: 'PEN' | 'USD';
  condiciones_pago?: string | null;
  lugar_entrega?: string | null;
  atencion?: string | null;
  solicitado_por?: string | null;
  cotizacion_ref?: string | null;
  proyecto_id?: string | null;
  fecha_aprobado?: string | null;
  cotizacion_fecha?: string | null;
}

/** Proyecto de Operaciones que se puede elegir al comprar (RPC proyectos_para_compras). */
export interface FilaProyectoCompra {
  id: string;
  codigo: string;
  proyecto: string;
  cliente: string | null;
  estado: 'aprobada' | 'enviada';
  fecha: string;
}

/** Número de orden en el formato de COLD WORK: año-correlativo, ej. 2026-0219. */
export function codigoOc(
  numero: number,
  fecha: string | null | undefined,
): string {
  const anio = (fecha ?? new Date().toISOString()).slice(0, 4);
  return `${anio}-${String(numero).padStart(4, '0')}`;
}
