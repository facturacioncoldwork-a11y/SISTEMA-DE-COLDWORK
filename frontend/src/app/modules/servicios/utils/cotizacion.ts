import { redondear, TASA_IGV } from '../../../core/utils/montos';
import type { Cotizacion, HitoCot, HitoPago, LineaCot, SeccionCot } from '../models/cotizacion.model';

/**
 * Cálculos de la cotización. Cada línea se redondea a céntimos ANTES de sumar
 * (así el total impreso siempre cuadra con la suma de las líneas).
 */

export function totalLinea(l: Pick<LineaCot, 'cantidad' | 'precio'>): number {
  return redondear((l.cantidad || 0) * redondear(l.precio || 0));
}

export function subtotalSeccion(s: SeccionCot): number {
  return redondear(s.lineas.reduce((t, l) => t + totalLinea(l), 0));
}

export interface TotalesCot {
  valorVenta: number;
  igv: number;
  total: number;
  costo: number;
  /** Margen sobre el valor de venta (%), solo con las líneas que tienen costo. */
  margen: number | null;
}

export function totalesCotizacion(c: Pick<Cotizacion, 'secciones'>): TotalesCot {
  const valorVenta = redondear(c.secciones.reduce((t, s) => t + subtotalSeccion(s), 0));
  const igv = redondear(valorVenta * TASA_IGV);
  const conCosto = c.secciones.flatMap((s) => s.lineas).filter((l) => l.costo !== null && l.costo !== undefined);
  const costo = redondear(conCosto.reduce((t, l) => t + (l.costo ?? 0) * l.cantidad, 0));
  const ventaConCosto = redondear(conCosto.reduce((t, l) => t + totalLinea(l), 0));
  return {
    valorVenta,
    igv,
    total: redondear(valorVenta + igv),
    costo,
    margen: ventaConCosto > 0 ? redondear(((ventaConCosto - costo) / ventaConCosto) * 100) : null,
  };
}

export function sumaHitos(hitos: HitoCot[]): number {
  return redondear(hitos.reduce((t, h) => t + (h.porcentaje || 0), 0));
}

/** Monto de cada hito sobre el total con IGV; el último absorbe la diferencia de céntimos. */
export function hitosConMonto(hitos: HitoCot[], total: number): HitoPago[] {
  let acumulado = 0;
  return hitos.map((h, i) => {
    const monto = i === hitos.length - 1 ? redondear(total - acumulado) : redondear((total * h.porcentaje) / 100);
    acumulado = redondear(acumulado + monto);
    return { ...h, monto, estado: 'pendiente' as const };
  });
}

/** "YG-PROY202600098": prefijo + serie + año + correlativo de 5 dígitos (compartido por ambas series). */
export function numeroCotizacion(serie: 'PROY' | 'SERV', anio: number, correlativo: number): string {
  return `YG-${serie}${anio}${String(correlativo).padStart(5, '0')}`;
}

/** Problemas que impiden enviar la cotización al cliente. */
export function problemasCotizacion(c: Cotizacion): string[] {
  const p: string[] = [];
  if (!c.clienteId) p.push('Elige el cliente (con su RUC).');
  if (!c.proyecto.trim()) p.push('Escribe el proyecto o servicio.');
  const lineas = c.secciones.flatMap((s) => s.lineas);
  if (!lineas.length) p.push('Agrega al menos una línea.');
  if (lineas.some((l) => !l.descripcion.trim() || l.cantidad <= 0 || l.precio < 0)) p.push('Hay líneas sin descripción, cantidad o precio.');
  if (c.hitos.length && sumaHitos(c.hitos) !== 100) p.push(`La forma de pago suma ${sumaHitos(c.hitos)} %: debe sumar 100 %.`);
  if (c.validezDias <= 0) p.push('Indica la validez de la oferta.');
  return p;
}

/** Fecha en que vence la oferta (AAAA-MM-DD). */
export function venceEl(c: Pick<Cotizacion, 'fecha' | 'validezDias'>): string {
  const d = new Date(`${c.fecha}T12:00:00`);
  d.setDate(d.getDate() + c.validezDias);
  return d.toISOString().slice(0, 10);
}
