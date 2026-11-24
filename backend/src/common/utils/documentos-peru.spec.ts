import { describe, expect, it } from 'vitest';
import { problemaDocumento, rucValido } from './documentos-peru.js';

describe('documentos de Perú', () => {
  it('acepta RUC con dígito verificador correcto', () => {
    expect(rucValido('20100047218')).toBe(true); // BCP
    expect(rucValido('20131312955')).toBe(true); // SUNAT
  });

  it('rechaza RUC mal tipeado o con prefijo inválido', () => {
    expect(rucValido('20100047219')).toBe(false);
    expect(rucValido('30100047218')).toBe(false);
    expect(rucValido('2010004721')).toBe(false);
  });

  it('valida según el tipo de documento', () => {
    expect(problemaDocumento('DNI', '1234567')).toContain('8 dígitos');
    expect(problemaDocumento('DNI', '12345678')).toBeNull();
    expect(problemaDocumento('RUC', '20131312955')).toBeNull();
  });
});
