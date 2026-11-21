import { describe, expect, it } from 'vitest';
import frio from './cotizacion-frio.fixture.json';
import {
  leerDesdeTextos,
  leerNumero,
  leerTextoLibre,
  normalizarUnidad,
  type TextoPdf,
} from './lector-cotizacion';

describe('números de cotizaciones', () => {
  it('entiende los formatos de precio', () => {
    expect(leerNumero('$ 30.00')).toBe(30);
    expect(leerNumero('1,079.94')).toBe(1079.94);
    expect(leerNumero('1.079,94')).toBe(1079.94);
    expect(leerNumero('S/ 15,90')).toBe(15.9);
    expect(leerNumero('12')).toBe(12);
    expect(leerNumero('—')).toBeNull();
  });
  it('unidades de SUNAT al catálogo', () => {
    expect(normalizarUnidad('NIU')).toBe('UND');
    expect(normalizarUnidad('GLN')).toBe('GAL');
  });
});

describe('cotización de FRIO IMPORTACIONES (PDF, formato real)', () => {
  const r = leerDesdeTextos(frio as TextoPdf[], '20608689941');

  it('lee los datos del proveedor y del documento', () => {
    expect(r.proveedor.ruc).toBe('20505717672'); // no confunde con el RUC de COLD WORK
    expect(r.proveedor.razonSocial).toBe('FRIO IMPORTACIONES S.A.C');
    expect(r.numero).toBe('HC 1724');
    expect(r.moneda).toBe('USD');
    expect(r.formaPago).toBe('Contado');
    expect(r.fecha).toBe('2026-11-19');
  });

  it('lee los 7 productos con código, cantidad, unidad, marca y precio', () => {
    expect(r.items).toHaveLength(7);
    expect(r.items[0]).toEqual({
      codigo: '023U1921',
      descripcion: '48 - F NUC IMP CON EMP. Y PAQUETE IND',
      marca: 'DANFOSS',
      unidad: 'UND',
      cantidad: 12,
      precio: 30,
      total: 360,
    });
    expect(r.items[4]).toMatchObject({ codigo: '030-713', cantidad: 2, precio: 14, marca: 'RAC' });
    expect(r.items[6]).toMatchObject({ codigo: 'ALAC4', cantidad: 3, precio: 17, total: 51 });
  });

  it('los totales cuadran y no hay avisos', () => {
    expect(r.subtotal).toBe(915.2);
    expect(r.igv).toBe(164.74);
    expect(r.total).toBe(1079.94);
    expect(r.avisos).toEqual([]);
  });
});

describe('texto pegado de WhatsApp', () => {
  it('lee cantidad, descripción y precio', () => {
    const r = leerTextoLibre(`Buenas tardes, le cotizo en dólares:
1) 12 und 023U1921 Filtro NUC Danfoss $30.00
2) Aceite POE32 4L x4 $61.70
3) 2 gln Alki foam ST-Blue $17.00 $34.00
Total $1,079.94`);
    expect(r.moneda).toBe('USD');
    expect(r.items).toHaveLength(3);
    expect(r.items[0]).toMatchObject({ codigo: '023U1921', cantidad: 12, precio: 30 });
    expect(r.items[1]).toMatchObject({ cantidad: 4, precio: 61.7 });
    expect(r.items[2]).toMatchObject({ cantidad: 2, unidad: 'GAL', precio: 17, total: 34 });
  });
});
