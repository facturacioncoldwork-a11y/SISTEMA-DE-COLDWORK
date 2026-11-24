import { UMBRAL_DETRACCION } from '../data/finanzas';

/**
 * Cálculos tributarios de Perú usados en los formularios.
 * La base de datos vuelve a validarlos antes de guardar.
 */

export const TASA_IGV = 0.18;
/** Retención de 4.ª categoría en recibos por honorarios. */
export const TASA_RETENCION_4TA = 0.08;
/** Se retiene si el recibo supera S/ 1 500. */
export const UMBRAL_RETENCION_4TA = 1500;

export function redondear(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function igvDe(baseGravada: number): number {
  return redondear(baseGravada * TASA_IGV);
}

/** Desde un total que incluye IGV, separa base e IGV. */
export function desglosarTotal(totalConIgv: number): { base: number; igv: number } {
  const base = redondear(totalConIgv / (1 + TASA_IGV));
  return { base, igv: redondear(totalConIgv - base) };
}

export function retencionCuarta(totalRecibo: number): number {
  return totalRecibo > UMBRAL_RETENCION_4TA ? redondear(totalRecibo * TASA_RETENCION_4TA) : 0;
}

/** Monto de detracción (SUNAT lo pide redondeado a soles, sin decimales). */
export function montoDetraccion(total: number, porcentaje: number): number {
  return Math.round((total * porcentaje) / 100);
}

export function aplicaDetraccion(totalEnSoles: number): boolean {
  return totalEnSoles > UMBRAL_DETRACCION;
}

/** Suma días a una fecha AAAA-MM-DD. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Hoy en hora local: AAAA-MM-DD. */
export function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** RUC con dígito verificador de SUNAT (módulo 11). */
export function rucValido(ruc: string): boolean {
  if (!/^(10|15|16|17|20)\d{9}$/.test(ruc)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(ruc[i]), 0);
  const resto = 11 - (suma % 11);
  return (resto === 10 ? 0 : resto === 11 ? 1 : resto) === Number(ruc[10]);
}

/** Moneda: "S/ 1,234.50" o "US$ 1,234.50". */
export function dinero(monto: number, moneda: 'PEN' | 'USD' = 'PEN'): string {
  const texto = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(monto);
  return `${moneda === 'USD' ? 'US$' : 'S/'} ${texto}`;
}
