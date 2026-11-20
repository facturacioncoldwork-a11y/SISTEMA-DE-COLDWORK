/**
 * Modelos del módulo Contabilidad.
 * Basados en el PCGE 2019 y en lo que pide SUNAT para los libros electrónicos (PLE).
 */

// ─── Plan de cuentas ────────────────────────────────────────────────

/** Deudora: aumenta por el Debe (activo, gasto). Acreedora: por el Haber (pasivo, patrimonio, ingreso). */
export type Naturaleza = 'deudora' | 'acreedora';

export interface Cuenta {
  /** Código PCGE: 2 dígitos = cuenta, 3 = subcuenta, 4+ = divisionaria. */
  codigo: string;
  nombre: string;
  /** Elemento del PCGE (1 al 9). */
  elemento: number;
  naturaleza: Naturaleza;
  /** Solo las cuentas de movimiento (el último nivel) reciben asientos. */
  movimiento: boolean;
  /** 1 = cuenta (2 dígitos), 2 = subcuenta, 3+ = divisionarias. */
  nivel: number;
}

export interface Elemento {
  numero: number;
  nombre: string;
}

// ─── Asientos ──────────────────────────────────────────────────────

/**
 * Ciclo del asiento:
 * borrador → por_aprobar → registrado   (o el contador registra directo si el dueño lo permite)
 *               ↓
 *           observado → (se corrige) → por_aprobar
 */
export type EstadoAsiento = 'borrador' | 'por_aprobar' | 'observado' | 'registrado' | 'anulado';
export type Moneda = 'PEN' | 'USD';

/** De dónde nace el asiento (luego, ventas y compras se generan solas desde sus módulos). */
export type OrigenAsiento = 'apertura' | 'diario' | 'ventas' | 'compras' | 'caja' | 'cierre';

/** Comprobante que sustenta la operación (Tabla 10 de SUNAT). */
export interface DocumentoSustento {
  tipo: string;
  serie: string;
  numero: string;
  /** RUC o DNI del cliente o proveedor. */
  documentoTercero?: string;
  nombreTercero?: string;
}

export interface LineaAsiento {
  cuenta: string;
  debe: number;
  haber: number;
  glosa?: string;
}

export interface Asiento {
  id: string;
  /** Correlativo dentro del periodo; con el periodo forma el CUO que pide el PLE. */
  numero: number;
  /** Periodo contable AAAA-MM. */
  periodo: string;
  /** Fecha de la operación AAAA-MM-DD. */
  fecha: string;
  origen: OrigenAsiento;
  glosa: string;
  moneda: Moneda;
  /** Tipo de cambio SBS del día (solo si la moneda es USD). */
  tipoCambio?: number;
  documento?: DocumentoSustento;
  lineas: LineaAsiento[];
  estado: EstadoAsiento;
  creadoEn: string;

  // Trazabilidad: quién hizo cada paso
  creadoPor: string;
  registradoPor?: string;
  /** Comentario del dueño cuando devuelve el asiento para corregir. */
  observacion?: string;
}

/** Lo que se envía para crear o corregir un asiento. */
export type NuevoAsiento = Omit<
  Asiento,
  'id' | 'numero' | 'periodo' | 'estado' | 'creadoEn' | 'creadoPor' | 'registradoPor' | 'observacion'
>;

// ─── Equipo y aprobaciones ─────────────────────────────────────────

/** Cómo entra cada persona al módulo. */
export type RolContable = 'dueno' | 'contador';

export interface Persona {
  id: string;
  nombre: string;
  rol: RolContable;
}

/** Lo que el dueño decide sobre el contador. */
export interface ConfigAprobacion {
  /** Si es true, el contador registra directo; si no, envía a aprobación. */
  contadorRegistraDirecto: boolean;
  /** Si es true, el contador consulta el Diario, el Mayor y el Balance de la empresa. */
  contadorVeLibros: boolean;
}

/** Lo que cada persona puede hacer en Contabilidad. */
export interface Permisos {
  registrar: boolean;
  aprobar: boolean;
  anular: boolean;
  configurar: boolean;
  verActividad: boolean;
  verLibros: boolean;
}

export type AccionActividad = 'creo' | 'edito' | 'envio' | 'aprobo' | 'observo' | 'registro' | 'anulo' | 'elimino';

/** Una línea del historial: quién hizo qué y cuándo. */
export interface Actividad {
  id: string;
  fecha: string;
  personaId: string;
  accion: AccionActividad;
  asientoId: string;
  numero: number;
  glosa: string;
  detalle?: string;
}

// ─── Reportes ──────────────────────────────────────────────────────

/** Movimiento de una cuenta en el Libro Mayor, con su saldo acumulado. */
export interface MovimientoMayor {
  asientoId: string;
  numero: number;
  fecha: string;
  glosa: string;
  debe: number;
  haber: number;
  saldo: number;
}

/** Fila del Balance de Comprobación. */
export interface FilaBalance {
  cuenta: string;
  nombre: string;
  sumaDebe: number;
  sumaHaber: number;
  saldoDeudor: number;
  saldoAcreedor: number;
}

// ─── Libros electrónicos ───────────────────────────────────────────

export type Regimen = 'rer' | 'rmt' | 'general';

/** Tramos de ingresos anuales (en UIT) que definen qué libros llevar. */
export type TramoIngresos = 'hasta300' | 'hasta500' | 'hasta1700' | 'mas1700';

export interface LibroElectronico {
  /** Código del libro en el PLE (ej. 050100 = Libro Diario). */
  codigoPle: string;
  formato: string;
  nombre: string;
  /** Atraso máximo permitido (R.S. 234-2006/SUNAT). */
  atrasoMaximo: string;
  /** Dónde se presenta: PLE o SIRE. */
  sistema: 'PLE' | 'SIRE';
}
