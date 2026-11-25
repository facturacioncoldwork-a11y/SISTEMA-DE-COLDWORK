/** Servicios técnicos: órdenes de trabajo (OT) e informes técnicos de campo. */

export type TipoServicio = 'preventivo' | 'correctivo' | 'instalacion' | 'emergencia' | 'inspeccion';
export type Prioridad = 'baja' | 'media' | 'alta' | 'urgente';
export type EstadoOrden = 'programada' | 'en_curso' | 'por_firmar' | 'cerrada';

export interface Tecnico {
  id: string;
  nombre: string;
  especialidad: string;
  /** SCTR vigente hasta (seguro obligatorio para trabajo de riesgo, Ley 26790). null = aún no registrado. */
  sctrHasta: string | null;
}

export interface Cliente {
  id: string;
  razonSocial: string;
  ruc: string;
  contacto: string;
  direccion: string;
}

export interface Equipo {
  id: string;
  clienteId: string;
  codigo: string;
  tipo: string;
  marca: string;
  modelo: string;
  serie: string;
  refrigerante: string;
  capacidad: string;
  ubicacion: string;
}

export interface Medicion {
  clave: string;
  valor: number | null;
}

export interface RepuestoUsado {
  descripcion: string;
  cantidad: number;
  unidad: string;
}

export interface Foto {
  id: string;
  etapa: 'antes' | 'durante' | 'despues';
  url: string;
  nota: string;
}

export interface Informe {
  /** Análisis de Trabajo Seguro antes de empezar (Ley 29783 de Seguridad y Salud en el Trabajo). */
  ats: Record<string, boolean>;
  mediciones: Medicion[];
  diagnostico: string;
  trabajos: string;
  repuestos: RepuestoUsado[];
  /** Refrigerante cargado o recuperado (control por el Protocolo de Montreal). */
  gasCargadoKg: number | null;
  gasRecuperadoKg: number | null;
  fotos: Foto[];
  recomendaciones: string;
  equipoOperativo: boolean | null;
  inicio?: string;
  fin?: string;
  firmaCliente?: string;
  firmaNombre?: string;
  firmaDni?: string;
}

export interface OrdenTrabajo {
  id: string;
  numero: string;
  clienteId: string;
  equipoId: string;
  tipo: TipoServicio;
  prioridad: Prioridad;
  tecnicos: string[];
  fecha: string;
  hora: string;
  descripcion: string;
  estado: EstadoOrden;
  informe: Informe;
  /** Mensajes del equipo dentro de la orden (se ven al instante en todos los celulares). */
  mensajes: Mensaje[];
}

export interface Mensaje {
  autorId: string;
  autor: string;
  texto: string;
  hora: string;
}

/** Sección del informe que alguien está editando ahora (presencia en tiempo real). */
export type SeccionInforme = 'ats' | 'mediciones' | 'trabajos' | 'fotos' | 'conformidad';
