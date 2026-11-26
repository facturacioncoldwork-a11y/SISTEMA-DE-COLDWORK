/** Personal: trabajadores, marcas de asistencia y horario de la empresa (API /api/v1/asistencia). */

/**
 * Cómo marcó:
 *  - gps: celular con ubicación (dentro de la oficina, o en campo si es del área técnica).
 *  - codigo: número que cambia cada 30 s en la tablet de la oficina (no se puede marcar desde casa).
 *  - manual: registrado por el supervisor con motivo (queda en el historial).
 *  - declarada: el trabajador indicó la hora sin GPS (celular que falla); la aprueba el supervisor.
 */
export type MetodoMarca = 'gps' | 'codigo' | 'manual' | 'declarada';
/** Formas que la empresa puede activar. */
export type MetodoConfigurable = 'gps' | 'codigo' | 'manual';

export interface Trabajador {
  id: string;
  nombre: string;
  cargo: string;
  /** Trabaja en campo (área técnica): puede marcar desde la obra del cliente. */
  campo: boolean;
}

export interface Marca {
  id: string;
  trabajadorId: string;
  fecha: string;
  /** HH:MM (hora del servidor, Lima) */
  entrada?: string;
  salida?: string;
  metodo: MetodoMarca;
  metodoSalida?: MetodoMarca;
  lugar: string;
  lugarSalida?: string;
  motivo?: string;
  /** Marcada sin GPS: espera la aprobación del supervisor. */
  pendiente: boolean;
  /** La salida se marcó fuera de la oficina (planta del cliente, de camino a casa). */
  salidaEnCampo: boolean;
}

export type Justificacion = 'descanso_medico' | 'vacaciones' | 'permiso' | 'licencia';

export interface Ausencia {
  id: string;
  trabajadorId: string;
  fecha: string;
  tipo: Justificacion;
}

export interface Horario {
  entrada: string;
  salida: string;
  /** Minutos de refrigerio (mínimo 45, no forma parte de la jornada). Se descuenta solo: no se marca. */
  refrigerio: number;
  /** Rango en que normalmente almuerzan: solo una guía (el refrigerio se descuenta por duración). */
  refrigerioDesde: string;
  refrigerioHasta: string;
  /** Minutos de tolerancia antes de contar tardanza. */
  tolerancia: number;
  /** Jornada ordinaria diaria en minutos (máximo 8 h); se calcula del horario. */
  jornada: number;
  metodos: Record<MetodoConfigurable, boolean>;
  /** Radio de la zona de la oficina, en metros. */
  radioOficina: number;
  /** Pedir selfie al marcar (próximamente: se guardará en un bucket privado). */
  selfie: boolean;
  /** Ubicación de la oficina (se fija una vez desde "Horario y métodos" con el GPS). */
  oficina: { lat: number; lng: number } | null;
}

/** Lo que devuelve la API al marcar. */
export interface ResultadoMarca {
  accion: 'entrada' | 'salida';
  hora: string;
  lugar?: string;
  pendiente?: boolean;
}
