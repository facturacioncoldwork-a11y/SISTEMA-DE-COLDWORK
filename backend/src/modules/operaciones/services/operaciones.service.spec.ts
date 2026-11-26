import { describe, expect, it } from 'vitest';
import { aCotizacion, aOrden, desdeHace, fechaHoraLima } from './operaciones.service.js';

describe('Operaciones · conversión de filas', () => {
  it('la cotización junta columnas y documento; las columnas mandan sobre el documento', () => {
    const c = aCotizacion({
      id: 'c1',
      serie: 'PROY',
      numero: 'YG-PROY202600001',
      cliente_id: null,
      proyecto: 'Cámara',
      fecha: '2026-11-28',
      validez_dias: 15,
      moneda: 'USD',
      estado: 'borrador',
      expediente_id: null,
      motivo_rechazo: null,
      version: 3,
      datos: { secciones: [], hitos: [], estado: 'aprobada', numero: 'FALSO' },
    });
    expect(c.numero).toBe('YG-PROY202600001');
    expect(c.estado).toBe('borrador');
    expect(c.clienteId).toBe('');
    expect(c.version).toBe(3);
  });

  it('la orden recorta la hora a HH:MM y arranca sin mensajes', () => {
    const o = aOrden({ id: 'o1', hora: '08:30:00', tecnicos: null, informe: null, version: 1 });
    expect(o.hora).toBe('08:30');
    expect(o.tecnicos).toEqual([]);
    expect(o.informe).toEqual({});
    expect(o.mensajes).toEqual([]);
  });

  it('las horas se muestran en hora de Lima (UTC-5)', () => {
    expect(fechaHoraLima('2026-11-28T15:04:00Z')).toBe('2026-11-28 10:04');
    expect(fechaHoraLima('2026-11-29T02:00:00Z')).toBe('2026-11-28 21:00');
  });

  it('desdeHace resta días', () => {
    expect(desdeHace(365, new Date('2026-11-28T12:00:00Z'))).toBe('2025-11-28');
  });
});
