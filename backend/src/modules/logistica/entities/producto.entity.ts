/** Tipos de producto (enum `tipo_producto` de Postgres). */
export enum TipoProducto {
  Repuesto = 'repuesto',
  GasRefrigerante = 'gas_refrigerante',
  Herramienta = 'herramienta',
  Insumo = 'insumo',
  Equipo = 'equipo',
}

/** Entidad `public.productos`. */
export class ProductoEntity {
  id!: string;
  empresa_id!: string;
  sku!: string;
  nombre!: string;
  descripcion!: string | null;
  tipo!: TipoProducto;
  marca!: string | null;
  unidad!: string;
  stock_minimo!: number;
  costo_promedio!: number;
  activo!: boolean;
  creado_en!: string;
}

/** Fila de producto con su stock por almacén (select con join). */
export interface FilaProductoStock extends ProductoEntity {
  stock: { almacen_id: string; cantidad: number }[];
}

export const COLUMNAS_PRODUCTO =
  'id, empresa_id, sku, nombre, descripcion, tipo, marca, unidad, stock_minimo, costo_promedio, activo, creado_en';

/**
 * Vista `public.stock_lotes`: qué parte del stock actual vino de cada llegada
 * (PEPS: sale primero lo más antiguo). Sirve para saber cuánto tiempo lleva.
 */
export interface LoteEntity {
  producto_id: string;
  llegada_id: string;
  llegada_numero: number;
  fecha: string;
  cantidad: number;
  costo_unitario: number;
}

export const COLUMNAS_LOTE =
  'producto_id, llegada_id, llegada_numero, fecha, cantidad, costo_unitario';

/** Entidad `public.movimientos` (kardex). */
export interface MovimientoEntity {
  id: number;
  producto_id: string;
  almacen_id: string;
  tipo: 'entrada' | 'salida';
  cantidad: number;
  costo_unitario: number;
  saldo: number;
  llegada_id: string | null;
  salida_id: string | null;
  fecha: string;
  llegada: {
    numero: number;
    guia_remision: string | null;
    proveedor: { razon_social: string } | null;
  } | null;
  salida: {
    numero: number;
    motivo: string;
    destino: string | null;
    responsable: string | null;
  } | null;
}
