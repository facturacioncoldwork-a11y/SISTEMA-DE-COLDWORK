import { aCsv } from './csv';

describe('aCsv', () => {
  it('separa con punto y coma y escapa comillas', () => {
    expect(aCsv([{ a: 'Cliente "Uno"', b: 10 }])).toBe('a;b\r\n"Cliente ""Uno""";10');
  });

  it('neutraliza fórmulas (inyección CSV)', () => {
    expect(aCsv([{ nombre: '=HYPERLINK("x")' }])).toContain("'=HYPERLINK");
    expect(aCsv([{ monto: -5 }])).toBe('monto\r\n-5');
  });
});
