/** Filas de las tablas de contabilidad (snake_case, tal como están en Postgres). */

export const ESTADOS_ASIENTO = ['borrador', 'por_aprobar', 'observado', 'registrado', 'anulado'] as const;
export type EstadoAsiento = (typeof ESTADOS_ASIENTO)[number];

export const ORIGENES_ASIENTO = ['apertura', 'diario', 'ventas', 'compras', 'caja', 'cierre'] as const;
export type OrigenAsiento = (typeof ORIGENES_ASIENTO)[number];

export const ACCIONES_ESTADO = ['enviar', 'registrar', 'observar', 'anular', 'eliminar'] as const;
export type AccionEstado = (typeof ACCIONES_ESTADO)[number];

export interface LineaEntity {
  orden: number;
  cuenta: string;
  debe: number | string;
  haber: number | string;
  glosa: string | null;
}

export interface AsientoEntity {
  id: string;
  numero: number;
  periodo: string;
  fecha: string;
  origen: OrigenAsiento;
  glosa: string;
  moneda: 'PEN' | 'USD';
  tipo_cambio: number | string | null;
  documento: Record<string, string> | null;
  adjuntos: Record<string, unknown>[];
  estado: EstadoAsiento;
  observacion: string | null;
  creado_por: string | null;
  creado_por_nombre: string | null;
  registrado_por: string | null;
  creado_en: string;
  lineas: LineaEntity[];
}

export interface ActividadEntity {
  id: string;
  asiento_id: string | null;
  numero: number | null;
  glosa: string | null;
  persona_id: string | null;
  persona_nombre: string | null;
  accion: string;
  detalle: string | null;
  fecha: string;
}

export interface ConfigEntity {
  regimen: string;
  tramo: string;
  contador_registra_directo: boolean;
  contador_ve_libros: boolean;
}

export const COLUMNAS_ASIENTO =
  'id, numero, periodo, fecha, origen, glosa, moneda, tipo_cambio, documento, adjuntos, estado, observacion, ' +
  'creado_por, creado_por_nombre, registrado_por, creado_en, ' +
  'lineas:conta_lineas(orden, cuenta, debe, haber, glosa)';

export const COLUMNAS_ACTIVIDAD = 'id, asiento_id, numero, glosa, persona_id, persona_nombre, accion, detalle, fecha';

export const COLUMNAS_CONFIG = 'regimen, tramo, contador_registra_directo, contador_ve_libros';
