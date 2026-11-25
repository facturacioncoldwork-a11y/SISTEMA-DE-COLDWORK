import type { EstadoOrden, Prioridad, TipoServicio } from '../models/servicios.model';

/** Catálogos del área técnica (refrigeración industrial, Perú). */

export const TIPOS_SERVICIO: Record<TipoServicio, { nombre: string; icono: string }> = {
  preventivo: { nombre: 'Mantenimiento preventivo', icono: 'pi pi-calendar' },
  correctivo: { nombre: 'Mantenimiento correctivo', icono: 'pi pi-wrench' },
  instalacion: { nombre: 'Instalación', icono: 'pi pi-box' },
  emergencia: { nombre: 'Emergencia', icono: 'pi pi-bolt' },
  inspeccion: { nombre: 'Inspección / diagnóstico', icono: 'pi pi-search' },
};

export const PRIORIDADES: Record<Prioridad, { nombre: string; clase: string }> = {
  baja: { nombre: 'Baja', clase: 'sin-punto' },
  media: { nombre: 'Media', clase: 'ok' },
  alta: { nombre: 'Alta', clase: 'bajo' },
  urgente: { nombre: 'Urgente', clase: 'agotado' },
};

export const ESTADOS_ORDEN: Record<EstadoOrden, { nombre: string; icono: string; clase: string }> = {
  programada: { nombre: 'Programada', icono: 'pi pi-calendar', clase: 'sin-punto' },
  en_curso: { nombre: 'En curso', icono: 'pi pi-play', clase: 'bajo' },
  por_firmar: { nombre: 'Por firmar', icono: 'pi pi-pencil', clase: 'critico' },
  cerrada: { nombre: 'Cerrada', icono: 'pi pi-check', clase: 'ok' },
};

/**
 * Análisis de Trabajo Seguro (ATS): se marca antes de empezar.
 * Ley 29783 y DS 005-2012-TR (Seguridad y Salud en el Trabajo); SCTR por Ley 26790.
 */
export const ATS = [
  { clave: 'epp', texto: 'Uso EPP completo (lentes, guantes, zapatos de seguridad, casco)' },
  { clave: 'sctr', texto: 'SCTR vigente (salud y pensión)' },
  { clave: 'loto', texto: 'Equipo desenergizado con bloqueo y etiquetado (LOTO)' },
  { clave: 'area', texto: 'Área señalizada y sin personas ajenas' },
  { clave: 'herramientas', texto: 'Herramientas y manómetros en buen estado' },
  { clave: 'altura', texto: 'Si hay trabajo en altura: arnés y línea de vida' },
  { clave: 'gas', texto: 'Ventilación y extintor cerca al manipular refrigerante' },
];

/** Mediciones de campo de un equipo de refrigeración. */
export const MEDICIONES = [
  { clave: 'presionAlta', nombre: 'Presión de alta (descarga)', unidad: 'psi' },
  { clave: 'presionBaja', nombre: 'Presión de baja (succión)', unidad: 'psi' },
  { clave: 'tempCamara', nombre: 'Temperatura de cámara', unidad: '°C' },
  { clave: 'tempAmbiente', nombre: 'Temperatura ambiente', unidad: '°C' },
  { clave: 'amperaje', nombre: 'Consumo del compresor', unidad: 'A' },
  { clave: 'voltaje', nombre: 'Voltaje de alimentación', unidad: 'V' },
];

export const TIPOS_EQUIPO = ['Cámara frigorífica', 'Chiller', 'Unidad condensadora', 'Aire acondicionado split', 'Vitrina refrigerada', 'Túnel de congelado'];
