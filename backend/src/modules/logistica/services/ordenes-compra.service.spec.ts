import { describe, expect, it } from 'vitest';
import { cambiosProyecto } from './ordenes-compra.service.js';

describe('proyecto de la orden de compra', () => {
  it('elegido de Operaciones: la BD copia código y nombre', () => {
    expect(cambiosProyecto({ proyectoId: 'p1', proyectoCodigo: 'X' })).toEqual({
      proyecto_id: 'p1',
    });
  });

  it('escrito a mano: código y nombre sin enlace', () => {
    expect(
      cambiosProyecto({
        proyectoCodigo: ' YG-PROY20260010 ',
        proyectoNombre: '',
      }),
    ).toEqual({
      proyecto_id: null,
      proyecto_codigo: 'YG-PROY20260010',
      proyecto_nombre: null,
    });
  });

  it('al quitarlo se limpian también el código y el nombre', () => {
    const vacio = {
      proyecto_id: null,
      proyecto_codigo: null,
      proyecto_nombre: null,
    };
    expect(cambiosProyecto({ proyectoId: null })).toEqual(vacio);
    expect(cambiosProyecto({ proyectoCodigo: '' })).toEqual(vacio);
    expect(cambiosProyecto({})).toEqual({});
  });
});
