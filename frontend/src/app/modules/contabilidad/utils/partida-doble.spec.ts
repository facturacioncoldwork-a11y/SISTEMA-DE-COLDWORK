import { PCGE } from '../data/pcge';
import type { Asiento, NuevoAsiento } from '../models/contabilidad.model';
import { balanceComprobacion, mayorDeCuenta, redondear, saldo, totales, validarAsiento } from './partida-doble';

const CUENTAS = new Map(PCGE.map((c) => [c.codigo, c]));

function nuevo(lineas: NuevoAsiento['lineas'], extra: Partial<NuevoAsiento> = {}): NuevoAsiento {
  return { fecha: '2026-11-05', origen: 'diario', glosa: 'Prueba', moneda: 'PEN', lineas, ...extra };
}

function asiento(numero: number, lineas: Asiento['lineas'], estado: Asiento['estado'] = 'registrado'): Asiento {
  return { ...nuevo(lineas), id: `a${numero}`, numero, periodo: '2026-11', estado, creadoEn: '' };
}

describe('partida doble', () => {
  it('redondea a céntimos', () => {
    expect(redondear(0.1 + 0.2)).toBe(0.3);
    expect(redondear(1.005)).toBe(1.01);
  });

  it('suma debe y haber', () => {
    expect(totales([{ cuenta: '1041', debe: 100.1, haber: 0 }, { cuenta: '5011', debe: 0, haber: 100.1 }])).toEqual({
      debe: 100.1,
      haber: 100.1,
      diferencia: 0,
    });
  });

  it('acepta un asiento cuadrado con cuentas de movimiento', () => {
    const a = nuevo([
      { cuenta: '1212', debe: 1180, haber: 0 },
      { cuenta: '40111', debe: 0, haber: 180 },
      { cuenta: '7041', debe: 0, haber: 1000 },
    ]);
    expect(validarAsiento(a, CUENTAS)).toEqual([]);
  });

  it('rechaza asientos descuadrados, cuentas de resumen y líneas con debe y haber', () => {
    const a = nuevo([
      { cuenta: '12', debe: 100, haber: 0 },
      { cuenta: '7041', debe: 5, haber: 90 },
    ]);
    const errores = validarAsiento(a, CUENTAS);
    expect(errores.some((e) => e.includes('de resumen'))).toBe(true);
    expect(errores.some((e) => e.includes('no a ambos'))).toBe(true);
    expect(errores.some((e) => e.includes('No cuadra'))).toBe(true);
  });

  it('pide tipo de cambio en dólares y glosa', () => {
    const a = nuevo(
      [
        { cuenta: '1041', debe: 10, haber: 0 },
        { cuenta: '5011', debe: 0, haber: 10 },
      ],
      { moneda: 'USD', glosa: ' ' },
    );
    expect(validarAsiento(a, CUENTAS)).toHaveLength(2);
  });

  it('valida el comprobante: serie, número y RUC de la factura', () => {
    const lineas = [
      { cuenta: '1212', debe: 118, haber: 0 },
      { cuenta: '7041', debe: 0, haber: 118 },
    ];
    const sinDatos = nuevo(lineas, { documento: { tipo: '01', serie: '', numero: '' } });
    expect(validarAsiento(sinDatos, CUENTAS)).toHaveLength(2);

    const completo = nuevo(lineas, { documento: { tipo: '01', serie: 'F001', numero: '9', documentoTercero: '20123456789' } });
    expect(validarAsiento(completo, CUENTAS)).toEqual([]);

    const boletaDni = nuevo(lineas, { documento: { tipo: '03', serie: 'B001', numero: '9', documentoTercero: '12345678' } });
    expect(validarAsiento(boletaDni, CUENTAS)).toEqual([]);
  });

  it('calcula el mayor y el balance solo con asientos registrados', () => {
    const asientos = [
      asiento(1, [
        { cuenta: '1041', debe: 1000, haber: 0 },
        { cuenta: '5011', debe: 0, haber: 1000 },
      ]),
      asiento(2, [
        { cuenta: '6361', debe: 200, haber: 0 },
        { cuenta: '1041', debe: 0, haber: 200 },
      ]),
      asiento(3, [
        { cuenta: '1041', debe: 999, haber: 0 },
        { cuenta: '5011', debe: 0, haber: 999 },
      ], 'borrador'),
    ];

    const mayor = mayorDeCuenta(asientos, CUENTAS.get('10')!);
    expect(mayor.map((m) => m.saldo)).toEqual([1000, 800]);
    expect(saldo(asientos, '50', 'acreedora')).toBe(1000);

    const balance = balanceComprobacion(asientos, CUENTAS);
    const debe = balance.reduce((s, f) => s + f.sumaDebe, 0);
    const haber = balance.reduce((s, f) => s + f.sumaHaber, 0);
    expect(debe).toBe(haber);
    expect(balance.find((f) => f.cuenta === '10')?.saldoDeudor).toBe(800);
  });
});
