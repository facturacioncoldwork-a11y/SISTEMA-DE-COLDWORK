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
  creado_en: string;
}

export const COLUMNAS_PAGO =
  'id, orden_id, concepto, porcentaje, monto, vence, pagado_en, referencia, notas, creado_en';

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
}
