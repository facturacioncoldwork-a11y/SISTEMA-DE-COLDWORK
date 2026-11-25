import type { LibroElectronico, OrigenAsiento, Regimen, TramoIngresos } from '../models/contabilidad.model';

/**
 * Tablas y reglas de SUNAT que usa el módulo.
 * Referencia para el usuario; el contador de la empresa debe confirmar cada caso.
 */

// ─── Comprobantes (Tabla 10) ─────────────────────────────────────

export const TIPOS_COMPROBANTE: { codigo: string; nombre: string }[] = [
  { codigo: '01', nombre: 'Factura' },
  { codigo: '03', nombre: 'Boleta de venta' },
  { codigo: '07', nombre: 'Nota de crédito' },
  { codigo: '08', nombre: 'Nota de débito' },
  { codigo: '02', nombre: 'Recibo por honorarios' },
  { codigo: '12', nombre: 'Ticket' },
  { codigo: '14', nombre: 'Recibo de servicios públicos' },
  { codigo: '00', nombre: 'Otros' },
];

export function nombreComprobante(codigo: string): string {
  return TIPOS_COMPROBANTE.find((t) => t.codigo === codigo)?.nombre ?? codigo;
}

// ─── Origen de los asientos ─────────────────────────────────────

export const ORIGENES: { valor: OrigenAsiento; nombre: string }[] = [
  { valor: 'apertura', nombre: 'Apertura' },
  { valor: 'diario', nombre: 'Operaciones diversas' },
  { valor: 'ventas', nombre: 'Ventas' },
  { valor: 'compras', nombre: 'Compras' },
  { valor: 'caja', nombre: 'Caja y bancos' },
  { valor: 'cierre', nombre: 'Cierre' },
];

export function nombreOrigen(origen: OrigenAsiento): string {
  return ORIGENES.find((o) => o.valor === origen)?.nombre ?? origen;
}

// ─── Impuestos ──────────────────────────────────────────────────

/** IGV 16 % + IPM 2 % (valor único en core/utils/montos). */
export { TASA_IGV } from '../../../core/utils/montos';

// ─── Libros electrónicos ────────────────────────────────────────

export const LIBROS: Record<string, LibroElectronico> = {
  ventas: {
    codigoPle: '140400',
    formato: '14.4',
    nombre: 'Registro de Ventas e Ingresos (RVIE)',
    atrasoMaximo: 'Hasta el vencimiento mensual',
    sistema: 'SIRE',
  },
  compras: {
    codigoPle: '080400',
    formato: '8.4',
    nombre: 'Registro de Compras (RCE)',
    atrasoMaximo: 'Hasta el vencimiento mensual',
    sistema: 'SIRE',
  },
  diarioSimplificado: {
    codigoPle: '050200',
    formato: '5.2',
    nombre: 'Libro Diario de formato simplificado',
    atrasoMaximo: '3 meses',
    sistema: 'PLE',
  },
  diario: { codigoPle: '050100', formato: '5.1', nombre: 'Libro Diario', atrasoMaximo: '3 meses', sistema: 'PLE' },
  mayor: { codigoPle: '060100', formato: '6.1', nombre: 'Libro Mayor', atrasoMaximo: '3 meses', sistema: 'PLE' },
  cajaBancos: {
    codigoPle: '010100',
    formato: '1.1 / 1.2',
    nombre: 'Libro Caja y Bancos',
    atrasoMaximo: '3 meses',
    sistema: 'PLE',
  },
  inventarios: {
    codigoPle: '030100',
    formato: '3.1 – 3.20',
    nombre: 'Libro de Inventarios y Balances',
    atrasoMaximo: '3 meses',
    sistema: 'PLE',
  },
};

export const REGIMENES: { valor: Regimen; nombre: string }[] = [
  { valor: 'rmt', nombre: 'Régimen MYPE Tributario' },
  { valor: 'general', nombre: 'Régimen General' },
  { valor: 'rer', nombre: 'Régimen Especial (RER)' },
];

export const TRAMOS: { valor: TramoIngresos; nombre: string }[] = [
  { valor: 'hasta300', nombre: 'Hasta 300 UIT' },
  { valor: 'hasta500', nombre: 'Más de 300 hasta 500 UIT' },
  { valor: 'hasta1700', nombre: 'Más de 500 hasta 1 700 UIT' },
  { valor: 'mas1700', nombre: 'Más de 1 700 UIT' },
];

/**
 * Libros obligatorios según régimen e ingresos brutos anuales
 * (art. 65 de la Ley del Impuesto a la Renta, aplicable también al RMT).
 */
export function librosObligatorios(regimen: Regimen, tramo: TramoIngresos): LibroElectronico[] {
  const { ventas, compras, diarioSimplificado, diario, mayor, cajaBancos, inventarios } = LIBROS;
  if (regimen === 'rer') return [ventas, compras];

  switch (tramo) {
    case 'hasta300':
      return [ventas, compras, diarioSimplificado];
    case 'hasta500':
      return [ventas, compras, diario, mayor];
    case 'hasta1700':
      return [ventas, compras, diario, mayor, cajaBancos, inventarios];
    case 'mas1700':
      return [ventas, compras, diario, mayor, cajaBancos, inventarios];
  }
}
