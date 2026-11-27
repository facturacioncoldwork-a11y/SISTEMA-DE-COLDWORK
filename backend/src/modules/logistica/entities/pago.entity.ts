/** Entidad `public.oc_pagos`: una cuota del plan de pagos de una orden de compra. */
export interface FilaPago {
  id: string;
  orden_id: string;
  concepto: string;
  porcentaje: number | null;
  monto: number;
  vence: string;
  pagado_en: string | null;
  referencia: string | null;
  notas: string | null;
  /** null = fecha fija; 0 = vence al llegar; N = N días después de llegar. */
  dias_tras_llegada?: number | null;
  creado_en: string;
}

export const COLUMNAS_PAGO_BASE =
  'id, orden_id, concepto, porcentaje, monto, vence, pagado_en, referencia, notas, creado_en';
export const COLUMNAS_PAGO = `${COLUMNAS_PAGO_BASE}, dias_tras_llegada`;

/** Columnas que se escriben (insert / update). */
export interface CambiosPago {
  empresa_id?: string;
  orden_id?: string;
  concepto?: string;
  porcentaje?: number | null;
  monto?: number;
  vence?: string;
  pagado_en?: string | null;
  referencia?: string | null;
  notas?: string | null;
  dias_tras_llegada?: number | null;
}
