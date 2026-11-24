import { destinoDe, iniciales, necesitaElegir, nombreDestino } from './eleccion';

describe('elegir empresa', () => {
  const dos = [{ id: 'a' }, { id: 'b' }];

  it('con una sola empresa nunca pregunta', () => {
    expect(necesitaElegir([], null)).toBe(false);
    expect(necesitaElegir([{ id: 'a' }], null)).toBe(false);
  });

  it('con varias entra directo a la última usada', () => {
    expect(necesitaElegir(dos, 'b')).toBe(false);
  });

  it('pregunta si no hay última o ya no tiene acceso a ella', () => {
    expect(necesitaElegir(dos, null)).toBe(true);
    expect(necesitaElegir(dos, 'borrada')).toBe(true);
  });

  it('lleva a cada persona a su portal según su rol en esa empresa', () => {
    expect(destinoDe({ rol: 'dueno', areas: [] })).toBe('/');
    expect(destinoDe({ rol: 'contador', areas: [] })).toBe('/trabajo');
    expect(nombreDestino({ rol: 'contador', areas: [] })).toBe('Portal contable');
    expect(nombreDestino({ rol: 'admin', areas: [] })).toBe('Sistema completo');
  });

  it('saca las iniciales de la razón social', () => {
    expect(iniciales('Refrigeración Quispe E.I.R.L.')).toBe('RQ');
    expect(iniciales('COLDWORK')).toBe('C');
  });
});
