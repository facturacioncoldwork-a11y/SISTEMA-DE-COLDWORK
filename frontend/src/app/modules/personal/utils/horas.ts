import type { Horario, Marca } from '../models/personal.model';

/**
 * Cálculo de horas según las normas de Perú:
 *  - Jornada máxima 8 h diarias / 48 h semanales (DS 007-2002-TR).
 *  - El refrigerio (mínimo 45 min) no forma parte de la jornada.
 *  - Horas extra: sobretasa de 25 % las dos primeras y 35 % desde la tercera.
 *  - Tardanza: llegada después de la hora de entrada más la tolerancia.
 */

export function aMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function aHoras(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

export interface ResumenDia {
  trabajados: number;
  normales: number;
  extra25: number;
  extra35: number;
  tardanza: number;
}

export function resumenDia(marca: Pick<Marca, 'entrada' | 'salida'>, h: Horario): ResumenDia {
  const vacio = { trabajados: 0, normales: 0, extra25: 0, extra35: 0, tardanza: 0 };
  if (!marca.entrada) return vacio;
  const entrada = aMinutos(marca.entrada);
  const retraso = entrada - aMinutos(h.entrada);
  const tardanza = retraso > h.tolerancia ? retraso : 0;
  if (!marca.salida) return { ...vacio, tardanza };

  const bruto = aMinutos(marca.salida) - entrada;
  // El refrigerio solo se descuenta si la jornada lo incluye (más de 4 h)
  const trabajados = Math.max(0, bruto - (bruto > 240 ? h.refrigerio : 0));
  const normales = Math.min(trabajados, h.jornada);
  const extra = Math.max(0, trabajados - h.jornada);
  // Se cuentan desde los 10 min para no pagar segundos de demora al salir
  const extraPagable = extra >= 10 ? extra : 0;
  const extra25 = Math.min(extraPagable, 120);
  return { trabajados, normales, extra25, extra35: extraPagable - extra25, tardanza };
}

/** Distancia en metros entre dos puntos GPS (fórmula de Haversine). */
export function distanciaMetros(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = 6_371_000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

/** Código de 6 dígitos que cambia cada 30 s (para la tablet de la oficina). */
export function codigoDelMomento(semilla: string, ahora = Date.now()): string {
  const ventana = Math.floor(ahora / 30_000);
  let h = 2166136261;
  for (const c of `${semilla}:${ventana}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return String(Math.abs(h) % 1_000_000).padStart(6, '0');
}
