import { computed, inject, Injectable, signal } from '@angular/core';
import { hoy } from '../../finanzas/utils/calculos';
import { DatosEmpresa } from '../../servicios/services/datos-empresa.service';
import type { Ausencia, Horario, Marca, Trabajador } from '../models/personal.model';

/** Nombre con que se registra una marca hecha dentro de la oficina. */
export const LUGAR_OFICINA = 'Oficina';

/**
 * VISTA PREVIA de asistencia: las marcas viven en memoria (aún no se guardan).
 * Los trabajadores son el personal REAL de la empresa; las marcas empiezan vacías.
 * Al conectarlo, cada marca se guarda inalterable y el registro se conserva 5 años.
 */
@Injectable({ providedIn: 'root' })
export class AsistenciaSim {
  private readonly datos = inject(DatosEmpresa);

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
    oficina: null,
  });

  /** Personal activo (Equipo y accesos). Los del área técnica trabajan en campo. */
  readonly trabajadores = computed<Trabajador[]>(() =>
    this.datos.activos().map((m) => ({
      id: m.usuarioId,
      nombre: m.nombre || m.correo,
      dni: '',
      cargo: m.areas.includes('tecnica') ? 'Área técnica' : m.rol === 'dueno' ? 'Dueño' : 'Personal',
      campo: m.areas.includes('tecnica'),
    })),
  );

  readonly marcas = signal<Marca[]>([]);
  readonly ausencias = signal<Ausencia[]>([]);

  readonly porAprobar = computed(() => this.marcas().filter((m) => m.pendiente));

  /** Quien usa la app (para marcar desde su propio celular). */
  readonly yoId = computed(() => this.datos.yo().id);

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
      const salidaEnCampo = !datos.dentroDeZona || datos.lugar !== LUGAR_OFICINA;
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

  guardarHorario(h: Horario) {
    this.horario.set(h);
  }
}
