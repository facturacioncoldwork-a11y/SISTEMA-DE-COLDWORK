import type { Moneda, OrdenConPagos, Pago } from './logistica.model';
import { diasEntre, sumar } from './plazos';

/**
 * Pagos a proveedores: estado de cada cuota, resumen de lo que se debe y
 * plantillas para armar el plan de pagos de una OC (adelanto, saldo, crédito).
 */

export type EstadoCuota = 'pagado' | 'vencido' | 'hoy' | 'pronto' | 'pendiente';

/** Avisa como "pronto" lo que vence en los próximos 7 días. */
export const DIAS_PRONTO = 7;
/** Las compras que llegaron hace más de esto ya no se recuerdan como "sin plan". */
export const DIAS_SIN_PLAN = 60;

export const ESTADOS_CUOTA: Record<EstadoCuota, { nombre: string; color: string; icono: string }> =
  {
    pagado: { nombre: 'Pagado', color: '#059669', icono: 'pi pi-check-circle' },
    vencido: { nombre: 'Vencido', color: '#dc2626', icono: 'pi pi-exclamation-triangle' },
    hoy: { nombre: 'Vence hoy', color: '#ea580c', icono: 'pi pi-bell' },
    pronto: { nombre: 'Vence pronto', color: '#d97706', icono: 'pi pi-clock' },
    pendiente: { nombre: 'Pendiente', color: '#64748b', icono: 'pi pi-calendar' },
  };

export function estadoCuota(p: Pick<Pago, 'vence' | 'pagadoEn'>, hoy: string): EstadoCuota {
  if (p.pagadoEn) return 'pagado';
  const d = diasEntre(hoy, p.vence);
  if (d < 0) return 'vencido';
  if (d === 0) return 'hoy';
  if (d <= DIAS_PRONTO) return 'pronto';
  return 'pendiente';
}

/** "vence en 3 días", "venció hace 2 días", "vence hoy", "pagado el 8 oct". */
export function textoVence(p: Pick<Pago, 'vence' | 'pagadoEn'>, hoy: string): string {
  if (p.pagadoEn) return 'pagado';
  const d = diasEntre(hoy, p.vence);
  if (d === 0) return 'vence hoy';
  if (d === 1) return 'vence mañana';
  if (d === -1) return 'venció ayer';
  return d > 0 ? `vence en ${d} días` : `venció hace ${-d} días`;
}

export type PorMoneda = Record<Moneda, number>;
const cero = (): PorMoneda => ({ PEN: 0, USD: 0 });
const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ResumenPagos {
  /** Todo lo que falta pagar según los planes. */
  debemos: PorMoneda;
  vencido: PorMoneda;
  cuotasVencidas: number;
  /** Vence hoy o en los próximos 7 días. */
  proximos: PorMoneda;
  cuotasProximas: number;
  pagadoMes: PorMoneda;
  /** Total de OCs que aún no tiene plan de pagos (para no olvidar armarlo). */
  sinPlan: PorMoneda;
  ordenesSinPlan: number;
}

export function resumenPagos(ordenes: readonly OrdenConPagos[], hoy: string): ResumenPagos {
  const r: ResumenPagos = {
    debemos: cero(),
    vencido: cero(),
    cuotasVencidas: 0,
    proximos: cero(),
    cuotasProximas: 0,
    pagadoMes: cero(),
    sinPlan: cero(),
    ordenesSinPlan: 0,
  };
  const mes = hoy.slice(0, 7);
  for (const o of ordenes) {
    const m = o.moneda;
    const vieja = !!o.fechaLlegadaReal && diasEntre(o.fechaLlegadaReal, hoy) > DIAS_SIN_PLAN;
    if (o.sinPlan > 0 && o.estado !== 'anulada' && !vieja) {
      r.sinPlan[m] += o.sinPlan;
      r.ordenesSinPlan++;
    }
    for (const p of o.pagos) {
      const e = estadoCuota(p, hoy);
      if (e === 'pagado') {
        if (p.pagadoEn!.startsWith(mes)) r.pagadoMes[m] += p.monto;
        continue;
      }
      r.debemos[m] += p.monto;
      if (e === 'vencido') {
        r.vencido[m] += p.monto;
        r.cuotasVencidas++;
      } else if (e === 'hoy' || e === 'pronto') {
        r.proximos[m] += p.monto;
        r.cuotasProximas++;
      }
    }
  }
  for (const k of ['debemos', 'vencido', 'proximos', 'pagadoMes', 'sinPlan'] as const) {
    r[k] = { PEN: r2(r[k].PEN), USD: r2(r[k].USD) };
  }
  return r;
}

