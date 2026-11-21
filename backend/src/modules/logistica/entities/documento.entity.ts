export enum MotivoSalida {
  ServicioTecnico = 'servicio_tecnico',
  Venta = 'venta',
  ConsumoInterno = 'consumo_interno',
  Merma = 'merma',
  Transferencia = 'transferencia',
}

/** Movimiento de un documento (llegada o salida) con su producto. */
interface FilaLinea {
  producto_id: string;
  almacen_id: string;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  costo_unitario: number;
  producto: { sku: string; nombre: string; unidad: string } | null;
}

/** `public.llegadas` con proveedor, almacén, OC y líneas del kardex. */
export interface FilaLlegada {
  id: string;
  numero: number;
  fecha: string;
  guia_remision: string | null;
  comprobante: string | null;
  notas: string | null;
  almacen: { id: string; nombre: string } | null;
  proveedor: { id: string; razon_social: string } | null;
  orden: { id: string; numero: number; fecha: string } | null;
  moneda: 'PEN' | 'USD';
  tipo_cambio: number | null;
  lineas: FilaLinea[];
}

export const SELECT_LLEGADA = `id, numero, fecha, guia_remision, comprobante, notas, moneda, tipo_cambio,
  almacen:almacenes(id, nombre),
  proveedor:terceros(id, razon_social),
  orden:ordenes_compra(id, numero, fecha),
  lineas:movimientos(producto_id, almacen_id, tipo, cantidad, costo_unitario, producto:productos(sku, nombre, unidad))`;

/** `public.salidas` con almacenes y líneas del kardex. */
export interface FilaSalida {
  id: string;
  numero: number;
  fecha: string;
  motivo: MotivoSalida;
  destino: string | null;
  responsable: string | null;
  referencia: string | null;
  notas: string | null;
  almacen: { id: string; nombre: string } | null;
  almacen_destino: { id: string; nombre: string } | null;
  lineas: FilaLinea[];
}

export const SELECT_SALIDA = `id, numero, fecha, motivo, destino, responsable, referencia, notas,
  almacen:almacenes!salidas_almacen_id_fkey(id, nombre),
  almacen_destino:almacenes!salidas_almacen_destino_id_fkey(id, nombre),
  lineas:movimientos(producto_id, almacen_id, tipo, cantidad, costo_unitario, producto:productos(sku, nombre, unidad))`;
