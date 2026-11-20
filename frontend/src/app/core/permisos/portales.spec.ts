import { portalDe } from './portales';

describe('portalDe', () => {
  it('dueño y admin entran al ERP', () => {
    expect(portalDe('dueno')).toBe('erp');
    expect(portalDe('admin', ['contabilidad'])).toBe('erp');
  });

  it('el contador entra a su portal', () => {
    expect(portalDe('contador')).toBe('contable');
  });

  it('un trabajador solo de contabilidad o finanzas entra al portal contable', () => {
    expect(portalDe('trabajador', ['contabilidad'])).toBe('contable');
    expect(portalDe('trabajador', ['contabilidad', 'finanzas'])).toBe('contable');
  });

  it('otras áreas siguen en el ERP filtrado hasta tener su portal', () => {
    expect(portalDe('trabajador', ['tecnica'])).toBe('erp');
    expect(portalDe('trabajador', ['contabilidad', 'ventas'])).toBe('erp');
    expect(portalDe('trabajador', [])).toBe('erp');
    expect(portalDe(null)).toBe('erp');
  });
});
