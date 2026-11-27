import { describe, expect, it } from 'vitest';
import type { OrdenCompra } from './logistica.model';
import { codigoEnTexto, datosProyecto, eleccionDe } from './proyecto-oc';

describe('proyecto de la orden de compra', () => {
  it('arranca según lo que ya tiene la OC', () => {
    expect(eleccionDe({ proyecto: { id: 'p1', codigo: 'YG-1', nombre: 'Pedregal' } })).toEqual({
      manual: false,
      id: 'p1',
      codigo: '',
      nombre: '',
    });
    expect(eleccionDe({ proyecto: { id: null, codigo: 'YG-9', nombre: 'YG-9' } })).toEqual({
      manual: true,
      id: null,
      codigo: 'YG-9',
      nombre: '',
    });
    expect(eleccionDe(null).manual).toBe(false);
  });

  it('manda el proyecto elegido, el escrito a mano o lo quita', () => {
    const lista = { manual: false, id: 'p1', codigo: '', nombre: '' };
    expect(datosProyecto(lista, false)).toEqual({ proyectoId: 'p1' });
    expect(datosProyecto({ ...lista, id: null }, false)).toEqual({});
    expect(datosProyecto({ ...lista, id: null }, true)).toEqual({ proyectoId: null });
    const mano = { manual: true, id: null, codigo: ' YG-PROY20260010 ', nombre: ' Pedregal ' };
    expect(datosProyecto(mano, false)).toEqual({
      proyectoCodigo: 'YG-PROY20260010',
      proyectoNombre: 'Pedregal',
    });
    expect(datosProyecto({ ...mano, codigo: '' }, true)).toEqual({ proyectoId: null });
  });

  it('encuentra el código de proyecto escrito en la OC', () => {
    const oc = {
      notas: 'Para el proyecto yg-proy20260010',
      cliente: null,
      cotizacionRef: null,
      plazoTexto: null,
    } as Pick<OrdenCompra, 'notas' | 'cliente' | 'cotizacionRef' | 'plazoTexto'>;
    expect(codigoEnTexto(oc, ['AR-PROY20260005', 'YG-PROY20260010'])).toBe('YG-PROY20260010');
    expect(codigoEnTexto({ ...oc, notas: null }, ['YG-PROY20260010'])).toBeNull();
  });
});
