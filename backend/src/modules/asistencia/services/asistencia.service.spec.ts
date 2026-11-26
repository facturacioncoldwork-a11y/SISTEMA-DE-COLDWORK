import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { Area, Rol } from '../../../common/index.js';
import { aMarca, esGestor, validarRango } from './asistencia.service.js';

describe('asistencia', () => {
  it('gestiona: dueño, admin o área Personal; el resto solo marca', () => {
    expect(esGestor({ rol: Rol.Dueno, areas: [] })).toBe(true);
    expect(esGestor({ rol: Rol.Trabajador, areas: [Area.Personal] })).toBe(true);
    expect(esGestor({ rol: Rol.Trabajador, areas: [Area.Tecnica] })).toBe(false);
  });

  it('consulta como máximo 3 meses y con fechas reales', () => {
    expect(() => validarRango('2026-11-01', '2026-11-30')).not.toThrow();
    expect(() => validarRango('2026-01-01', '2026-12-31')).toThrow(BadRequestException);
    expect(() => validarRango('2026-11-30', '2026-11-01')).toThrow(BadRequestException);
    expect(() => validarRango("2026-11-01' or 1=1", '2026-11-30')).toThrow(BadRequestException);
  });

  it('convierte la fila a la respuesta (horas HH:MM)', () => {
    expect(
      aMarca({ id: 'm1', usuario_id: 'u1', fecha: '2026-11-25', entrada: '08:02:00', salida: null, metodo: 'gps', lugar: 'Oficina', salida_en_campo: false, pendiente: false }),
    ).toMatchObject({ id: 'm1', trabajadorId: 'u1', entrada: '08:02', salida: undefined, lugar: 'Oficina' });
  });
});
