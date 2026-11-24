import { hoy } from '../../finanzas/utils/calculos';

/** Rangos rápidos para los reportes (fechas AAAA-MM-DD, hora local). */
export interface Rango {
  clave: string;
  nombre: string;
  desde: string;
  hasta: string;
}

export function ultimoDia(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(new Date(anio, mes, 0).getDate()).padStart(2, '0')}`;
}

export function rangosRapidos(hoyStr = hoy()): Rango[] {
  const [a, m] = hoyStr.split('-').map(Number);
  const mesAnt = m === 1 ? { a: a - 1, m: 12 } : { a, m: m - 1 };
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    { clave: 'mes', nombre: 'Este mes', desde: `${a}-${pad(m)}-01`, hasta: hoyStr },
    { clave: 'anterior', nombre: 'Mes anterior', desde: `${mesAnt.a}-${pad(mesAnt.m)}-01`, hasta: ultimoDia(mesAnt.a, mesAnt.m) },
    { clave: 'anio', nombre: `Año ${a}`, desde: `${a}-01-01`, hasta: hoyStr },
    { clave: 'anio-ant', nombre: `Año ${a - 1}`, desde: `${a - 1}-01-01`, hasta: `${a - 1}-12-31` },
  ];
}

export function fechaLarga(fecha: string): string {
  return new Date(`${fecha}T12:00:00`).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
}
