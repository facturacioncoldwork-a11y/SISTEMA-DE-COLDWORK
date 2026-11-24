import { describe, expect, it } from 'vitest';
import { diasVencido, FECHA, fechaLima, tramoAntiguedad } from './finanzas.service.js';

describe('finanzas · cobranza', () => {
  it('cuenta los días de atraso', () => {
    expect(diasVencido('2026-11-20', '2026-11-24')).toBe(4);
    expect(diasVencido('2026-11-30', '2026-11-24')).toBe(-6);
  });

  it('clasifica la deuda por antigüedad', () => {
    expect(tramoAntiguedad(-3)).toBe('por_vencer');
    expect(tramoAntiguedad(0)).toBe('por_vencer');
    expect(tramoAntiguedad(15)).toBe('1-30');
    expect(tramoAntiguedad(45)).toBe('31-60');
    expect(tramoAntiguedad(90)).toBe('61-90');
    expect(tramoAntiguedad(120)).toBe('mas_90');
  });

  it('usa la fecha de Lima (UTC-5)', () => {
    expect(fechaLima(new Date('2026-11-25T03:00:00Z'))).toBe('2026-11-24');
    expect(fechaLima(new Date('2026-11-25T06:00:00Z'))).toBe('2026-11-25');
  });
});

describe('finanzas · fechas de los filtros', () => {
  it('acepta solo fechas que existen', () => {
    expect(FECHA.test('2026-11-24')).toBe(true);
    expect(FECHA.test('2024-02-29')).toBe(true);
    expect(FECHA.test('2026-02-30')).toBe(false);
    expect(FECHA.test('2026-13-45')).toBe(false);
    expect(FECHA.test("2026-11-24' or 1=1")).toBe(false);
    expect(FECHA.test(['2026-11-24', '2026-11-25'])).toBe(false);
  });
});