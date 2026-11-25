import { computed, Injectable, signal } from '@angular/core';
import { hoy } from '../../finanzas/utils/calculos';
import type { Ausencia, Horario, Marca, Trabajador } from '../models/personal.model';

/** Oficina de la empresa (simulación: La Tinguiña, Ica). */
export const OFICINA = { lat: -14.0347, lng: -75.6969, nombre: 'Oficina principal · La Tinguiña' };

/**
 * SIMULACIÓN de asistencia: trabajadores y marcas de ejemplo solo en memoria.
 * Al conectarlo, las marcas se guardan en la base (inalterables) y el registro se conserva 5 años.
 */
@Injectable({ providedIn: 'root' })
export class AsistenciaSim {
  readonly horario = signal<Horario>({
    entrada: '08:00',
    salida: '17:00',
    refrigerio: 60,
    refrigerioDesde: '12:00',
    refrigerioHasta: '15:00',
    tolerancia: 10,
    jornada: 480,
    metodos: { gps: true, qr: true, manual: true },
    radioOficina: 150,
    selfie: true,
  });

  readonly trabajadores = signal<Trabajador[]>([
    { id: 't1', nombre: 'Carlos Huamán', dni: '40000001', cargo: 'Técnico de refrigeración', campo: true },
    { id: 't2', nombre: 'Luis Quispe', dni: '40000002', cargo: 'Técnico electricista', campo: true },
    { id: 't3', nombre: 'Jorge Mendoza', dni: '40000003', cargo: 'Técnico de aire acondicionado', campo: true },
    { id: 'a1', nombre: 'María Salazar', dni: '40000004', cargo: 'Asistente administrativa', campo: false },
    { id: 'a2', nombre: 'José Sánchez', dni: '40000005', cargo: 'Almacenero', campo: false },
    { id: 'a3', nombre: 'Patricia Ramos', dni: '40000006', cargo: 'Ventas', campo: false },
  ]);

  readonly marcas = signal<Marca[]>(generarMes());
  readonly ausencias = signal<Ausencia[]>([
    { trabajadorId: 'a3', fecha: hoy(), tipo: 'descanso_medico' },
  ]);

  readonly hoy = computed(() => {
    const h = hoy();
    return this.marcas().filter((m) => m.fecha === h);
  });

  trabajador(id: string) {
    return this.trabajadores().find((t) => t.id === id);
  }

  marcaDe(trabajadorId: string, fecha = hoy()) {
    return this.marcas().find((m) => m.trabajadorId === trabajadorId && m.fecha === fecha);
  }

  /**
   * Marca entrada (si no hay) o salida (si ya marcó entrada). Devuelve qué marcó.
   * `hora` solo para el registro sin GPS (el trabajador indica la hora; el supervisor la aprueba).
   */
  marcar(
    trabajadorId: string,
    datos: Pick<Marca, 'metodo' | 'lugar' | 'dentroDeZona' | 'motivoManual' | 'pendiente'>,
    hora?: string,
  ): 'entrada' | 'salida' | 'ya' {
    const ahora = new Date();
    const hhmm = hora ?? `${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`;
    const actual = this.marcaDe(trabajadorId);
    if (actual?.salida) return 'ya';
    if (actual) {
      const salidaEnCampo = !datos.dentroDeZona || datos.lugar !== OFICINA.nombre;
      this.marcas.update((l) =>
        l.map((m) =>
          m === actual
            ? { ...m, salida: hhmm, salidaEnCampo, pendiente: m.pendiente || datos.pendiente, motivoManual: datos.motivoManual ?? m.motivoManual }
            : m,
        ),
      );
      return 'salida';
    }
    this.marcas.update((l) => [...l, { trabajadorId, fecha: hoy(), entrada: hhmm, ...datos }]);
    return 'entrada';
  }

  /** El supervisor aprueba una marca hecha sin GPS. */
  aprobar(trabajadorId: string, fecha = hoy()) {
    this.marcas.update((l) => l.map((m) => (m.trabajadorId === trabajadorId && m.fecha === fecha ? { ...m, pendiente: false } : m)));
  }

  readonly porAprobar = computed(() => this.marcas().filter((m) => m.pendiente));

  guardarHorario(h: Horario) {
    this.horario.set(h);
  }
}

/** Mes de ejemplo hasta ayer + la mañana de hoy (determinístico para que siempre se vea igual). */
function generarMes(): Marca[] {
  const marcas: Marca[] = [];
  const h = new Date();
  const ids = ['t1', 't2', 't3', 'a1', 'a2', 'a3'];
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
  const hora = (base: number, desvio: number) => {
    const m = Math.round(base + (azar() - 0.5) * desvio);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };

  for (let d = 1; d <= h.getDate(); d++) {
    const dia = new Date(h.getFullYear(), h.getMonth(), d);
    if (dia.getDay() === 0) continue; // domingo
    const fecha = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const esHoy = d === h.getDate();
    const sabado = dia.getDay() === 6;
    for (const id of ids) {
      if (azar() < 0.05 || (esHoy && id === 'a3')) continue; // falta o descanso médico
      const campo = id.startsWith('t') && azar() < 0.55;
      const entrada = hora(8 * 60 + (azar() < 0.12 ? 22 : 2), 16);
      const salidaBase = sabado ? 13 * 60 : 17 * 60 + (campo && azar() < 0.35 ? 110 : 5);
      marcas.push({
        trabajadorId: id,
        fecha,
        entrada,
        salida: esHoy ? undefined : hora(salidaBase, 20),
        metodo: campo ? 'gps' : azar() < 0.85 ? 'qr' : 'gps',
        lugar: campo ? ['Agroexportadora Valle Sur · Packing', 'Pesquera Del Pacífico · Planta', 'Supermercado El Ahorro'][Math.floor(azar() * 3)] : OFICINA.nombre,
        dentroDeZona: true,
      });
    }
  }
  return marcas;
}
