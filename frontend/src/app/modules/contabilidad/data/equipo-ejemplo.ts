import type { Actividad, Persona } from '../models/contabilidad.model';

/**
 * Personas de EJEMPLO para simular el trabajo en equipo.
 * Cuando se conecte a la base de datos saldrán de Equipo y accesos.
 */
export const DUENO: Persona = { id: 'p-dueno', nombre: 'Tú', rol: 'dueno' };
export const CONTADORA: Persona = { id: 'p-contadora', nombre: 'María Quispe', rol: 'contador' };

export const PERSONAS: Persona[] = [DUENO, CONTADORA];

export function nombrePersona(id: string | undefined): string {
  return PERSONAS.find((p) => p.id === id)?.nombre ?? '—';
}

/** Historial inicial, coherente con ASIENTOS_EJEMPLO (lo más nuevo primero). */
export const ACTIVIDAD_EJEMPLO: Actividad[] = [
  {
    id: 'act-5',
    fecha: '2026-11-19T17:10:00',
    personaId: DUENO.id,
    accion: 'observo',
    asientoId: 'ej-8',
    numero: 8,
    glosa: 'Compra de herramientas',
    detalle: 'Falta el RUC del proveedor.',
  },
  {
    id: 'act-4',
    fecha: '2026-11-19T16:45:00',
    personaId: CONTADORA.id,
    accion: 'envio',
    asientoId: 'ej-7',
    numero: 7,
    glosa: 'Instalación de cámara de congelados',
  },
  {
    id: 'act-3',
    fecha: '2026-11-19T12:00:00',
    personaId: CONTADORA.id,
    accion: 'creo',
    asientoId: 'ej-6',
    numero: 6,
    glosa: 'Pago a proveedor F001-2345',
  },
  {
    id: 'act-2',
    fecha: '2026-11-18T08:35:00',
    personaId: DUENO.id,
    accion: 'aprobo',
    asientoId: 'ej-5',
    numero: 5,
    glosa: 'Recibo de luz del taller',
  },
  {
    id: 'act-1',
    fecha: '2026-11-18T08:30:00',
    personaId: CONTADORA.id,
    accion: 'envio',
    asientoId: 'ej-5',
    numero: 5,
    glosa: 'Recibo de luz del taller',
  },
];
