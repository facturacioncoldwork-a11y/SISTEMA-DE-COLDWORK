import type { Ausencia, Horario, Justificacion, Marca } from '../../personal/models/personal.model';
import { aMinutos, resumenDia } from '../../personal/utils/horas';

/**
 * Estado de asistencia de una persona en un día, para la pestaña Asistencia de Logística.
 * Los datos son los mismos de Personal → Asistencia (tablas asistencia_*): aquí solo se leen
 * y se resumen. Las marcas no se editan ni borran (DS 004-2006-TR).
 */
export type EstadoDia =
  | 'puntual'
  | 'tarde'
  | 'pendiente'
  | 'justificado'
  | 'falta'
  | 'por_llegar'
  | 'descanso'
  | 'futuro';

export const ESTADOS: Record<EstadoDia, { nombre: string; color: string; icono: string }> = {
  puntual: { nombre: 'A tiempo', color: '#059669', icono: 'pi pi-check-circle' },
  tarde: { nombre: 'Tardanza', color: '#d97706', icono: 'pi pi-clock' },
  pendiente: { nombre: 'Por aprobar', color: '#7c3aed', icono: 'pi pi-hourglass' },
  justificado: { nombre: 'Justificado', color: '#0284c7', icono: 'pi pi-file-check' },
  falta: { nombre: 'Falta', color: '#dc2626', icono: 'pi pi-times-circle' },
  por_llegar: { nombre: 'Aún no llega', color: '#64748b', icono: 'pi pi-stopwatch' },
  descanso: { nombre: 'Descanso', color: '#94a3b8', icono: 'pi pi-moon' },
  futuro: { nombre: '—', color: '#cbd5e1', icono: 'pi pi-minus' },
};

export const JUSTIFICACIONES: Record<Justificacion, { nombre: string; icono: string }> = {
  descanso_medico: { nombre: 'Descanso médico', icono: 'pi pi-heart' },
  vacaciones: { nombre: 'Vacaciones', icono: 'pi pi-sun' },
  permiso: { nombre: 'Permiso', icono: 'pi pi-file-edit' },
  licencia: { nombre: 'Licencia', icono: 'pi pi-briefcase' },
};

export interface DiaPersona {
  estado: EstadoDia;
  marca?: Marca;
  ausencia?: Ausencia;
  /** Minutos tarde (0 si llegó a tiempo). */
  tardanza: number;
  /** Minutos trabajados (sin refrigerio); 0 si aún no marca salida. */
  trabajados: number;
  /** Sigue trabajando (marcó entrada, no salida) — solo hoy. */
  trabajando: boolean;
}

/** Domingo = descanso semanal. */
export function esDescanso(fecha: string): boolean {
  return new Date(`${fecha}T12:00:00`).getDay() === 0;
}

export function diaDe(
  trabajadorId: string,
  fecha: string,
  marcas: readonly Marca[],
  ausencias: readonly Ausencia[],
  horario: Horario,
  hoy: string,
  ahoraMin: number,
): DiaPersona {
  const vacio = { tardanza: 0, trabajados: 0, trabajando: false };
  if (fecha > hoy) return { estado: 'futuro', ...vacio };
  const ausencia = ausencias.find((a) => a.trabajadorId === trabajadorId && a.fecha === fecha);
  const marca = marcas.find((m) => m.trabajadorId === trabajadorId && m.fecha === fecha);
  if (marca?.entrada) {
    const r = resumenDia(marca, horario);
    const trabajando = fecha === hoy && !marca.salida;
    const estado: EstadoDia = marca.pendiente ? 'pendiente' : r.tardanza > 0 ? 'tarde' : 'puntual';
    return { estado, marca, ausencia, tardanza: r.tardanza, trabajados: r.trabajados, trabajando };
  }
  if (ausencia) return { estado: 'justificado', ausencia, ...vacio };
  if (esDescanso(fecha)) return { estado: 'descanso', ...vacio };
  if (fecha === hoy && ahoraMin <= aMinutos(horario.entrada) + horario.tolerancia) {
    return { estado: 'por_llegar', ...vacio };
  }
  return { estado: 'falta', ...vacio };
}

export interface Totales {
  asistencias: number;
  tardanzas: number;
  minutosTarde: number;
  faltas: number;
  justificados: number;
  minutosTrabajados: number;
}

export function totalesDe(dias: readonly DiaPersona[]): Totales {
  const t: Totales = {
    asistencias: 0,
    tardanzas: 0,
    minutosTarde: 0,
    faltas: 0,
    justificados: 0,
    minutosTrabajados: 0,
  };
  for (const d of dias) {
    if (d.estado === 'puntual' || d.estado === 'tarde' || d.estado === 'pendiente') t.asistencias++;
    if (d.estado === 'tarde') {
      t.tardanzas++;
      t.minutosTarde += d.tardanza;
    }
    if (d.estado === 'falta') t.faltas++;
    if (d.estado === 'justificado') t.justificados++;
    t.minutosTrabajados += d.trabajados;
  }
  return t;
}

/** Días del mes de `hoy` (YYYY-MM-DD), del 1 al último. */
export function diasDelMes(hoy: string): string[] {
  const [a, m] = hoy.split('-').map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return Array.from(
    { length: ultimo },
    (_, i) => `${hoy.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`,
  );
}

export function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  );
}
