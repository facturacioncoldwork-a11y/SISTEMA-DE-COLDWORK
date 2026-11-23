import { describe, expect, it } from 'vitest';
import { diasEntre, leerPlazo, seguimiento, sumar, textoPlazo, ventana } from './plazos';

describe('plazos de proveedor', () => {
  it('entiende el plazo como lo dice el proveedor', () => {
    expect(leerPlazo('2-3 semanas')).toEqual({ min: 2, max: 3, unidad: 'semanas' });
    expect(leerPlazo('2 a 3 semanas')).toEqual({ min: 2, max: 3, unidad: 'semanas' });
    expect(leerPlazo('Entre 1 y 2 meses')).toEqual({ min: 1, max: 2, unidad: 'meses' });
    expect(leerPlazo('45 días')).toEqual({ min: 45, max: 45, unidad: 'dias' });
    expect(leerPlazo('3 sem')).toEqual({ min: 3, max: 3, unidad: 'semanas' });
    expect(leerPlazo('pronto')).toBeNull();
  });

  it('escribe el plazo de vuelta', () => {
    expect(textoPlazo({ min: 2, max: 3, unidad: 'semanas' })).toBe('2-3 semanas');
    expect(textoPlazo({ min: 1, max: 1, unidad: 'meses' })).toBe('1 mes');
  });

  it('calcula la ventana desde la fecha de la orden', () => {
    expect(ventana('2026-11-20', { min: 2, max: 3, unidad: 'semanas' })).toEqual({
      desde: '2026-12-04',
      hasta: '2026-12-11',
    });
    expect(ventana('2026-11-20', { min: 1, max: 2, unidad: 'meses' })).toEqual({
      desde: '2026-12-20',
      hasta: '2027-01-20',
    });
  });

  it('un mes después del 31 de enero es fin de febrero, no marzo', () => {
    expect(sumar('2027-01-31', 1, 'meses')).toBe('2027-02-28');
    expect(diasEntre('2026-11-20', '2026-12-04')).toBe(14);
  });
});

describe('seguimiento de la orden', () => {
  const base = { estado: 'enviada', fechaLlegadaReal: null, entregadoCliente: null };

  it('cuenta los días que faltan para la ventana', () => {
    const s = seguimiento(
      { ...base, entregaDesde: '2026-12-04', entregaHasta: '2026-12-11', compromisoCliente: null },
      '2026-11-20',
    );
    expect(s.llegada).toBe('a_tiempo');
    expect(s.textoLlegada).toBe('Llega en 14-21 días');
  });

  it('marca atrasada cuando pasó el fin de la ventana', () => {
    const s = seguimiento(
      { ...base, entregaDesde: '2026-11-10', entregaHasta: '2026-11-17', compromisoCliente: null },
      '2026-11-20',
    );
    expect(s.llegada).toBe('atrasada');
    expect(s.textoLlegada).toBe('Atrasada 3 días');
  });

  it('avisa riesgo si puede llegar después de lo prometido al cliente', () => {
    const s = seguimiento(
      {
        ...base,
        entregaDesde: '2026-12-04',
        entregaHasta: '2026-12-11',
        compromisoCliente: '2026-12-08',
      },
      '2026-11-20',
    );
    expect(s.cliente).toBe('riesgo');
    expect(s.holgura).toBe(-3);
  });

  it('da margen cuando llega antes del compromiso', () => {
    const s = seguimiento(
      {
        ...base,
        entregaDesde: '2026-12-04',
        entregaHasta: '2026-12-11',
        compromisoCliente: '2026-12-18',
      },
      '2026-11-20',
    );
    expect(s.cliente).toBe('ok');
    expect(s.holgura).toBe(7);
  });

  it('usa la fecha real cuando ya llegó', () => {
    const s = seguimiento(
      {
        ...base,
        estado: 'recibida',
        entregaDesde: '2026-12-04',
        entregaHasta: '2026-12-11',
        fechaLlegadaReal: '2026-12-02',
        compromisoCliente: '2026-12-05',
      },
      '2026-12-03',
    );
    expect(s.llegada).toBe('llego');
    expect(s.holgura).toBe(3);
  });
});
