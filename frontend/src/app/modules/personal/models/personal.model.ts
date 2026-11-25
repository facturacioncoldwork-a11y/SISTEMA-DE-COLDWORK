/** Personal: trabajadores, marcas de asistencia y horario de la empresa. */

/**
 * Cómo marcó:
 *  - gps: celular con ubicación (dentro de la oficina o en la obra del cliente) + selfie.
 *  - qr: código que cambia cada 30 s en una tablet de la oficina (no se puede marcar desde casa).
 *  - manual: registrado por el supervisor con motivo (queda en el historial).
 */
export type MetodoMarca = 'gps' | 'qr' | 'manual';

export interface Trabajador {
  id: string;
  nombre: string;
  dni: string;
  cargo: string;
  /** Trabaja en campo (técnicos): puede marcar desde la obra del cliente. */
  campo: boolean;
}

export interface Marca {
  trabajadorId: string;
  fecha: string;
  /** HH:MM */
  entrada?: string;
  salida?: string;
  metodo: MetodoMarca;
  lugar: string;
  /** Dentro de la oficina o de una obra con orden de trabajo asignada. */
  dentroDeZona: boolean;
  motivoManual?: string;
}

export type Justificacion = 'descanso_medico' | 'vacaciones' | 'permiso' | 'licencia';

export interface Ausencia {
  trabajadorId: string;
  fecha: string;
  tipo: Justificacion;
}

export interface Horario {
  entrada: string;
  salida: string;
  /** Minutos de refrigerio (mínimo 45, no forma parte de la jornada). */
  refrigerio: number;
  /** Minutos de tolerancia antes de contar tardanza. */
  tolerancia: number;
  /** Jornada ordinaria diaria en minutos (máximo 8 h). */
  jornada: number;
  metodos: Record<MetodoMarca, boolean>;
  /** Radio de la zona de la oficina, en metros. */
  radioOficina: number;
  /** Pedir selfie al marcar con el celular. */
  selfie: boolean;
}
