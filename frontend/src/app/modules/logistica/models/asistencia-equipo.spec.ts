import { describe, expect, it } from 'vitest';
import type { Ausencia, Horario, Marca } from '../../personal/models/personal.model';
import { diaDe, diasDelMes, esDescanso, iniciales, totalesDe } from './asistencia-equipo';

const horario: Horario = {
  entrada: '08:00',
  salida: '17:00',
  refrigerio: 60,
  refrigerioDesde: '12:00',
  refrigerioHasta: '15:00',
  tolerancia: 10,
  jornada: 480,
  metodos: { gps: true, codigo: true, manual: true },
  radioOficina: 150,
  selfie: false,
  oficina: null,
};
const marca = (fecha: string, entrada: string, salida?: string, pendiente = false): Marca => ({
  id: fecha,
  trabajadorId: 'ana',
  fecha,
  entrada,
  salida,
  metodo: 'gps',
  lugar: 'Oficina',
  pendiente,
  salidaEnCampo: false,
});
const HOY = '2026-11-26'; // jueves
const dia = (fecha: string, marcas: Marca[] = [], aus: Ausencia[] = [], ahora = 15 * 60) =>
  diaDe('ana', fecha, marcas, aus, horario, HOY, ahora);

describe('asistencia del equipo de logística', () => {
  it('a tiempo dentro de la tolerancia y con horas trabajadas', () => {
    const d = dia('2026-11-25', [marca('2026-11-25', '08:09', '17:00')]);
    expect(d.estado).toBe('puntual');
    expect(d.trabajados).toBe(8 * 60 - 9);
  });
  it('tardanza pasada la tolerancia', () => {
    const d = dia('2026-11-25', [marca('2026-11-25', '08:25', '17:00')]);
    expect(d.estado).toBe('tarde');
    expect(d.tardanza).toBe(25);
  });
  it('marca sin GPS espera aprobación', () => {
    expect(dia('2026-11-25', [marca('2026-11-25', '08:00', undefined, true)]).estado).toBe(
      'pendiente',
    );
  });
  it('sin marca: justificada, falta, descanso o aún no llega', () => {
    const aus: Ausencia[] = [
      { id: 'x', trabajadorId: 'ana', fecha: '2026-11-24', tipo: 'vacaciones' },
    ];
    expect(dia('2026-11-24', [], aus).estado).toBe('justificado');
    expect(dia('2026-11-25').estado).toBe('falta');
    expect(esDescanso('2026-11-22')).toBe(true);
    expect(dia('2026-11-22').estado).toBe('descanso');
    expect(dia(HOY, [], [], 8 * 60 + 5).estado).toBe('por_llegar');
    expect(dia(HOY, [], [], 9 * 60).estado).toBe('falta');
    expect(dia('2026-11-27').estado).toBe('futuro');
  });
  it('hoy con entrada y sin salida: sigue trabajando', () => {
    expect(dia(HOY, [marca(HOY, '07:58')]).trabajando).toBe(true);
  });
  it('totales del mes', () => {
    const t = totalesDe([
      dia('2026-11-23', [marca('2026-11-23', '08:00', '17:00')]),
      dia('2026-11-24', [marca('2026-11-24', '08:30', '17:00')]),
      dia('2026-11-25'),
    ]);
    expect(t).toMatchObject({ asistencias: 2, tardanzas: 1, minutosTarde: 30, faltas: 1 });
  });
  it('utilidades', () => {
    expect(diasDelMes('2026-02-10')).toHaveLength(28);
    expect(iniciales('rosa  medina paz')).toBe('RM');
  });
});
