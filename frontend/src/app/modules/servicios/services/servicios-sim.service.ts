import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { hoy } from '../../finanzas/utils/calculos';
import { ATS, MEDICIONES } from '../data/catalogos';
import type { Cliente, Equipo, EstadoOrden, Informe, Mensaje, OrdenTrabajo, SeccionInforme, Tecnico } from '../models/servicios.model';

/**
 * SIMULACIÓN del área técnica: datos de ejemplo solo en memoria (no se guardan en la base).
 * Sirve para ver y aprobar el diseño; al conectarlo se reemplaza por la API.
 */
@Injectable({ providedIn: 'root' })
export class ServiciosSim {
  readonly tecnicos = signal<Tecnico[]>([
    { id: 't1', nombre: 'Carlos Huamán', especialidad: 'Refrigeración industrial', sctrHasta: '2027-03-31' },
    { id: 't2', nombre: 'Luis Quispe', especialidad: 'Electricidad y control', sctrHasta: '2026-12-15' },
    { id: 't3', nombre: 'Jorge Mendoza', especialidad: 'Aire acondicionado', sctrHasta: '2026-11-20' },
  ]);

  readonly clientes = signal<Cliente[]>([
    { id: 'c1', razonSocial: 'Agroexportadora Valle Sur S.A.C.', ruc: '20600000001', contacto: 'Ing. Rosa Pérez', direccion: 'Panamericana Sur Km 300, Ica' },
    { id: 'c2', razonSocial: 'Pesquera Del Pacífico S.A.', ruc: '20600000002', contacto: 'Sr. Miguel Torres', direccion: 'Av. Los Pescadores 450, Pisco' },
    { id: 'c3', razonSocial: 'Supermercado El Ahorro E.I.R.L.', ruc: '20600000003', contacto: 'Sra. Ana Rojas', direccion: 'Calle Lima 120, Ica' },
  ]);

  readonly equipos = signal<Equipo[]>([
    { id: 'e1', clienteId: 'c1', codigo: 'VS-CF-01', tipo: 'Cámara frigorífica', marca: 'Bitzer', modelo: '4FES-5Y', serie: 'BZ88231', refrigerante: 'R-404A', capacidad: '12 HP', ubicacion: 'Packing · cámara 1' },
    { id: 'e2', clienteId: 'c1', codigo: 'VS-TC-02', tipo: 'Túnel de congelado', marca: 'Copeland', modelo: 'ZB76KCE', serie: 'CP55120', refrigerante: 'R-507', capacidad: '20 HP', ubicacion: 'Packing · túnel 2' },
    { id: 'e3', clienteId: 'c2', codigo: 'PP-CH-01', tipo: 'Chiller', marca: 'Carrier', modelo: '30RB-060', serie: 'CA77002', refrigerante: 'R-410A', capacidad: '60 TR', ubicacion: 'Planta de proceso' },
    { id: 'e4', clienteId: 'c3', codigo: 'EA-VR-03', tipo: 'Vitrina refrigerada', marca: 'Danfoss', modelo: 'MTZ28', serie: 'DF10234', refrigerante: 'R-404A', capacidad: '3 HP', ubicacion: 'Sala de ventas · lácteos' },
  ]);

  readonly ordenes = signal<OrdenTrabajo[]>(this.ejemplo());

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

