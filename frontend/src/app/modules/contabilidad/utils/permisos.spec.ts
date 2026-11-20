import { CONTADORA, DUENO } from '../data/equipo-ejemplo';
import type { Asiento } from '../models/contabilidad.model';
import { pendientesDe, permisosDe, puedeEditar } from './permisos';

function asiento(estado: Asiento['estado'], creadoPor: string): Asiento {
  return {
    id: estado,
    numero: 1,
    periodo: '2026-11',
    fecha: '2026-11-01',
    origen: 'diario',
    glosa: 'x',
    moneda: 'PEN',
    lineas: [],
    estado,
    creadoEn: '',
    creadoPor,
  };
}

describe('permisos contables', () => {
  it('el dueño puede todo', () => {
    expect(permisosDe(DUENO, { contadorRegistraDirecto: false })).toEqual({
      registrar: true,
      aprobar: true,
      anular: true,
      configurar: true,
      verActividad: true,
    });
  });

  it('el contador solo registra directo si el dueño lo permite', () => {
    expect(permisosDe(CONTADORA, { contadorRegistraDirecto: false }).registrar).toBe(false);
    expect(permisosDe(CONTADORA, { contadorRegistraDirecto: true }).registrar).toBe(true);
    expect(permisosDe(CONTADORA, { contadorRegistraDirecto: true }).aprobar).toBe(false);
    expect(permisosDe(CONTADORA, { contadorRegistraDirecto: true }).anular).toBe(false);
  });

  it('solo se editan borradores y observados, por su autor o el dueño', () => {
    expect(puedeEditar(asiento('observado', CONTADORA.id), CONTADORA)).toBe(true);
    expect(puedeEditar(asiento('borrador', DUENO.id), CONTADORA)).toBe(false);
    expect(puedeEditar(asiento('borrador', CONTADORA.id), DUENO)).toBe(true);
    expect(puedeEditar(asiento('registrado', CONTADORA.id), DUENO)).toBe(false);
    expect(puedeEditar(asiento('por_aprobar', CONTADORA.id), CONTADORA)).toBe(false);
  });

  it('agrupa el trabajo pendiente del contador', () => {
    const lista = [
      asiento('observado', CONTADORA.id),
      asiento('borrador', CONTADORA.id),
      asiento('por_aprobar', CONTADORA.id),
      asiento('borrador', DUENO.id),
    ];
    const p = pendientesDe(lista, CONTADORA);
    expect([p.observados.length, p.borradores.length, p.enRevision.length]).toEqual([1, 1, 1]);
  });
});
