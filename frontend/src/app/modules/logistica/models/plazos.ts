/**
 * Plazos de entrega de proveedores.
 *
 * El proveedor puede decir "2-3 semanas", "1 mes", "15 días" o una fecha
 * exacta. Aquí se convierte eso en una VENTANA de fechas (desde..hasta)
 * contando desde la fecha de la orden, y se calcula el seguimiento:
 * cuánto falta, si ya está atrasado y si llegamos a tiempo con el cliente.
 */

export type UnidadPlazo = 'dias' | 'semanas' | 'meses';

export interface Plazo {
  min: number;
  max: number;
  unidad: UnidadPlazo;
}

export const NOMBRE_UNIDAD: Record<UnidadPlazo, [string, string]> = {
  dias: ['día', 'días'],
  semanas: ['semana', 'semanas'],
  meses: ['mes', 'meses'],
};

/** Atajos que más se escuchan de los proveedores. */
export const PLAZOS_RAPIDOS: { texto: string; plazo: Plazo }[] = [
  { texto: '3-5 días', plazo: { min: 3, max: 5, unidad: 'dias' } },
  { texto: '1 semana', plazo: { min: 1, max: 1, unidad: 'semanas' } },
  { texto: '2-3 semanas', plazo: { min: 2, max: 3, unidad: 'semanas' } },
  { texto: '1 mes', plazo: { min: 1, max: 1, unidad: 'meses' } },
  { texto: '1-2 meses', plazo: { min: 1, max: 2, unidad: 'meses' } },
  { texto: '2-3 meses', plazo: { min: 2, max: 3, unidad: 'meses' } },
];

// ---------- Fechas como 'YYYY-MM-DD' (sin horas ni zona) ----------

export function hoyISO(): string {
  const d = new Date();
  return aISO(d);
}

