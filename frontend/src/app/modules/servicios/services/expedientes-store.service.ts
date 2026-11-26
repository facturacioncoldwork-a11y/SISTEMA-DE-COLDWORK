import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { mensajeError } from '../../../core/api/errores';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import { NOMBRE_ROL } from '../../../core/permisos/areas';
import { hoy } from '../../finanzas/utils/calculos';
import { ETAPAS, indiceEtapa } from '../data/etapas';
import type { HitoPago } from '../models/cotizacion.model';
import type { Compra, Expediente, Persona, Tarea } from '../models/expediente.model';
import { ColaGuardado } from '../utils/cola-guardado';
import { omitir } from '../utils/omitir';
import { DatosEmpresa } from './datos-empresa.service';
import { OperacionesApi } from './operaciones-api.service';

/**
 * Servicios de principio a fin (expedientes) guardados en la base de datos. Cada cambio con nota
 * queda en el historial (solo se agrega, no se borra). El código EXP lo pone el servidor.
 */
@Injectable({ providedIn: 'root' })
export class ExpedientesStore {
  private readonly datos = inject(DatosEmpresa);
  private readonly api = inject(OperacionesApi);
  private readonly empresa = inject(EmpresaActualService);
  private readonly avisos = inject(MessageService);
  private readonly cola = new ColaGuardado((e) => this.fallo(e));
  /** Notas del historial que aún no se mandan (viajan con el siguiente guardado). */
  private readonly notas = new Map<string, string[]>();
  private cargadoPara: string | null = null;

  readonly cargando = signal(false);
  readonly guardando = this.cola.pendientes;

  /** Quien usa la app + su personal (directorio de la empresa). */
  readonly personas = computed<Persona[]>(() => {
    const yo = this.datos.yo();
    const otros = this.datos
      .activos()
      .filter((m) => m.usuarioId !== yo.id)
      .map((m) => ({ id: m.usuarioId, nombre: m.nombre, cargo: NOMBRE_ROL[m.rol] }));
    return [{ id: yo.id, nombre: `${yo.nombre} (tú)`, cargo: 'Tú' }, ...otros];
  });

  /** Todos los que pueden recibir una tarea. */
  readonly asignables = this.personas;

  readonly expedientes = signal<Expediente[]>([]);

  constructor() {
    effect(() => {
      const id = this.empresa.id();
      if (id && id !== this.cargadoPara) {
        this.cargadoPara = id;
        void this.recargar();
      }
    });
  }

  async recargar() {
    this.cargando.set(true);
    try {
      const lista = await this.api.expedientes();
      const historiales = new Map(this.expedientes().map((e) => [e.id, e.historial]));
      this.expedientes.set(lista.map((e) => ({ ...vacio(), ...e, historial: historiales.get(e.id) ?? [] })));
    } catch {
      // Sin acceso al área: la lista queda vacía
    } finally {
      this.cargando.set(false);
    }
  }

  /** Trae el historial completo de un servicio (al abrir su ficha). */
  async cargarHistorial(id: string) {
    const h = await this.api.historial(id).catch(() => null);
    if (h) this.expedientes.update((l) => l.map((e) => (e.id === id ? { ...e, historial: h } : e)));
  }

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
    const e: Expediente = {
      ...vacio(),
      ...datos,
      id: crypto.randomUUID(),
      codigo: '…',
      etapa: 'solicitud',
      creado: hoy(),
      historial: [{ fecha: ahora(), autor: this.autor(), texto: 'Se abrió el expediente con la solicitud del cliente.' }],
      version: 0,
    };
    this.expedientes.update((l) => [e, ...l]);
    void this.cola.ahora(e.id, () => this.enviar(e.id)).catch(() => this.expedientes.update((l) => l.filter((x) => x.id !== e.id)));
    return e;
  }

  /** Agrega a la lista un servicio que creó el servidor (al aprobar una cotización). */
  async traer(id: string) {
    await this.recargar();
    await this.cargarHistorial(id);
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
    if (nota) this.notas.set(id, [...(this.notas.get(id) ?? []), nota]);
    this.cola.programar(id, () => this.enviar(id));
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

  /** Vincula un hito de pago con su factura registrada en Finanzas · Ventas. */
  vincularHito(id: string, hitoId: string, comprobante: { id: string; numero: string }) {
    const e = this.expediente(id);
    const h = e?.hitos?.find((x) => x.id === hitoId);
    if (!e || !h) return;
    this.actualizar(
      id,
      { hitos: e.hitos!.map((x) => (x.id === hitoId ? { ...x, estado: 'facturado', factura: comprobante.numero, comprobanteId: comprobante.id } : x)) },
      `Factura ${comprobante.numero} registrada en Ventas por "${h.descripcion}" (${h.porcentaje} %).`,
    );
  }

  /** Avanza un hito de pago: pendiente → facturado → cobrado. */
  cambiarHito(id: string, hitoId: string, estado: HitoPago['estado'], factura?: string) {
    const e = this.expediente(id);
    const h = e?.hitos?.find((x) => x.id === hitoId);
    if (!e || !h || h.estado === estado) return;
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

  private async enviar(id: string) {
    const e = this.expediente(id);
    if (!e) return;
    const notas = this.notas.get(id) ?? [];
    this.notas.delete(id);
    const { version } = e;
    const datos = omitir(e, 'historial', 'codigo', 'version');
    // Si falla, se recarga lo guardado: el cambio y su nota se descartan juntos (nada a medias)
    const r = await this.api.guardarExpediente(id, datos, version ?? 0, notas.join(' · ').slice(0, 500) || undefined);
    this.expedientes.update((l) => l.map((x) => (x.id === id ? { ...x, codigo: r.codigo ?? x.codigo, version: r.version } : x)));
  }

  private fallo(e: unknown) {
    this.avisos.add({ severity: 'error', summary: 'No se guardó el cambio', detail: mensajeError(e) ?? 'Revisa tu conexión.', life: 6000 });
    void this.recargar();
  }
}

function vacio(): Omit<Expediente, 'id' | 'codigo' | 'clienteId' | 'titulo' | 'solicitud' | 'responsableId' | 'etapa' | 'creado'> {
  return {
    ingreso: { personal: [], sctrEnviado: false, induccion: false, guiaRemision: false, correoEnviado: false },
    ordenesTrabajo: [],
    tareas: [],
    compras: [],
    historial: [],
  };
}

function ahora(): string {
  const a = new Date();
  return `${hoy()} ${String(a.getHours()).padStart(2, '0')}:${String(a.getMinutes()).padStart(2, '0')}`;
}
