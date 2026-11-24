import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { aHttp, datosOError } from './errores-supabase.js';

describe('errores de Supabase → HTTP', () => {
  it.each([
    ['42501', ForbiddenException],
    ['PGRST116', NotFoundException],
    ['23505', ConflictException],
    ['XXXXX', InternalServerErrorException],
  ])('%s', (code, tipo) => {
    expect(aHttp({ code, message: 'x' })).toBeInstanceOf(tipo);
  });

  it('Supabase caído → 503', () => {
    expect(aHttp({ code: '', message: 'TypeError: fetch failed' })).toBeInstanceOf(ServiceUnavailableException);
  });

  it('no filtra detalles internos en errores desconocidos', () => {
    expect(aHttp({ code: 'XX000', message: 'relation secreta does not exist' }).message).not.toContain('secreta');
  });

  it('una regla de tabla violada da 400 sin nombres de tablas ni restricciones', () => {
    const e = aHttp({
      code: '23514',
      message: 'new row for relation "fin_comprobantes" violates check constraint "fin_comprobantes_total_check"',
    });
    expect(e.getStatus()).toBe(400);
    expect(e.message).not.toContain('fin_comprobantes');
    expect(aHttp({ code: '22008', message: 'date/time field value out of range: "2026-13-45"' }).getStatus()).toBe(400);
  });

  it('datosOError devuelve datos o lanza', () => {
    expect(datosOError({ data: [1], error: null })).toEqual([1]);
    expect(() => datosOError({ data: null, error: { code: '42501', message: 'rls' } })).toThrow(ForbiddenException);
  });

  it('en permiso denegado usa el mensaje de nuestras funciones, pero oculta el texto técnico de Postgres', () => {
    expect(aHttp({ code: '42501', message: 'Solo el dueño puede anular asientos.' }).message).toBe(
      'Solo el dueño puede anular asientos.',
    );
    expect(aHttp({ code: '42501', message: 'permission denied for table conta_asientos' }).message).toBe(
      'No tienes permiso para esta acción',
    );
  });
});
