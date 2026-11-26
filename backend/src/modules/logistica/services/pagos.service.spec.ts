import { describe, expect, it } from 'vitest';
import type { OrdenCompraDto, PagoDto } from '../dto/index.js';
import { conPlan } from './pagos.service.js';

const pago = (
  monto: number,
  pagadoEn: string | null,
  vence = '2026-10-08',
): PagoDto => ({
  id: String(monto) + vence,
  ordenId: 'oc',
  concepto: 'Cuota',
  porcentaje: null,
  monto,
  vence,
  pagadoEn,
  referencia: null,
  notas: null,
});

describe('plan de pagos de una OC', () => {
  it('pagado, pendiente y lo que aún no tiene plan', () => {
    const oc = { total: 15245.78 } as OrdenCompraDto;
    const r = conPlan(oc, [
      pago(6460.5, null, '2026-11-01'),
      pago(6460.5, '2026-10-08'),
    ]);
    expect(r.pagado).toBe(6460.5);
    expect(r.pendiente).toBe(6460.5);
    expect(r.sinPlan).toBe(2324.78);
    expect(r.pagos.map((p) => p.vence)).toEqual(['2026-10-08', '2026-11-01']);
  });
  it('si el plan cubre todo, sin plan = 0', () => {
    expect(
      conPlan({ total: 100 } as OrdenCompraDto, [pago(100, null)]).sinPlan,
    ).toBe(0);
  });
});

describe('fecha de la cotización del proveedor', () => {
  it('no acepta fechas futuras', async () => {
    const { noFutura } = await import('./ordenes-compra.service.js');
    expect(() => noFutura('2020-01-01', 'x')).not.toThrow();
    expect(() => noFutura(null, 'x')).not.toThrow();
    expect(() => noFutura('2999-01-01', 'futura')).toThrow('futura');
  });
});
