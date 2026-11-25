import { computed, inject, Injectable, signal } from '@angular/core';
import { hoy, sumarDias } from '../../finanzas/utils/calculos';
import { ETAPAS, indiceEtapa } from '../data/etapas';
import type { Compra, Expediente, Persona, Tarea } from '../models/expediente.model';
import { ServiciosSim } from './servicios-sim.service';

/**
 * SIMULACIÓN de expedientes de servicio (coordinación): solo en memoria.
 * Al conectarlo: tablas propias, cada cambio queda en el historial y se ve en tiempo real.
 */
@Injectable({ providedIn: 'root' })
export class ExpedientesSim {
  private readonly servicios = inject(ServiciosSim);

  /** Quién coordina y quién compra (además de los técnicos). */
  readonly personas = signal<Persona[]>([
    { id: 'yo', nombre: 'Tú', cargo: 'Dueño' },
    { id: 'p1', nombre: 'Ing. Ricardo Flores', cargo: 'Coordinador de servicios' },
    { id: 'p2', nombre: 'José Sánchez', cargo: 'Compras y almacén' },
  ]);

  /** Todos los que pueden recibir una tarea: coordinación + técnicos. */
  readonly asignables = computed(() => [
    ...this.personas(),
    ...this.servicios.tecnicos().map((t) => ({ id: t.id, nombre: t.nombre, cargo: 'Técnico' })),
  ]);

  readonly expedientes = signal<Expediente[]>(this.ejemplo());

  persona(id: string) {
    return this.asignables().find((p) => p.id === id);
  }

  expediente(id: string) {
    return this.expedientes().find((e) => e.id === id);
  }

  crear(datos: Pick<Expediente, 'clienteId' | 'titulo' | 'solicitud' | 'responsableId'>): Expediente {
    const n = this.expedientes().length + 1;
    const e: Expediente = {
      ...datos,
      id: `ex${Date.now()}`,
      codigo: `EXP-${hoy().slice(0, 4)}-${String(n).padStart(3, '0')}`,
      etapa: 'solicitud',
      creado: hoy(),
      ingreso: { personal: [], sctrEnviado: false, induccion: false, guiaRemision: false, correoEnviado: false },
      ordenesTrabajo: [],
      tareas: [],
      compras: [],
      historial: [{ fecha: ahora(), autor: 'Tú', texto: 'Se abrió el expediente con la solicitud del cliente.' }],
    };
    this.expedientes.update((l) => [e, ...l]);
    return e;
  }

  /** Cambia datos y deja constancia en el historial. */
  actualizar(id: string, cambios: Partial<Expediente>, nota?: string) {
    this.expedientes.update((l) =>
      l.map((e) =>
        e.id === id
          ? { ...e, ...cambios, historial: nota ? [{ fecha: ahora(), autor: 'Tú', texto: nota }, ...e.historial] : e.historial }
          : e,
      ),
    );
  }

  avanzar(id: string, cambios: Partial<Expediente>, nota: string) {
    const e = this.expediente(id);
    if (!e) return;
    const siguiente = ETAPAS[Math.min(indiceEtapa(e.etapa) + 1, ETAPAS.length - 1)].clave;
    this.actualizar(id, { ...cambios, etapa: siguiente }, nota);
  }

  agregarTarea(id: string, t: Omit<Tarea, 'id' | 'hecha'>) {
    const e = this.expediente(id);
    if (!e) return;
    this.actualizar(id, { tareas: [...e.tareas, { ...t, id: crypto.randomUUID(), hecha: false }] }, `Tarea para ${this.persona(t.asignadoA)?.nombre}: ${t.texto}`);
  }

  alternarTarea(id: string, tareaId: string) {
    const e = this.expediente(id);
    const t = e?.tareas.find((x) => x.id === tareaId);
    if (!e || !t) return;
    this.actualizar(
      id,
      { tareas: e.tareas.map((x) => (x.id === tareaId ? { ...x, hecha: !x.hecha } : x)) },
      `${t.hecha ? 'Se reabrió' : 'Cumplida'}: ${t.texto}`,
    );
  }

  agregarCompra(id: string, c: Omit<Compra, 'id' | 'estado'>) {
    const e = this.expediente(id);
    if (!e) return;
    this.actualizar(id, { compras: [...e.compras, { ...c, id: crypto.randomUUID(), estado: 'por_pedir' }] }, `Material por comprar: ${c.descripcion}`);
  }

  cambiarCompra(id: string, compraId: string, estado: Compra['estado']) {
    const e = this.expediente(id);
    const c = e?.compras.find((x) => x.id === compraId);
    if (!e || !c) return;
    const textos = { por_pedir: 'por pedir', pedido: 'pedido al proveedor', llego: 'llegó' };
    this.actualizar(id, { compras: e.compras.map((x) => (x.id === compraId ? { ...x, estado } : x)) }, `${c.descripcion}: ${textos[estado]}`);
  }

