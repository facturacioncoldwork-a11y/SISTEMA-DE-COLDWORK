import { describe, expect, it } from 'vitest';
import type { OrdenConPagos, Pago } from './logistica.model';
import { estadoCuota, planDe, resumenPagos, textoVence } from './pagos';

const HOY = '2026-11-26';
const pago = (monto: number, vence: string, pagadoEn: string | null = null): Pago => ({
  id: vence + monto,
  ordenId: 'oc',
  concepto: 'Cuota',
  porcentaje: null,
  monto,
  vence,
  pagadoEn,
  referencia: null,
  notas: null,
});
const oc = (o: Partial<OrdenConPagos>): OrdenConPagos =>
  ({
    moneda: 'USD',
    estado: 'enviada',
    fecha: '2026-10-07T10:00:00Z',
    fechaAprobado: '2026-10-07',
    entregaHasta: '2026-11-01',
    fechaLlegadaReal: null,
    total: 12921,
    pagos: [],
    pagado: 0,
    pendiente: 0,
    sinPlan: 0,
    ...o,
  }) as OrdenConPagos;

describe('pagos a proveedores', () => {
  it('estado de cada cuota según la fecha', () => {
    expect(estadoCuota(pago(1, '2026-11-20', '2026-11-20'), HOY)).toBe('pagado');
    expect(estadoCuota(pago(1, '2026-11-25'), HOY)).toBe('vencido');
    expect(estadoCuota(pago(1, HOY), HOY)).toBe('hoy');
    expect(estadoCuota(pago(1, '2026-12-02'), HOY)).toBe('pronto');
    expect(estadoCuota(pago(1, '2026-12-20'), HOY)).toBe('pendiente');
    expect(textoVence(pago(1, '2026-11-27'), HOY)).toBe('vence mañana');
    expect(textoVence(pago(1, '2026-11-23'), HOY)).toBe('venció hace 3 días');
  });

  it('resumen: lo que se debe, vencido y próximo, separado por moneda', () => {
    const r = resumenPagos(
      [
        oc({ pagos: [pago(6460.5, '2026-10-08', '2026-11-03'), pago(6460.5, '2026-11-20')] }),
        oc({ moneda: 'PEN', pagos: [pago(1000, '2026-11-30')], sinPlan: 500 }),
      ],
      HOY,
    );
    expect(r.debemos).toEqual({ USD: 6460.5, PEN: 1000 });
    expect(r.vencido.USD).toBe(6460.5);
    expect(r.cuotasVencidas).toBe(1);
    expect(r.proximos.PEN).toBe(1000);
    expect(r.pagadoMes.USD).toBe(6460.5);
    expect(r.ordenesSinPlan).toBe(1);
  });

  it('plantillas: 50 % al aprobar y saldo al llegar, sin perder céntimos', () => {
    const cuotas = planDe(oc({ total: 12921.01 }), {
      plantilla: 'adelanto',
      adelanto: 50,
      dias: 0,
    });
    expect(cuotas.map((c) => c.vence)).toEqual(['2026-10-07', '2026-11-01']);
    expect(cuotas[0].monto + cuotas[1].monto).toBeCloseTo(12921.01, 2);
  });

  it('plantillas: crédito a 30 días de la llegada real', () => {
    const [c] = planDe(oc({ fechaLlegadaReal: '2026-11-05' }), {
      plantilla: 'credito',
      adelanto: 0,
      dias: 30,
    });
    expect(c.vence).toBe('2026-12-05');
    expect(c.monto).toBe(12921);
  });
});
