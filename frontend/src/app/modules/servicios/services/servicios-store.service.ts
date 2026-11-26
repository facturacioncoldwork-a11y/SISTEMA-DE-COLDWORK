import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { mensajeError } from '../../../core/api/errores';
import { EmpresaActualService } from '../../../core/empresa/services/empresa-actual.service';
import { MEDICIONES } from '../data/catalogos';
import type { Cliente, Equipo, EstadoOrden, Informe, Mensaje, OrdenTrabajo, SeccionInforme, Tecnico } from '../models/servicios.model';
import { ColaGuardado } from '../utils/cola-guardado';
import { omitir } from '../utils/omitir';
import { DatosEmpresa } from './datos-empresa.service';
import { OperacionesApi } from './operaciones-api.service';

/**
 * Área técnica guardada en la base de datos: equipos de los clientes y órdenes de trabajo con su
 * informe. La pantalla cambia al instante y se guarda en segundo plano; el número de OT lo pone
 * el servidor. Una OT cerrada (firmada) ya no se puede cambiar.
 */
@Injectable({ providedIn: 'root' })
export class ServiciosStore {
  private readonly datos = inject(DatosEmpresa);
  private readonly api = inject(OperacionesApi);
  private readonly empresa = inject(EmpresaActualService);
  private readonly avisos = inject(MessageService);
  private readonly cola = new ColaGuardado((e) => this.fallo(e));
  private cargadoPara: string | null = null;

  readonly cargando = signal(false);
  readonly guardando = this.cola.pendientes;

  /** Personal con el área técnica (Equipo y accesos). */
  readonly tecnicos = computed<Tecnico[]>(() =>
    this.datos.conArea('tecnica').map((m) => ({ id: m.usuarioId, nombre: m.nombre, especialidad: 'Área técnica', sctrHasta: null })),
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

  /** Quién está editando cada orden en tiempo real (se llenará con Supabase Realtime). */
  readonly presencia = signal<Record<string, { tecnicoId: string; seccion: SeccionInforme }[]>>({});

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
    const [e, o] = await Promise.allSettled([this.api.equipos(), this.api.ordenes()]);
    if (e.status === 'fulfilled') this.equipos.set(e.value);
    if (o.status === 'fulfilled') this.ordenes.set(o.value.map((x) => ({ ...x, informe: { ...informeVacio(), ...x.informe }, mensajes: [] })));
    this.cargando.set(false);
  }

  cliente(id: string) {
    return this.clientes().find((c) => c.id === id);
  }
  equipo(id: string) {
    return this.equipos().find((e) => e.id === id);
  }
  tecnico(id: string) {
    return this.tecnicos().find((t) => t.id === id) ?? (this.datos.persona(id) ? { id, nombre: this.datos.persona(id)!.nombre, especialidad: '', sctrHasta: null } : undefined);
  }
  orden(id: string) {
    return this.ordenes().find((o) => o.id === id);
  }

  /** Registra un equipo del cliente (se guarda al momento). */
  agregarEquipo(e: Omit<Equipo, 'id'>): Equipo {
    const nuevo = { ...e, id: crypto.randomUUID() };
    this.equipos.update((l) => [...l, nuevo]);
    void this.cola.ahora(nuevo.id, () => this.api.guardarEquipo(nuevo.id, e)).catch(() => this.equipos.update((l) => l.filter((x) => x.id !== nuevo.id)));
    return nuevo;
  }

  crear(o: Omit<OrdenTrabajo, 'id' | 'numero' | 'estado' | 'informe' | 'mensajes'>): OrdenTrabajo {
    const nueva: OrdenTrabajo = { ...o, id: crypto.randomUUID(), numero: '…', estado: 'programada', informe: informeVacio(), mensajes: [], version: 0 };
    this.ordenes.update((l) => [nueva, ...l]);
    void this.cola.ahora(nueva.id, () => this.enviar(nueva.id)).catch(() => this.ordenes.update((l) => l.filter((x) => x.id !== nueva.id)));
    return nueva;
  }

  /** Espera a que la orden ya tenga su número del servidor (para el historial del servicio). */
  async numeroDe(id: string): Promise<string> {
    await this.cola.ahora(id, async () => undefined);
    return this.orden(id)?.numero ?? '';
  }

  actualizar(id: string, cambios: Partial<OrdenTrabajo>) {
    this.ordenes.update((l) => l.map((o) => (o.id === id ? { ...o, ...cambios } : o)));
    this.cola.programar(id, () => this.enviar(id));
  }

  actualizarInforme(id: string, cambios: Partial<Informe>) {
    this.ordenes.update((l) => l.map((o) => (o.id === id ? { ...o, informe: { ...o.informe, ...cambios } } : o)));
    this.cola.programar(id, () => this.enviar(id));
  }

  /** Cierra la orden YA (no en segundo plano): el servidor exige la firma y la deja inmutable. */
  async cerrar(id: string): Promise<boolean> {
    const antes = this.orden(id)?.estado;
    this.ordenes.update((l) => l.map((o) => (o.id === id ? { ...o, estado: 'cerrada' } : o)));
    try {
      await this.cola.ahora(id, () => this.enviar(id));
      return true;
    } catch {
      if (antes) this.ordenes.update((l) => l.map((o) => (o.id === id ? { ...o, estado: antes } : o)));
      return false;
    }
  }

  async cargarMensajes(id: string) {
    const m = await this.api.mensajes(id).catch(() => null);
    if (m) this.ordenes.update((l) => l.map((o) => (o.id === id ? { ...o, mensajes: m } : o)));
  }

  async enviarMensaje(id: string, texto: string) {
    try {
      const m = await this.api.enviarMensaje(id, texto);
      this.ordenes.update((l) => l.map((o) => (o.id === id ? { ...o, mensajes: [...o.mensajes, m as Mensaje] } : o)));
    } catch (e) {
      this.fallo(e);
    }
  }

  private async enviar(id: string) {
    const o = this.orden(id);
    if (!o) return;
    const { version } = o;
    const datos = omitir(o, 'mensajes', 'numero', 'version');
    const r = await this.api.guardarOrden(id, datos, version ?? 0);
    this.ordenes.update((l) => l.map((x) => (x.id === id ? { ...x, numero: r.numero ?? x.numero, version: r.version } : x)));
  }

  private fallo(e: unknown) {
    this.avisos.add({ severity: 'error', summary: 'No se guardó el cambio', detail: mensajeError(e) ?? 'Revisa tu conexión.', life: 6000 });
    void this.recargar();
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
