import { describe, expect, it } from 'vitest';
import {
  antiguedadDe,
  mesesAviso,
  mesesEntre,
  nivelAntiguedad,
  textoAntiguedad,
  textoCorto,
} from './antiguedad';
import type { Lote } from './logistica.model';

const hoy = new Date('2026-11-24T12:00:00');
const lote = (fecha: string, cantidad: number, costoUnitario = 10): Lote => ({
  llegadaId: fecha,
  documento: 'LL-000001',
  fecha,
  cantidad,
  costoUnitario,
});

describe('antigüedad del inventario', () => {
  it('cuenta meses completos', () => {
    expect(mesesEntre(new Date('2024-11-24'), hoy)).toBe(24);
    expect(mesesEntre(new Date('2024-11-25'), hoy)).toBe(23);
    expect(mesesEntre(new Date('2026-11-30'), hoy)).toBe(0);
  });

  it('textos legibles', () => {
    expect(textoAntiguedad('2024-08-10T10:00:00', hoy)).toBe('2 años y 3 meses');
    expect(textoAntiguedad('2025-11-24T10:00:00', hoy)).toBe('1 año');
    expect(textoAntiguedad('2026-03-01T10:00:00', hoy)).toBe('8 meses');
    expect(textoAntiguedad('2026-11-12T10:00:00', hoy)).toBe('12 días');
    expect(textoCorto('2024-08-10T10:00:00', hoy)).toBe('2a 3m');
  });

  it('con límite de 24 meses avisa desde los 18', () => {
    expect(mesesAviso(24)).toBe(18);
    expect(nivelAntiguedad(17, 24)).toBe('reciente');
    expect(nivelAntiguedad(18, 24)).toBe('envejeciendo');
    expect(nivelAntiguedad(24, 24)).toBe('antiguo');
  });

  it('solo cuenta como antiguo lo que pasó el límite', () => {
    const a = antiguedadDe(
      [lote('2026-10-01T10:00:00', 5, 60), lote('2024-01-15T10:00:00', 3, 120)],
      24,
      hoy,
    );
    expect(a.nivel).toBe('antiguo');
    expect(a.desde).toBe('2024-01-15T10:00:00');
    expect(a.meses).toBe(34);
    expect(a.cantidadAntigua).toBe(3);
    expect(a.valorAntiguo).toBe(360);
  });

  it('sin stock no hay alerta', () => {
    expect(antiguedadDe([], 24, hoy)).toMatchObject({ nivel: 'reciente', desde: null });
  });
});
