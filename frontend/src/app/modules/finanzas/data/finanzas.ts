import type { MedioPago, Operacion, TipoCuenta, TipoMovimiento } from '../models/finanzas.model';

/**
 * Catálogos del módulo Finanzas, según las reglas de Perú.
 * Referencia para el usuario: el contador de la empresa confirma cada caso.
 */

// ─── Comprobantes (Tabla 10 SUNAT) por operación ─────────────────

export const TIPOS_DOC: Record<Operacion, { codigo: string; nombre: string }[]> = {
  venta: [
    { codigo: '01', nombre: 'Factura' },
    { codigo: '03', nombre: 'Boleta de venta' },
    { codigo: '07', nombre: 'Nota de crédito' },
    { codigo: '08', nombre: 'Nota de débito' },
  ],
  compra: [
    { codigo: '01', nombre: 'Factura' },
    { codigo: '03', nombre: 'Boleta de venta' },
    { codigo: '02', nombre: 'Recibo por honorarios' },
    { codigo: '14', nombre: 'Recibo de servicios públicos' },
    { codigo: '12', nombre: 'Ticket' },
    { codigo: '07', nombre: 'Nota de crédito' },
    { codigo: '08', nombre: 'Nota de débito' },
    { codigo: '00', nombre: 'Otros' },
  ],
};

export function nombreTipoDoc(codigo: string): string {
  return [...TIPOS_DOC.venta, ...TIPOS_DOC.compra].find((t) => t.codigo === codigo)?.nombre ?? codigo;
}

// ─── Cuenta contable sugerida (PCGE) ─────────────────────────────

/** Cuenta de ingreso de una venta. */
export const CUENTAS_VENTA = [
  { codigo: '7041', nombre: 'Prestación de servicios (mantenimiento, instalación)' },
  { codigo: '7011', nombre: 'Venta de mercaderías (equipos, repuestos)' },
  { codigo: '759', nombre: 'Otros ingresos de gestión' },
];

/** A qué gasto o activo va una compra. */
export const CUENTAS_COMPRA = [
  { codigo: '6033', nombre: 'Repuestos (compresores, válvulas, cobre…)' },
  { codigo: '6032', nombre: 'Suministros (gas refrigerante, consumibles)' },
  { codigo: '601', nombre: 'Mercaderías para vender' },
  { codigo: '634', nombre: 'Mantenimiento y reparaciones' },
  { codigo: '631', nombre: 'Transporte y viajes' },
  { codigo: '632', nombre: 'Honorarios (recibos por honorarios)' },
  { codigo: '635', nombre: 'Alquileres' },
  { codigo: '6361', nombre: 'Energía eléctrica' },
  { codigo: '6363', nombre: 'Agua' },
  { codigo: '6364', nombre: 'Teléfono e internet' },
  { codigo: '659', nombre: 'Otros gastos de gestión' },
  { codigo: '333', nombre: 'Maquinaria y equipo (activo fijo)' },
  { codigo: '3361', nombre: 'Equipo de cómputo (activo fijo)' },
];

/** Contrapartidas frecuentes para ingresos o egresos de caja sin comprobante. */
export const CONTRAPARTIDAS = [
  { codigo: '5011', nombre: 'Aporte de capital de los socios', para: 'ingreso' as const },
  { codigo: '451', nombre: 'Préstamo bancario recibido', para: 'ingreso' as const },
  { codigo: '759', nombre: 'Otros ingresos', para: 'ingreso' as const },
  { codigo: '40111', nombre: 'Pago de IGV a SUNAT', para: 'egreso' as const },
  { codigo: '40171', nombre: 'Pago a cuenta de renta (3.ª categoría)', para: 'egreso' as const },
  { codigo: '40172', nombre: 'Pago de retenciones de 4.ª categoría', para: 'egreso' as const },
  { codigo: '4031', nombre: 'Pago de ESSALUD', para: 'egreso' as const },
  { codigo: '4111', nombre: 'Pago de sueldos', para: 'egreso' as const },
  { codigo: '451', nombre: 'Pago de cuota de préstamo', para: 'egreso' as const },
  { codigo: '6591', nombre: 'Gastos menores sin comprobante (caja chica)', para: 'egreso' as const },
];

// ─── Detracciones (SPOT) ─────────────────────────────────────────

/** Se aplica si el total de la operación supera S/ 700. */
export const UMBRAL_DETRACCION = 700;

export const DETRACCIONES = [
  { porcentaje: 0, nombre: 'No aplica' },
  { porcentaje: 12, nombre: '12 % · Mantenimiento y reparación, demás servicios' },
  { porcentaje: 10, nombre: '10 % · Arrendamiento de bienes' },
  { porcentaje: 4, nombre: '4 % · Contratos de construcción' },
];

// ─── Caja y bancos ───────────────────────────────────────────────

export const TIPOS_CUENTA: { valor: TipoCuenta; nombre: string; icono: string; cuenta: string }[] = [
  { valor: 'banco', nombre: 'Cuenta bancaria', icono: 'pi pi-building', cuenta: '1041' },
  { valor: 'caja', nombre: 'Caja (efectivo)', icono: 'pi pi-wallet', cuenta: '101' },
  { valor: 'detracciones', nombre: 'Detracciones · Banco de la Nación', icono: 'pi pi-lock', cuenta: '1042' },
];

export const MEDIOS: { valor: MedioPago; nombre: string }[] = [
  { valor: 'transferencia', nombre: 'Transferencia' },
  { valor: 'deposito', nombre: 'Depósito' },
  { valor: 'efectivo', nombre: 'Efectivo' },
  { valor: 'yape_plin', nombre: 'Yape / Plin' },
  { valor: 'cheque', nombre: 'Cheque' },
  { valor: 'tarjeta', nombre: 'Tarjeta' },
  { valor: 'otro', nombre: 'Otro' },
];

export const TIPOS_MOVIMIENTO: Record<TipoMovimiento, { nombre: string; icono: string; entra: boolean }> = {
  cobro: { nombre: 'Cobro a cliente', icono: 'pi pi-arrow-down-left', entra: true },
  pago: { nombre: 'Pago a proveedor', icono: 'pi pi-arrow-up-right', entra: false },
  ingreso: { nombre: 'Otro ingreso', icono: 'pi pi-plus-circle', entra: true },
  egreso: { nombre: 'Otro egreso', icono: 'pi pi-minus-circle', entra: false },
  transferencia: { nombre: 'Transferencia', icono: 'pi pi-arrow-right-arrow-left', entra: false },
};

export const TRAMOS: Record<string, { nombre: string; clase: string }> = {
  por_vencer: { nombre: 'Por vencer', clase: 'ok' },
  '1-30': { nombre: '1 a 30 días', clase: 'bajo' },
  '31-60': { nombre: '31 a 60 días', clase: 'critico' },
  '61-90': { nombre: '61 a 90 días', clase: 'agotado' },
  mas_90: { nombre: 'Más de 90 días', clase: 'agotado' },
};
