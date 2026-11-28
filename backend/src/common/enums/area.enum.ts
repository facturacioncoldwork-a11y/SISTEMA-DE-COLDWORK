/**
 * Áreas de trabajo a las que el dueño da acceso (igual al enum `area_empresa` de Postgres).
 * Un miembro puede tener varias. Dueño y admin entran a todas.
 */
export enum Area {
  Administracion = 'administracion',
  Contabilidad = 'contabilidad',
  Finanzas = 'finanzas',
  Ventas = 'ventas',
  Logistica = 'logistica',
  Tecnica = 'tecnica',
  Personal = 'personal',
}
