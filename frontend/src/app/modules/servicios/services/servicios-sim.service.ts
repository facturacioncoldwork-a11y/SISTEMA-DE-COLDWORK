import { computed, inject, Injectable, signal } from '@angular/core';
import { MEDICIONES } from '../data/catalogos';
import type { Cliente, Equipo, EstadoOrden, Informe, Mensaje, OrdenTrabajo, SeccionInforme, Tecnico } from '../models/servicios.model';
import { DatosEmpresa } from './datos-empresa.service';

/**
 * VISTA PREVIA del área técnica: órdenes de trabajo e informes en memoria (aún no se guardan).
 * Clientes y técnicos son los REALES de la empresa; las órdenes y equipos empiezan vacíos.
 */
@Injectable({ providedIn: 'root' })
export class ServiciosSim {
  private readonly datos = inject(DatosEmpresa);

  /** Personal con el área técnica (Equipo y accesos). El SCTR se registrará al conectar el módulo. */
  readonly tecnicos = computed<Tecnico[]>(() =>
    this.datos.conArea('tecnica').map((m) => ({ id: m.usuarioId, nombre: m.nombre || m.correo, especialidad: 'Área técnica', sctrHasta: null })),
  );

  /** Clientes de Finanzas · Clientes y proveedores. */
  readonly clientes = computed<Cliente[]>(() =>
    this.datos.clientes().map((t) => ({
      id: t.id,
      razonSocial: t.razonSocial,
      ruc: t.numeroDocumento,
      contacto: t.contacto ?? '',
      direccion: t.direccion ?? '',
    })),
  );

  readonly equipos = signal<Equipo[]>([]);
  readonly ordenes = signal<OrdenTrabajo[]>([]);

  readonly porEstado = computed(() => {
    const grupos: Record<EstadoOrden, OrdenTrabajo[]> = { programada: [], en_curso: [], por_firmar: [], cerrada: [] };
    for (const o of this.ordenes()) grupos[o.estado].push(o);
    return grupos;
  });

  cliente(id: string) {
    return this.clientes().find((c) => c.id === id);
  }
  equipo(id: string) {
    return this.equipos().find((e) => e.id === id);
  }
  tecnico(id: string) {
    return this.tecnicos().find((t) => t.id === id);
  }
  orden(id: string) {
    return this.ordenes().find((o) => o.id === id);
  }

  agregarEquipo(e: Omit<Equipo, 'id'>): Equipo {
    const nuevo = { ...e, id: crypto.randomUUID() };
    this.equipos.update((l) => [...l, nuevo]);
    return nuevo;
  }

  crear(o: Omit<OrdenTrabajo, 'id' | 'numero' | 'estado' | 'informe' | 'mensajes'>): OrdenTrabajo {
    const n = this.ordenes().length + 1;
    const nueva: OrdenTrabajo = {
      ...o,
      id: crypto.randomUUID(),
      numero: `OT-${String(n).padStart(6, '0')}`,
      estado: 'programada',
      informe: informeVacio(),
      mensajes: [],
    };
    this.ordenes.update((l) => [nueva, ...l]);
    return nueva;
  }

  actualizar(id: string, cambios: Partial<OrdenTrabajo>) {
    this.ordenes.update((l) => l.map((o) => (o.id === id ? { ...o, ...cambios } : o)));
  }

  actualizarInforme(id: string, cambios: Partial<Informe>) {
    this.ordenes.update((l) => l.map((o) => (o.id === id ? { ...o, informe: { ...o.informe, ...cambios } } : o)));
  }

  enviarMensaje(id: string, m: Omit<Mensaje, 'hora'>) {
    const a = new Date();
    const hora = `${String(a.getHours()).padStart(2, '0')}:${String(a.getMinutes()).padStart(2, '0')}`;
    this.ordenes.update((l) => l.map((o) => (o.id === id ? { ...o, mensajes: [...o.mensajes, { ...m, hora }] } : o)));
  }

  /**
   * Quién está editando cada orden en tiempo real. Vacío en la vista previa: al conectarlo se llena
   * con Supabase Realtime (cada celular avisa qué sección tiene abierta).
   */
  readonly presencia = signal<Record<string, { tecnicoId: string; seccion: SeccionInforme }[]>>({});
}

export function informeVacio(): Informe {
  return {
    ats: {},
    mediciones: MEDICIONES.map((m) => ({ clave: m.clave, valor: null })),
    diagnostico: '',
    trabajos: '',
    repuestos: [],
    gasCargadoKg: null,
    gasRecuperadoKg: null,
    fotos: [],
    recomendaciones: '',
    equipoOperativo: null,
  };
}
