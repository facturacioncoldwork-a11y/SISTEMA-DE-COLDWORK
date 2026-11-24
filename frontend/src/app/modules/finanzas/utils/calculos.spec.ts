import {
  aplicaDetraccion,
  desglosarTotal,
  igvDe,
  montoDetraccion,
  retencionCuarta,
  rucValido,
  sumarDias,
} from './calculos';

describe('cálculos tributarios', () => {
  it('calcula el IGV del 18 % y desglosa un total', () => {
    expect(igvDe(1000)).toBe(180);
    expect(igvDe(99.99)).toBe(18);
    expect(desglosarTotal(1180)).toEqual({ base: 1000, igv: 180 });
  });

  it('retiene 8 % solo en recibos por honorarios mayores a S/ 1 500', () => {
    expect(retencionCuarta(1500)).toBe(0);
    expect(retencionCuarta(2000)).toBe(160);
  });

  it('detracción redondeada a soles y solo desde S/ 700', () => {
    expect(montoDetraccion(4720, 12)).toBe(566);
    expect(aplicaDetraccion(700)).toBe(false);
    expect(aplicaDetraccion(700.01)).toBe(true);
  });

  it('valida el RUC con su dígito verificador', () => {
    expect(rucValido('20131312955')).toBe(true);
    expect(rucValido('20131312954')).toBe(false);
  });

  it('suma días de crédito al vencimiento', () => {
    expect(sumarDias('2026-11-24', 30)).toBe('2026-12-24');
    expect(sumarDias('2026-12-15', 30)).toBe('2027-01-14');
  });
});
