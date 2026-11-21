/** Entidad `public.terceros` (aquí se usa como proveedor). */
export class TerceroEntity {
  id!: string;
  empresa_id!: string;
  tipo_documento!: 'RUC' | 'DNI' | 'CE' | 'OTRO';
  numero_documento!: string;
  razon_social!: string;
  es_proveedor!: boolean;
  es_cliente!: boolean;
  rubro!: string | null;
  contacto!: string | null;
  telefono!: string | null;
  correo!: string | null;
  direccion!: string | null;
  dias_credito!: number;
  calificacion!: number | null;
  activo!: boolean;
}

export const COLUMNAS_TERCERO =
  'id, empresa_id, tipo_documento, numero_documento, razon_social, es_proveedor, es_cliente, rubro, contacto, telefono, correo, direccion, dias_credito, calificacion, activo';
