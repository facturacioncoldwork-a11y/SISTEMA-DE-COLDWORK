import { computed, inject, Injectable, signal } from '@angular/core';
import { NOMBRE_ROL } from '../../../core/permisos/areas';
import { hoy } from '../../finanzas/utils/calculos';
import { ETAPAS, indiceEtapa } from '../data/etapas';
import type { HitoPago } from '../models/cotizacion.model';
import type { Compra, Expediente, Persona, Tarea } from '../models/expediente.model';
import { DatosEmpresa } from './datos-empresa.service';

/**
 * VISTA PREVIA de la coordinación de servicios (expedientes): en memoria, aún no se guarda.
 * Las personas son el personal REAL de la empresa; los servicios empiezan vacíos.
 * Al conectarlo: tablas propias, cada cambio queda en el historial y se ve en tiempo real.
 */
@Injectable({ providedIn: 'root' })
export class ExpedientesSim {
  private readonly datos = inject(DatosEmpresa);

  /** Quien usa la app + su personal (Equipo y accesos). */
  readonly personas = computed<Persona[]>(() => {
    const yo = this.datos.yo();
    const otros = this.datos
      .activos()
      .filter((m) => m.usuarioId !== yo.id)
      .map((m) => ({ id: m.usuarioId, nombre: m.nombre || m.correo, cargo: NOMBRE_ROL[m.rol] }));
    return [{ id: yo.id, nombre: `${yo.nombre} (tú)`, cargo: 'Tú' }, ...otros];
  });

  /** Todos los que pueden recibir una tarea. */
  readonly asignables = this.personas;

  readonly expedientes = signal<Expediente[]>([]);

  persona(id: string) {
    return this.asignables().find((p) => p.id === id);
  }

  expediente(id: string) {
    return this.expedientes().find((e) => e.id === id);
  }

  private autor(): string {
    return this.datos.yo().nombre;
  }

  crear(datos: Pick<Expediente, 'clienteId' | 'titulo' | 'solicitud' | 'responsableId'>): Expediente {
    const n = this.expedientes().length + 1;
    const e: Expediente = {
      ...datos,
      id: crypto.randomUUID(),
      codigo: `EXP-${hoy().slice(0, 4)}-${String(n).padStart(3, '0')}`,
      etapa: 'solicitud',
      creado: hoy(),
      ingreso: { personal: [], sctrEnviado: false, induccion: false, guiaRemision: false, correoEnviado: false },
      ordenesTrabajo: [],
      tareas: [],
      compras: [],
      historial: [{ fecha: ahora(), autor: this.autor(), texto: 'Se abrió el expediente con la solicitud del cliente.' }],
    };
    this.expedientes.update((l) => [e, ...l]);
    return e;
  }

  /** Cambia datos y deja constancia en el historial. */
  actualizar(id: string, cambios: Partial<Expediente>, nota?: string) {
    this.expedientes.update((l) =>
      l.map((e) =>
        e.id === id
          ? { ...e, ...cambios, historial: nota ? [{ fecha: ahora(), autor: this.autor(), texto: nota }, ...e.historial] : e.historial }
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

  /** Avanza un hito de pago: pendiente → facturado (factura de anticipo) → cobrado. */
  cambiarHito(id: string, hitoId: string, estado: HitoPago['estado'], factura?: string) {
    const e = this.expediente(id);
    const h = e?.hitos?.find((x) => x.id === hitoId);
    if (!e || !h) return;
    const texto = estado === 'facturado' ? `Factura ${factura} emitida por "${h.descripcion}" (${h.porcentaje} %).` : `Cobrado: "${h.descripcion}" (${h.porcentaje} %).`;
    this.actualizar(id, { hitos: e.hitos!.map((x) => (x.id === hitoId ? { ...x, estado, factura: factura ?? x.factura } : x)) }, texto);
  }

  /** ¿Ya se puede programar el trabajo? (si exige adelanto, el primer hito debe estar cobrado). */
  adelantoListo(e: Expediente): boolean {
    return !e.exigirAdelanto || !e.hitos?.length || e.hitos[0].estado === 'cobrado';
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
}

function ahora(): string {
  const a = new Date();
  return `${hoy()} ${String(a.getHours()).padStart(2, '0')}:${String(a.getMinutes()).padStart(2, '0')}`;
}
