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
  notas: string | null;
  creado_en: string;
  proveedor: {
    id: string;
    razon_social: string;
    numero_documento: string;
    direccion: string | null;
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
  proveedor:terceros!ordenes_compra_proveedor_id_fkey(id, razon_social, numero_documento, direccion),
  almacen:almacenes!ordenes_compra_almacen_id_fkey(id, nombre, codigo),
  items:ordenes_compra_items(id, producto_id, cantidad, cantidad_recibida, costo_unitario,
    producto:productos(sku, nombre, unidad))`;

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
}

/** Número de orden en el formato de COLD WORK: año-correlativo, ej. 2026-0219. */
export function codigoOc(
  numero: number,
  fecha: string | null | undefined,
): string {
  const anio = (fecha ?? new Date().toISOString()).slice(0, 4);
  return `${anio}-${String(numero).padStart(4, '0')}`;
}
