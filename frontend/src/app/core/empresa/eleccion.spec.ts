import { destinoDe, necesitaElegir, nombreDestino } from './eleccion';

describe('elegir empresa', () => {
  it('solo pregunta si hay más de una empresa y aún no eligió en esta sesión', () => {
    expect(necesitaElegir(0, false)).toBe(false);
    expect(necesitaElegir(1, false)).toBe(false);
    expect(necesitaElegir(2, false)).toBe(true);
    expect(necesitaElegir(2, true)).toBe(false);
  });

  it('lleva a cada persona a su portal según su rol en esa empresa', () => {
    expect(destinoDe({ rol: 'dueno', areas: [] })).toBe('/');
    expect(destinoDe({ rol: 'contador', areas: [] })).toBe('/trabajo');
    expect(destinoDe({ rol: 'trabajador', areas: ['contabilidad'] })).toBe('/trabajo');
    expect(nombreDestino({ rol: 'contador', areas: [] })).toBe('Portal contable');
    expect(nombreDestino({ rol: 'admin', areas: [] })).toBe('Sistema completo');
  });
});
