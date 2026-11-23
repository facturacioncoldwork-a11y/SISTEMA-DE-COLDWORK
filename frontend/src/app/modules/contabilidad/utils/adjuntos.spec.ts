import { pesoLegible, problemaArchivo, TAMANO_MAXIMO } from './adjuntos';

describe('adjuntos', () => {
  const foto = { name: 'factura.jpg', type: 'image/jpeg', size: 200_000 };

  it('acepta fotos y PDF dentro del tamaño', () => {
    expect(problemaArchivo(foto, 0)).toBeNull();
    expect(problemaArchivo({ name: 'f.pdf', type: 'application/pdf', size: 1000 }, 2)).toBeNull();
  });

  it('rechaza otros tipos, archivos pesados y más de 3 adjuntos', () => {
    expect(problemaArchivo({ name: 'virus.exe', type: 'application/x-msdownload', size: 10 }, 0)).toContain('no es una foto');
    expect(problemaArchivo({ ...foto, size: TAMANO_MAXIMO + 1 }, 0)).toContain('5 MB');
    expect(problemaArchivo(foto, 3)).toContain('Máximo 3');
  });

  it('muestra el peso legible', () => {
    expect(pesoLegible(2048)).toBe('2 KB');
    expect(pesoLegible(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
