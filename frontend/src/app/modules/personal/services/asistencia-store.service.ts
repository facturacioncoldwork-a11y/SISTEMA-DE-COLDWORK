import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { mensajeError } from '../../../core/api/errores';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import { hoy } from '../../finanzas/utils/calculos';
import { DatosEmpresa } from '../../servicios/services/datos-empresa.service';
import type { Ausencia, Horario, Marca, ResultadoMarca, Trabajador } from '../models/personal.model';
import { AsistenciaApi, type HorarioApi } from './asistencia-api.service';

/** Lugar con que la base registra una marca dentro de la oficina. */
export const LUGAR_OFICINA = 'Oficina';

const POR_DEFECTO: Horario = {
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

function aMinutos(h: string) {
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
}

/**
 * Asistencia guardada en la base de datos. La hora de cada marca la pone el servidor (Lima)
 * y las marcas no se pueden editar ni borrar. Solo se carga el mes en curso (rápido).
 */
@Injectable({ providedIn: 'root' })
export class AsistenciaStore {
  private readonly api = inject(AsistenciaApi);
  private readonly datos = inject(DatosEmpresa);
  private readonly empresa = inject(EmpresaActualService);
  private readonly avisos = inject(MessageService);

  readonly horario = signal<Horario>(POR_DEFECTO);
  readonly esGestor = signal(false);
  readonly marcas = signal<Marca[]>([]);
  readonly ausencias = signal<Ausencia[]>([]);
  readonly cargando = signal(false);
  private cargadoPara: string | null = null;

  readonly yoId = computed(() => this.datos.yo().id);

  /** Personal activo (Equipo y accesos). Quien no gestiona solo se ve a sí mismo. */
  readonly trabajadores = computed<Trabajador[]>(() => {
    const lista = this.datos.activos().map((m) => ({
      id: m.usuarioId,
      nombre: m.nombre,
      cargo: m.areas.includes('tecnica') ? 'Área técnica' : m.rol === 'dueno' ? 'Dueño' : 'Personal',
      campo: m.areas.includes('tecnica'),
    }));
    if (lista.length) return lista;
    const yo = this.datos.yo();
    return [{ id: yo.id, nombre: yo.nombre, cargo: '', campo: this.empresa.puede('tecnica') }];
  });

  readonly porAprobar = computed(() => this.marcas().filter((m) => m.pendiente));

  constructor() {
    effect(() => {
      const id = this.empresa.id();
      if (id && id !== this.cargadoPara) {
        this.cargadoPara = id;
        void this.recargar();
      }
    });
  }

  trabajador(id: string) {
    return this.trabajadores().find((t) => t.id === id);
  }

  marcaDe(trabajadorId: string, fecha = hoy()) {
    return this.marcas().find((m) => m.trabajadorId === trabajadorId && m.fecha === fecha);
  }

  async recargar() {
    this.cargando.set(true);
    const inicioMes = `${hoy().slice(0, 7)}-01`;
    const [h, m] = await Promise.allSettled([this.api.horario(), this.api.marcas(inicioMes, hoy())]);
    if (h.status === 'fulfilled') {
      this.horario.set(desdeApi(h.value));
      this.esGestor.set(!!h.value.esGestor);
    }
    if (m.status === 'fulfilled') {
      this.marcas.set(m.value.marcas);
      this.ausencias.set(m.value.ausencias);
    } else {
      this.avisos.add({ severity: 'error', summary: 'No se pudo cargar la asistencia', detail: mensajeError(m.reason), life: 5000 });
    }
    this.cargando.set(false);
  }

  /** Marca propia (la hora la pone el servidor). Lanza el error de la API para mostrarlo. */
  async marcar(datos: Parameters<AsistenciaApi['marcar']>[0]): Promise<ResultadoMarca> {
    const r = await this.api.marcar(datos);
    await this.recargar();
    return r;
  }

  async marcarManual(usuarioId: string, motivo: string): Promise<ResultadoMarca> {
    const r = await this.api.marcarManual(usuarioId, motivo);
    await this.recargar();
    return r;
  }

  async aprobar(marcaId: string) {
    await this.api.aprobar(marcaId);
    await this.recargar();
  }

  async guardarHorario(h: Horario) {
    await this.api.guardarHorario({
      entrada: h.entrada,
      salida: h.salida,
      refrigerio: h.refrigerio,
      refrigerioDesde: h.refrigerioDesde,
      refrigerioHasta: h.refrigerioHasta,
      tolerancia: h.tolerancia,
      metodos: (Object.keys(h.metodos) as (keyof Horario['metodos'])[]).filter((k) => h.metodos[k]),
      selfie: h.selfie,
      oficinaLat: h.oficina?.lat ?? null,
      oficinaLng: h.oficina?.lng ?? null,
      radioOficina: h.radioOficina,
    });
    this.horario.set({ ...h, jornada: aMinutos(h.salida) - aMinutos(h.entrada) - h.refrigerio });
  }

  codigoOficina() {
    return this.api.codigoOficina();
  }
}

function desdeApi(h: HorarioApi): Horario {
  return {
    entrada: h.entrada,
    salida: h.salida,
    refrigerio: h.refrigerio,
    refrigerioDesde: h.refrigerioDesde,
    refrigerioHasta: h.refrigerioHasta,
    tolerancia: h.tolerancia,
    jornada: Math.min(480, aMinutos(h.salida) - aMinutos(h.entrada) - h.refrigerio),
    metodos: { gps: h.metodos.includes('gps'), codigo: h.metodos.includes('codigo'), manual: h.metodos.includes('manual') },
    radioOficina: h.radioOficina,
    selfie: h.selfie,
    oficina: h.oficinaLat !== null && h.oficinaLng !== null ? { lat: h.oficinaLat, lng: h.oficinaLng } : null,
  };
}