  crear(o: Omit<OrdenTrabajo, 'id' | 'numero' | 'estado' | 'informe' | 'mensajes'>): OrdenTrabajo {
    const n = this.ordenes().length + 1;
    const nueva: OrdenTrabajo = {
      ...o,
      id: `ot${Date.now()}`,
      numero: `OT-${String(240 + n).padStart(6, '0')}`,
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

  // ── Presencia en tiempo real (simulada) ───────────────────────
  // En la versión real: Supabase Realtime "presence" (cada celular avisa qué sección tiene abierta).
  private readonly pulso = signal(0);
  private readonly recorrido: SeccionInforme[] = ['mediciones', 'mediciones', 'trabajos', 'trabajos', 'fotos', 'ats'];

  /** Quién está viendo o editando cada orden ahora, y en qué sección. */
  readonly presencia = computed<Record<string, { tecnicoId: string; seccion: SeccionInforme }[]>>(() => {
    const p = this.pulso();
    return {
      ot2: [{ tecnicoId: 't1', seccion: this.recorrido[p % this.recorrido.length] }],
      ot1: [{ tecnicoId: 't2', seccion: 'conformidad' }],
    };
  });

  constructor() {
    const id = setInterval(() => this.pulso.update((n) => n + 1), 7000);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }

  private ejemplo(): OrdenTrabajo[] {
    const h = hoy();
    const lleno = (): Informe => ({
      ...informeVacio(),
      ats: Object.fromEntries(ATS.map((a) => [a.clave, true])),
      mediciones: [
        { clave: 'presionAlta', valor: 245 },
        { clave: 'presionBaja', valor: 28 },
        { clave: 'tempCamara', valor: -18 },
        { clave: 'tempAmbiente', valor: 27 },
        { clave: 'amperaje', valor: 18.5 },
        { clave: 'voltaje', valor: 380 },
      ],
      diagnostico: 'Baja presión de succión por fuga en la válvula de servicio y filtro secador saturado.',
      trabajos: 'Se recuperó el refrigerante, se cambió el filtro secador y el núcleo de la válvula. Prueba de hermeticidad con nitrógeno a 300 psi, vacío a 500 micrones y carga de R-404A.',
      repuestos: [
        { descripcion: 'Filtro secador 5/8" roscable', cantidad: 1, unidad: 'UND' },
        { descripcion: 'Núcleo de válvula Danfoss', cantidad: 2, unidad: 'UND' },
      ],
      gasCargadoKg: 4.5,
      gasRecuperadoKg: 3.8,
      recomendaciones: 'Programar limpieza de condensador en 30 días. Revisar aislamiento de la línea de succión.',
      equipoOperativo: true,
      inicio: `${h}T08:40`,
      fin: `${h}T12:15`,
    });
    return [
      { id: 'ot1', numero: 'OT-000241', clienteId: 'c1', equipoId: 'e1', tipo: 'correctivo', prioridad: 'urgente', tecnicos: ['t1', 't2'], fecha: h, hora: '08:30', descripcion: 'La cámara no baja de -10 °C. Producto en riesgo.', estado: 'por_firmar', informe: lleno(), mensajes: [
        { autorId: 't2', autor: 'Luis Quispe', texto: 'Ya desenergicé el tablero, pueden empezar.', hora: '08:42' },
        { autorId: 't1', autor: 'Carlos Huamán', texto: 'Encontré el filtro secador saturado, lo cambio. ¿Alguien trae núcleos de válvula?', hora: '09:15' },
        { autorId: 't2', autor: 'Luis Quispe', texto: 'Sí, tengo dos en la camioneta.', hora: '09:17' },
      ] },
      { id: 'ot2', numero: 'OT-000242', clienteId: 'c2', equipoId: 'e3', tipo: 'preventivo', prioridad: 'media', tecnicos: ['t1'], fecha: h, hora: '14:00', descripcion: 'Mantenimiento trimestral del chiller.', estado: 'en_curso', informe: { ...informeVacio(), ats: { epp: true, sctr: true, loto: true }, inicio: `${h}T14:05` }, mensajes: [
        { autorId: 't1', autor: 'Carlos Huamán', texto: 'Llegué a la planta, empiezo con el ATS.', hora: '14:03' },
      ] },
      { id: 'ot3', numero: 'OT-000243', clienteId: 'c3', equipoId: 'e4', tipo: 'inspeccion', prioridad: 'alta', tecnicos: ['t3'], fecha: h, hora: '16:30', descripcion: 'Vitrina con escarcha excesiva.', estado: 'programada', informe: informeVacio(), mensajes: [] },
      { id: 'ot4', numero: 'OT-000244', clienteId: 'c1', equipoId: 'e2', tipo: 'preventivo', prioridad: 'baja', tecnicos: ['t2'], fecha: h, hora: '10:00', descripcion: 'Limpieza de evaporadores del túnel.', estado: 'programada', informe: informeVacio(), mensajes: [] },
      { id: 'ot5', numero: 'OT-000240', clienteId: 'c2', equipoId: 'e3', tipo: 'correctivo', prioridad: 'alta', tecnicos: ['t1', 't3'], fecha: h, hora: '07:00', descripcion: 'Cambio de contactor del compresor 2.', estado: 'cerrada', informe: { ...lleno(), firmaNombre: 'Miguel Torres', firmaDni: '40000000' }, mensajes: [] },
    ];
  }
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
