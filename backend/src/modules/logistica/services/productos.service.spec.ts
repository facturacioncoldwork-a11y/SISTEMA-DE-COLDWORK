import { describe, expect, it } from 'vitest';
import type { MovimientoDto } from '../dto/index.js';
import { conSaldoReal } from './productos.service.js';

const mov = (
  id: number,
  tipo: 'entrada' | 'salida',
  cantidad: number,
  almacenId = 'A',
): MovimientoDto => ({
  id,
  fecha: '2026-01-01',
  tipo,
  almacenId,
  cantidad,
  costoUnitario: 0,
  saldo: -999, // el guardado en la BD no se usa
  documento: '',
  detalle: '',
});

describe('kardex: saldo calculado desde el stock actual', () => {
  it('recorre del más reciente al más antiguo', () => {
    // historia: +10 (2023), -7, +5 (llegada registrada después con fecha pasada) → stock 8
    const r = conSaldoReal(
      [mov(3, 'salida', 7), mov(2, 'entrada', 5), mov(1, 'entrada', 10)],
      [{ almacen_id: 'A', cantidad: 8 }],
    );
    expect(r.map((m) => m.saldo)).toEqual([8, 15, 10]);
  });

  it('cada almacén lleva su propio saldo', () => {
    const r = conSaldoReal(
      [
        mov(3, 'entrada', 2, 'B'),
        mov(2, 'salida', 2, 'A'),
        mov(1, 'entrada', 4, 'A'),
      ],
      [
        { almacen_id: 'A', cantidad: 2 },
        { almacen_id: 'B', cantidad: 2 },
      ],
    );
    expect(r.map((m) => m.saldo)).toEqual([2, 2, 4]);
  });
});
