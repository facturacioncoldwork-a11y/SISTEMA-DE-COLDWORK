export enum TipoAlmacen {
  Principal = 'principal',
  Movil = 'movil',
  Obra = 'obra',
}

/** Entidad `public.almacenes`. */
export class AlmacenEntity {
  id!: string;
  empresa_id!: string;
  codigo!: string;
  nombre!: string;
  tipo!: TipoAlmacen;
  direccion!: string | null;
  responsable!: string | null;
  activo!: boolean;
}

export const COLUMNAS_ALMACEN =
  'id, empresa_id, codigo, nombre, tipo, direccion, responsable, activo';
