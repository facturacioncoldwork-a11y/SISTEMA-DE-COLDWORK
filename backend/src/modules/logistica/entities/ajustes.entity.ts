/** Entidad `public.logistica_ajustes` (una fila por empresa; si no hay, valen los por defecto). */
export interface AjustesLogisticaEntity {
  empresa_id: string;
  meses_antiguedad: number;
}

/** Desde cuántos meses en almacén un producto se considera antiguo (2 años). */
export const MESES_ANTIGUEDAD_POR_DEFECTO = 24;
