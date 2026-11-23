import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CambiarEstadoDto, GuardarAsientoDto } from './asiento.dto.js';

async function errores(clase: new () => object, cuerpo: unknown): Promise<string[]> {
  const lista = await validate(plainToInstance(clase, cuerpo) as object, { whitelist: true, forbidNonWhitelisted: true });
  const props: string[] = [];
  const recorrer = (e: (typeof lista)[number], base = '') => {
    const ruta = base ? `${base}.${e.property}` : e.property;
    if (e.constraints) props.push(ruta);
    e.children?.forEach((h) => recorrer(h, ruta));
  };
  lista.forEach((e) => recorrer(e));
  return props;
}

const valido = {
  confirmar: true,
  datos: {
    fecha: '2026-11-21',
    origen: 'ventas',
    glosa: 'Mantenimiento',
    moneda: 'PEN',
    documento: { tipo: '01', serie: 'F001', numero: '1', documentoTercero: '20123456789' },
    lineas: [
      { cuenta: '1212', debe: 118, haber: 0 },
      { cuenta: '7041', debe: 0, haber: 118 },
    ],
  },
};

describe('DTOs de contabilidad', () => {
  it('acepta un asiento bien formado', async () => {
    expect(await errores(GuardarAsientoDto, valido)).toEqual([]);
  });

  it('rechaza cuenta inválida, importes negativos, RUC mal escrito y campos extra', async () => {
    const malo = structuredClone(valido) as Record<string, any>;
    malo.datos.lineas[0].cuenta = '12ab';
    malo.datos.lineas[1].haber = -5;
    malo.datos.documento.documentoTercero = '123';
    malo.datos.hackeo = 'x';
    const e = await errores(GuardarAsientoDto, malo);
    expect(e).toEqual(
      expect.arrayContaining(['datos.lineas.0.cuenta', 'datos.lineas.1.haber', 'datos.documento.documentoTercero', 'datos.hackeo']),
    );
  });

  it('solo permite rutas de adjunto dentro de la carpeta de una empresa', async () => {
    const conAdjunto = structuredClone(valido) as Record<string, any>;
    conAdjunto.datos.adjuntos = [{ nombre: 'f.pdf', tipo: 'application/pdf', tamano: 10, ruta: '../../otra/f.pdf' }];
    expect(await errores(GuardarAsientoDto, conAdjunto)).toContain('datos.adjuntos.0.ruta');
  });

  it('solo acepta acciones de estado conocidas', async () => {
    expect(await errores(CambiarEstadoDto, { accion: 'borrar_todo' })).toContain('accion');
    expect(await errores(CambiarEstadoDto, { accion: 'observar', comentario: 'Falta RUC' })).toEqual([]);
  });
});
