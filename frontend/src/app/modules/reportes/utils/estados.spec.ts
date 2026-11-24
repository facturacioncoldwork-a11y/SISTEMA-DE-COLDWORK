import { estadoResultados, resumenTributario, situacionFinanciera, type SaldoCuenta } from './estados';

/**
 * Mes de ejemplo:
 *  1. Aporte de capital S/ 10 000 al banco          104 D / 5011 H
 *  2. Venta de servicio 1 000 + IGV 180             1212 D 1180 / 40111 H 180 / 7041 H 1000
 *  3. Compra de repuestos 500 + IGV 90              6033 D 500 / 40111 D 90 / 4212 H 590
 *  4. Cobro de la venta                             1041 D 1180 / 1212 H 1180
 */
const SALDOS: SaldoCuenta[] = [
  { cuenta: '1041', debe: 11180, haber: 0 },
  { cuenta: '1212', debe: 1180, haber: 1180 },
  { cuenta: '40111', debe: 90, haber: 180 },
  { cuenta: '4212', debe: 0, haber: 590 },
  { cuenta: '5011', debe: 0, haber: 10000 },
  { cuenta: '6033', debe: 500, haber: 0 },
  { cuenta: '7041', debe: 0, haber: 1000 },
];

describe('estadoResultados', () => {
  it('ingresos positivos, gastos negativos y resultado neto', () => {
    const er = estadoResultados(SALDOS);
    expect(er.ingresos.total).toBe(1000);
    expect(er.gastos.total).toBe(-500);
    expect(er.resultadoOperativo).toBe(500);
    expect(er.resultadoNeto).toBe(500);
    expect(er.margen).toBe(50);
  });

  it('no cuenta la 79 (cargas imputables) ni la 9', () => {
    const er = estadoResultados([...SALDOS, { cuenta: '941', debe: 500, haber: 0 }, { cuenta: '791', debe: 0, haber: 500 }]);
    expect(er.resultadoNeto).toBe(500);
  });
});

describe('situacionFinanciera', () => {
  it('cuadra: activo = pasivo + patrimonio (con el resultado del ejercicio)', () => {
    const sf = situacionFinanciera(SALDOS);
    expect(sf.totalActivo).toBe(11180);
    // IGV acreedor (180 − 90) va al pasivo
    expect(sf.pasivoCorriente.renglones[0].monto).toBe(90);
    expect(sf.totalPasivo).toBe(680);
    expect(sf.patrimonio.total).toBe(10500);
    expect(sf.diferencia).toBe(0);
  });

  it('IGV con saldo deudor (crédito fiscal) va al activo', () => {
    const sf = situacionFinanciera([
      { cuenta: '40111', debe: 90, haber: 0 },
      { cuenta: '6033', debe: 500, haber: 0 },
      { cuenta: '4212', debe: 0, haber: 590 },
    ]);
    expect(sf.activoCorriente.total).toBe(90);
    expect(sf.diferencia).toBe(0);
  });
});

describe('resumenTributario', () => {
  const base = { estado: 'registrado', moneda: 'PEN' as const, noGravada: 0, retencionRenta: 0 };
  it('IGV a pagar = débito − crédito; la boleta de compra no da crédito', () => {
    const r = resumenTributario([
      { ...base, operacion: 'venta', tipoDoc: '01', baseGravada: 1000, igv: 180 },
      { ...base, operacion: 'compra', tipoDoc: '01', baseGravada: 500, igv: 90 },
      { ...base, operacion: 'compra', tipoDoc: '03', baseGravada: 100, igv: 18 },
      { ...base, operacion: 'venta', tipoDoc: '07', baseGravada: 100, igv: 18 },
    ]);
    expect(r.igvVentas).toBe(162);
    expect(r.igvCompras).toBe(90);
    expect(r.igvResultado).toBe(72);
  });

  it('convierte dólares y suma retenciones de 4.ª', () => {
    const r = resumenTributario([
      { ...base, operacion: 'venta', tipoDoc: '01', moneda: 'USD', tipoCambio: 3.75, baseGravada: 100, igv: 18 },
      { ...base, operacion: 'compra', tipoDoc: '02', baseGravada: 0, noGravada: 2000, igv: 0, retencionRenta: 160 },
      { ...base, operacion: 'venta', tipoDoc: '01', estado: 'anulado', baseGravada: 999, igv: 179.82 },
    ]);
    expect(r.igvVentas).toBe(67.5);
    expect(r.retenciones4ta).toBe(160);
  });
});
