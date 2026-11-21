import { problemasClave } from './clave';

describe('problemasClave', () => {
  it('acepta una contraseña de 8+ con letras y números que coincide', () => {
    expect(problemasClave('frio2026x', 'frio2026x')).toEqual([]);
  });

  it('pide largo mínimo, letras y números, y que coincidan', () => {
    expect(problemasClave('abc', 'abc')).toHaveLength(2);
    expect(problemasClave('solotexto', 'solotexto')).toEqual(['Combina letras y números.']);
    expect(problemasClave('frio2026x', 'otra2026x')).toEqual(['Las dos contraseñas no coinciden.']);
  });
});