// ─── Plantillas del plan de pagos ──────────────────────────────────

export type Plantilla = 'contado' | 'adelanto' | 'credito' | 'adelanto_credito';

export const PLANTILLAS: Record<Plantilla, { nombre: string; ayuda: string; icono: string }> = {
  contado: { nombre: 'Contado', ayuda: '100 % al aprobar la compra', icono: 'pi pi-wallet' },
  adelanto: {
    nombre: 'Adelanto y saldo',
    ayuda: 'X % al aprobar, el resto al llegar',
    icono: 'pi pi-percentage',
  },
  credito: {
    nombre: 'Crédito',
    ayuda: '100 % a N días de la llegada (factura)',
    icono: 'pi pi-calendar-clock',
  },
  adelanto_credito: {
    nombre: 'Adelanto + crédito',
    ayuda: 'X % al aprobar, el resto a N días de la llegada',
    icono: 'pi pi-sliders-h',
  },
};

export interface OpcionesPlan {
  plantilla: Plantilla;
  /** % del adelanto (adelanto y adelanto_credito). */
  adelanto: number;
  /** Días de crédito (credito y adelanto_credito). */
  dias: number;
}

/** Fechas que usa el plan: aprobación (o la de la OC) y llegada (real, estimada o aprobación). */
export function fechasDe(
  o: Pick<OrdenConPagos, 'fecha' | 'fechaAprobado' | 'entregaHasta' | 'fechaLlegadaReal'>,
) {
  const aprobado = o.fechaAprobado ?? o.fecha.slice(0, 10);
  const llegada = o.fechaLlegadaReal ?? o.entregaHasta ?? aprobado;
  return { aprobado, llegada };
}

/** Cuotas que propone la plantilla (montos en céntimos exactos: la última absorbe el redondeo). */
export function planDe(
  o: Pick<OrdenConPagos, 'fecha' | 'fechaAprobado' | 'entregaHasta' | 'fechaLlegadaReal' | 'total'>,
  op: OpcionesPlan,
): { concepto: string; porcentaje: number; monto: number; vence: string }[] {
  const { aprobado, llegada } = fechasDe(o);
  const total = Math.round(o.total * 100);
  const pct = Math.min(100, Math.max(1, Math.round(op.adelanto)));
  const dias = Math.max(0, Math.round(op.dias));
  const parte = (p: number) => Math.round((total * p) / 100);
  switch (op.plantilla) {
    case 'contado':
      return [
        { concepto: 'Pago al contado', porcentaje: 100, monto: total / 100, vence: aprobado },
      ];
    case 'credito':
      return [
        {
          concepto: `Crédito ${dias} días`,
          porcentaje: 100,
          monto: total / 100,
          vence: sumar(llegada, dias, 'dias'),
        },
      ];
    case 'adelanto':
    case 'adelanto_credito': {
      const a = parte(pct);
      const saldoVence = op.plantilla === 'adelanto' ? llegada : sumar(llegada, dias, 'dias');
      const cuotas = [
        { concepto: `Adelanto ${pct} %`, porcentaje: pct, monto: a / 100, vence: aprobado },
      ];
      if (pct < 100) {
        cuotas.push({
          concepto:
            op.plantilla === 'adelanto'
              ? `Saldo ${100 - pct} %`
              : `Saldo ${100 - pct} % (crédito ${dias} d)`,
          porcentaje: 100 - pct,
          monto: (total - a) / 100,
          vence: saldoVence,
        });
      }
      return cuotas;
    }
  }
}

export function formatoMonto(n: number, moneda: Moneda): string {
  return `${moneda === 'USD' ? 'US$' : 'S/'} ${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