  private ejemplo(): Expediente[] {
    const h = hoy();
    const base = { ingreso: { personal: [] as string[], sctrEnviado: false, induccion: false, guiaRemision: false, correoEnviado: false }, ordenesTrabajo: [] as string[], compras: [] as Compra[], tareas: [] as Tarea[] };
    return [
      {
        ...base,
        id: 'ex1',
        codigo: 'EXP-2026-014',
        clienteId: 'c1',
        titulo: 'Cámara 1 no baja de -10 °C',
        solicitud: 'Correo de la Ing. Rosa Pérez: la cámara de producto terminado no llega a temperatura. Urgente por exportación.',
        responsableId: 'p1',
        etapa: 'ejecucion',
        creado: sumarDias(h, -3),
        cotizacion: { numero: 'COT-2026-088', monto: 2850, fecha: sumarDias(h, -3) },
        ordenCliente: { numero: 'OS-4500021987', fecha: sumarDias(h, -2) },
        ingreso: { personal: ['t1', 't2'], fecha: h, sctrEnviado: true, induccion: true, guiaRemision: true, correoEnviado: true },
        ordenesTrabajo: ['ot1'],
        compras: [
          { id: 'k1', descripcion: 'Filtro secador 5/8" roscable', proveedor: 'Frío Importaciones', estado: 'llego' },
          { id: 'k2', descripcion: 'Gas R-404A (balón 10.9 kg)', proveedor: 'Friotem', estado: 'llego' },
        ],
        tareas: [
          { id: 'a1', texto: 'Enviar lista de personal y SCTR a seguridad de planta', asignadoA: 'p1', vence: sumarDias(h, -1), hecha: true },
          { id: 'a2', texto: 'Comprar filtro secador y gas', asignadoA: 'p2', vence: sumarDias(h, -1), hecha: true },
          { id: 'a3', texto: 'Subir fotos del antes y después', asignadoA: 't1', vence: h, hecha: false },
        ],
        historial: [
          { fecha: `${h} 08:40`, autor: 'Carlos Huamán', texto: 'Inició la orden de trabajo OT-000241 en planta.' },
          { fecha: `${sumarDias(h, -1)} 17:10`, autor: 'José Sánchez', texto: 'Llegaron el filtro secador y el gas.' },
          { fecha: `${sumarDias(h, -2)} 11:30`, autor: 'Ing. Ricardo Flores', texto: 'El cliente envió la orden de servicio OS-4500021987.' },
          { fecha: `${sumarDias(h, -3)} 16:00`, autor: 'Ing. Ricardo Flores', texto: 'Cotización COT-2026-088 enviada por S/ 2,850.00.' },
        ],
      },
      {
        ...base,
        id: 'ex2',
        codigo: 'EXP-2026-015',
        clienteId: 'c2',
        titulo: 'Mantenimiento trimestral del chiller',
        solicitud: 'Contrato de mantenimiento preventivo: visita de noviembre.',
        responsableId: 'p1',
        etapa: 'cotizacion',
        creado: sumarDias(h, -2),
        cotizacion: { numero: 'COT-2026-091', monto: 1650, fecha: sumarDias(h, -1) },
        tareas: [{ id: 'b1', texto: 'Llamar para confirmar si aprueban la cotización', asignadoA: 'p1', vence: h, hecha: false }],
        historial: [{ fecha: `${sumarDias(h, -1)} 10:15`, autor: 'Ing. Ricardo Flores', texto: 'Cotización COT-2026-091 enviada por S/ 1,650.00.' }],
      },
      {
        ...base,
        id: 'ex3',
        codigo: 'EXP-2026-016',
        clienteId: 'c3',
        titulo: 'Instalación de vitrina nueva (lácteos)',
        solicitud: 'WhatsApp de la Sra. Ana Rojas: quiere cambiar la vitrina de lácteos antes de diciembre.',
        responsableId: 'p1',
        etapa: 'orden_cliente',
        creado: sumarDias(h, -6),
        cotizacion: { numero: 'COT-2026-079', monto: 12400, fecha: sumarDias(h, -6) },
        ordenCliente: { numero: 'OC-000318', fecha: sumarDias(h, -1) },
        ingreso: { personal: ['t3'], sctrEnviado: false, induccion: false, guiaRemision: false, correoEnviado: false },
        compras: [{ id: 'k3', descripcion: 'Vitrina refrigerada 2.5 m', proveedor: 'Por definir', estado: 'por_pedir' }],
        tareas: [{ id: 'c1', texto: 'Cotizar la vitrina con dos proveedores', asignadoA: 'p2', vence: sumarDias(h, 1), hecha: false }],
        historial: [{ fecha: `${sumarDias(h, -1)} 09:00`, autor: 'Ing. Ricardo Flores', texto: 'El cliente aprobó: orden de compra OC-000318.' }],
      },
      {
        ...base,
        id: 'ex4',
        codigo: 'EXP-2026-012',
        clienteId: 'c2',
        titulo: 'Cambio de contactor del compresor 2',
        solicitud: 'Emergencia: compresor 2 del chiller no arranca.',
        responsableId: 'p1',
        etapa: 'facturado',
        creado: sumarDias(h, -10),
        cotizacion: { numero: 'COT-2026-070', monto: 980, fecha: sumarDias(h, -10) },
        ordenCliente: { numero: 'OS-4500021550', fecha: sumarDias(h, -10) },
        ingreso: { personal: ['t1', 't3'], fecha: sumarDias(h, -9), sctrEnviado: true, induccion: true, guiaRemision: false, correoEnviado: true },
        ordenesTrabajo: ['ot5'],
        conformidad: { fecha: sumarDias(h, -8), hes: '1000045521' },
        factura: { numero: 'F001-125', fecha: sumarDias(h, -7) },
        historial: [{ fecha: `${sumarDias(h, -7)} 12:00`, autor: 'Tú', texto: 'Factura F001-125 emitida (vence a 30 días).' }],
      },
    ];
  }
}

function ahora(): string {
  const a = new Date();
  return `${hoy()} ${String(a.getHours()).padStart(2, '0')}:${String(a.getMinutes()).padStart(2, '0')}`;
}
