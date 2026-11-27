/** Entidad `public.logistica_ajustes` (una fila por empresa; si no hay, valen los por defecto). */
export interface AjustesLogisticaEntity {
  empresa_id: string;
  meses_antiguedad?: number;
  /** Moneda en que se lleva el inventario (costo promedio, kardex, panel). */
  moneda?: 'PEN' | 'USD';
  /** S/ por US$: se usa en compras de otra moneda si no indican el tipo de cambio. */
  tipo_cambio_ref?: number | null;
}

/** Desde cuántos meses en almacén un producto se considera antiguo (2 años). */
export const MESES_ANTIGUEDAD_POR_DEFECTO = 24;
/** Hasta que la empresa lo cambie, el inventario se lleva en soles (como al inicio). */
export const MONEDA_INVENTARIO_POR_DEFECTO = 'PEN' as const;
