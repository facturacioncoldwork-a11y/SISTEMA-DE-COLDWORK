import type { Lote } from './logistica.model';

/**
 * Antigüedad del inventario: cuánto tiempo lleva cada producto en el almacén.
 * La base de datos dice qué parte del stock vino de cada llegada (PEPS: sale primero
 * lo más antiguo); aquí se decide si ya es "antiguo" y conviene venderlo.
 */

/** Por defecto: 2 años. El dueño o un admin lo cambian en el panel de almacén. */
export const MESES_ANTIGUEDAD_POR_DEFECTO = 24;

export type NivelAntiguedad = 'reciente' | 'envejeciendo' | 'antiguo';

export interface Antiguedad {
  nivel: NivelAntiguedad;
  /** Meses completos que lleva lo más antiguo (0 si no hay stock). */
  meses: number;
  /** Fecha de ingreso de lo más antiguo que queda. */
  desde: string | null;
  /** Cuánto stock pasó el límite. */
  cantidadAntigua: number;
  /** Lo que costó ese stock antiguo (S/): plata parada en el almacén. */
  valorAntiguo: number;
}

/** Meses completos entre dos fechas (como se cuentan en el calendario). */
export function mesesEntre(desde: Date, hasta: Date): number {
  let m = (hasta.getFullYear() - desde.getFullYear()) * 12 + hasta.getMonth() - desde.getMonth();
  if (hasta.getDate() < desde.getDate()) m--;
  return Math.max(0, m);
}

/** "2 años y 3 meses", "8 meses", "12 días", "hoy". */
export function textoAntiguedad(desde: string | Date, hoy = new Date()): string {
  const d = typeof desde === 'string' ? new Date(desde) : desde;
  const meses = mesesEntre(d, hoy);
  if (meses === 0) {
    const dias = Math.max(0, Math.floor((hoy.getTime() - d.getTime()) / 86_400_000));
    return dias === 0 ? 'hoy' : dias === 1 ? '1 día' : `${dias} días`;
  }
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  const txtA = a === 1 ? '1 año' : `${a} años`;
  const txtM = m === 1 ? '1 mes' : `${m} meses`;
  return a === 0 ? txtM : m === 0 ? txtA : `${txtA} y ${txtM}`;
}

/** Corto para tablas: "2a 3m", "8m", "12d". */
export function textoCorto(desde: string | Date, hoy = new Date()): string {
  const d = typeof desde === 'string' ? new Date(desde) : desde;
  const meses = mesesEntre(d, hoy);
  if (meses === 0) return `${Math.max(0, Math.floor((hoy.getTime() - d.getTime()) / 86_400_000))}d`;
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  return a === 0 ? `${m}m` : m === 0 ? `${a}a` : `${a}a ${m}m`;
}

/** Desde cuántos meses avisar que se está poniendo viejo (con 24 → a los 18). */
export function mesesAviso(limite: number): number {
  return Math.max(limite - 6, Math.ceil(limite * 0.75));
}

export function nivelAntiguedad(meses: number, limite: number): NivelAntiguedad {
  if (meses >= limite) return 'antiguo';
  if (meses >= mesesAviso(limite)) return 'envejeciendo';
  return 'reciente';
}

export function antiguedadDe(lotes: readonly Lote[], limite: number, hoy = new Date()): Antiguedad {
  const conStock = lotes.filter((l) => l.cantidad > 0);
  if (!conStock.length) {
    return { nivel: 'reciente', meses: 0, desde: null, cantidadAntigua: 0, valorAntiguo: 0 };
  }
  const masAntiguo = conStock.reduce((a, b) => (b.fecha < a.fecha ? b : a));
  const meses = mesesEntre(new Date(masAntiguo.fecha), hoy);
  let cantidadAntigua = 0;
  let valorAntiguo = 0;
  for (const l of conStock) {
    if (mesesEntre(new Date(l.fecha), hoy) >= limite) {
      cantidadAntigua += l.cantidad;
      valorAntiguo += l.cantidad * l.costoUnitario;
    }
  }
  return {
    nivel: nivelAntiguedad(meses, limite),
    meses,
    desde: masAntiguo.fecha,
    cantidadAntigua: Math.round(cantidadAntigua * 1000) / 1000,
    valorAntiguo: Math.round(valorAntiguo * 100) / 100,
  };
}

export const NIVELES_ANTIGUEDAD: Record<
  NivelAntiguedad,
  { nombre: string; color: string; icono: string }
> = {
  reciente: { nombre: 'Reciente', color: '#059669', icono: 'pi pi-check-circle' },
  envejeciendo: { nombre: 'Envejeciendo', color: '#d97706', icono: 'pi pi-clock' },
  antiguo: { nombre: 'Antiguo', color: '#dc2626', icono: 'pi pi-exclamation-triangle' },
};