export function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function deISO(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sumar(base: string, n: number, unidad: UnidadPlazo): string {
  const d = deISO(base);
  if (unidad === 'dias') d.setDate(d.getDate() + n);
  if (unidad === 'semanas') d.setDate(d.getDate() + n * 7);
  if (unidad === 'meses') {
    const dia = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    // 31 ene + 1 mes = 28/29 feb, no 3 mar
    d.setDate(Math.min(dia, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return aISO(d);
}

/** Días entre dos fechas (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((deISO(b).getTime() - deISO(a).getTime()) / 86_400_000);
}

// ---------- Texto ↔ plazo ----------

export function textoPlazo(p: Plazo): string {
  const [uno, varios] = NOMBRE_UNIDAD[p.unidad];
  if (p.min === p.max) return `${p.min} ${p.min === 1 ? uno : varios}`;
  return `${p.min}-${p.max} ${varios}`;
}

/**
 * Entiende lo que se escribe tal cual lo dice el proveedor:
 * "2-3 semanas", "2 a 3 semanas", "15 dias", "1 mes", "entre 1 y 2 meses", "3 sem".
 */
export function leerPlazo(texto: string): Plazo | null {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const m = t.match(/(\d+)\s*(?:-|a|y|al|hasta)?\s*(\d+)?\s*(d|sem|mes)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  const unidad: UnidadPlazo = m[3].startsWith('d')
    ? 'dias'
    : m[3].startsWith('sem')
      ? 'semanas'
      : 'meses';
  if (!a || a > 400 || b > 400) return null;
  return { min: Math.min(a, b), max: Math.max(a, b), unidad };
}

/** Ventana de llegada contando desde la fecha de la orden. */
export function ventana(base: string, p: Plazo): { desde: string; hasta: string } {
  return { desde: sumar(base, p.min, p.unidad), hasta: sumar(base, p.max, p.unidad) };
}

// ---------- Seguimiento ----------

export type EstadoLlegada =
  'sin_fecha' | 'a_tiempo' | 'esta_semana' | 'en_ventana' | 'atrasada' | 'llego';
export type EstadoCliente = 'sin_compromiso' | 'ok' | 'justo' | 'riesgo' | 'vencido' | 'entregado';

export interface Seguimiento {
  llegada: EstadoLlegada;
  /** Texto corto para chips: "Llega en 5-12 días", "Atrasada 3 días", "Llegó 19 nov". */
  textoLlegada: string;
  /** Días hasta el inicio de la ventana (negativo = ya pasó). */
  faltan: number | null;
  cliente: EstadoCliente;
  textoCliente: string;
  /** Holgura entre la llegada estimada (fin de ventana) y lo prometido al cliente. */
  holgura: number | null;
}

interface DatosSeguimiento {
  estado: string;
  entregaDesde: string | null;
  entregaHasta: string | null;
  fechaLlegadaReal: string | null;
  compromisoCliente: string | null;
  entregadoCliente: string | null;
}

const COLOR_LLEGADA: Record<EstadoLlegada, string> = {
  sin_fecha: '#64748b',
  a_tiempo: '#0ea5e9',
  esta_semana: '#6366f1',
  en_ventana: '#f59e0b',
  atrasada: '#dc2626',
  llego: '#059669',
};
const COLOR_CLIENTE: Record<EstadoCliente, string> = {
  sin_compromiso: '#64748b',
  ok: '#059669',
  justo: '#f59e0b',
  riesgo: '#ea580c',
  vencido: '#dc2626',
  entregado: '#059669',
};
export const colorLlegada = (e: EstadoLlegada) => COLOR_LLEGADA[e];
export const colorCliente = (e: EstadoCliente) => COLOR_CLIENTE[e];

const plural = (n: number) => (Math.abs(n) === 1 ? 'día' : 'días');
const corta = (s: string) =>
  deISO(s).toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });

export function seguimiento(o: DatosSeguimiento, hoy = hoyISO()): Seguimiento {
  // ¿Cuándo llega?
  let llegada: EstadoLlegada;
  let textoLlegada: string;
  let faltan: number | null = null;
  if (o.fechaLlegadaReal || o.estado === 'recibida') {
    llegada = 'llego';
    textoLlegada = o.fechaLlegadaReal ? `Llegó el ${corta(o.fechaLlegadaReal)}` : 'Llegó';
  } else if (!o.entregaHasta) {
    llegada = 'sin_fecha';
    textoLlegada = 'Sin fecha de entrega';
  } else {
    const desde = o.entregaDesde ?? o.entregaHasta;
    faltan = diasEntre(hoy, desde);
    const hastaFin = diasEntre(hoy, o.entregaHasta);
    if (hastaFin < 0) {
      llegada = 'atrasada';
      textoLlegada = `Atrasada ${-hastaFin} ${plural(hastaFin)}`;
    } else if (faltan <= 0) {
      llegada = 'en_ventana';
      textoLlegada =
        hastaFin === 0 ? 'Debe llegar hoy' : `Puede llegar ya · hasta ${corta(o.entregaHasta)}`;
    } else {
      llegada = faltan <= 7 ? 'esta_semana' : 'a_tiempo';
      textoLlegada =
        desde === o.entregaHasta
          ? `Llega en ${faltan} ${plural(faltan)}`
          : `Llega en ${faltan}-${hastaFin} días`;
    }
  }

  // ¿Llegamos con el cliente?
  let cliente: EstadoCliente;
  let textoCliente: string;
  let holgura: number | null = null;
  if (o.entregadoCliente) {
    cliente = 'entregado';
    textoCliente = `Entregado al cliente el ${corta(o.entregadoCliente)}`;
  } else if (!o.compromisoCliente) {
    cliente = 'sin_compromiso';
    textoCliente = 'Sin fecha prometida al cliente';
  } else {
    const llega = o.fechaLlegadaReal ?? o.entregaHasta;
    const paraCliente = diasEntre(hoy, o.compromisoCliente);
    holgura = llega ? diasEntre(llega, o.compromisoCliente) : null;
    if (paraCliente < 0) {
      cliente = 'vencido';
      textoCliente = `Compromiso vencido hace ${-paraCliente} ${plural(paraCliente)}`;
    } else if (holgura === null) {
      cliente = 'justo';
      textoCliente = `Prometido para el ${corta(o.compromisoCliente)} (sin fecha del proveedor)`;
    } else if (holgura < 0) {
      cliente = 'riesgo';
      textoCliente = `Riesgo: puede llegar ${-holgura} ${plural(holgura)} después de lo prometido`;
    } else if (holgura <= 2) {
      cliente = 'justo';
      textoCliente = `Justo: ${holgura} ${plural(holgura)} de margen para entregar`;
    } else {
      cliente = 'ok';
      textoCliente = `A tiempo: ${holgura} días de margen antes del ${corta(o.compromisoCliente)}`;
    }
  }
  return { llegada, textoLlegada, faltan, cliente, textoCliente, holgura };
}
