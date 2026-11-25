import { describe, expect, it } from 'vitest';
import type { Horario } from '../models/personal.model';
import { codigoDelMomento, distanciaMetros, resumenDia } from './horas';

const H: Horario = {
  entrada: '08:00',
  salida: '17:00',
  refrigerio: 60,
  tolerancia: 10,
  jornada: 480,
  metodos: { gps: true, qr: true, manual: true },
  radioOficina: 150,
  selfie: true,
};

describe('horas · normas de Perú', () => {
  it('jornada completa: 8 h sin extras (el refrigerio no cuenta)', () => {
    expect(resumenDia({ entrada: '08:00', salida: '17:00' }, H)).toEqual({ trabajados: 480, normales: 480, extra25: 0, extra35: 0, tardanza: 0 });
  });

  it('tolerancia: 08:10 no es tardanza, 08:11 sí (11 min)', () => {
    expect(resumenDia({ entrada: '08:10', salida: '17:00' }, H).tardanza).toBe(0);
    expect(resumenDia({ entrada: '08:11', salida: '17:00' }, H).tardanza).toBe(11);
  });

  it('horas extra: 2 primeras al 25 %, desde la tercera al 35 %', () => {
    const r = resumenDia({ entrada: '08:00', salida: '20:30' }, H);
    expect(r.normales).toBe(480);
    expect(r.extra25).toBe(120);
    expect(r.extra35).toBe(90);
  });

  it('menos de 10 min después de la salida no son horas extra', () => {
    expect(resumenDia({ entrada: '08:00', salida: '17:08' }, H).extra25).toBe(0);
  });

  it('media jornada de 4 h no descuenta refrigerio', () => {
    expect(resumenDia({ entrada: '08:00', salida: '12:00' }, H).trabajados).toBe(240);
  });

  it('distancia GPS y código que cambia cada 30 s', () => {
    expect(Math.round(distanciaMetros({ lat: -14.0678, lng: -75.7286 }, { lat: -14.0678, lng: -75.7286 }))).toBe(0);
    expect(distanciaMetros({ lat: -14.0678, lng: -75.7286 }, { lat: -14.0778, lng: -75.7286 })).toBeGreaterThan(1000);
    expect(codigoDelMomento('x', 0)).toBe(codigoDelMomento('x', 29_000));
    expect(codigoDelMomento('x', 0)).not.toBe(codigoDelMomento('x', 31_000));
  });
});
