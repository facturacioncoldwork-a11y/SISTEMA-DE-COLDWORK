import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { map } from 'rxjs';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { dinero, hoy } from '../../../finanzas/utils/calculos';
import { ComprobanteDialogo, type PrellenadoComprobante } from '../../../finanzas/components/comprobante-dialogo/comprobante-dialogo';
import { FinanzasApi } from '../../../finanzas/services/finanzas-api.service';
import { ESTADOS_ORDEN } from '../../data/catalogos';
import { ESTADOS_COMPRA, ETAPAS, indiceEtapa } from '../../data/etapas';
import type { Compra, Expediente } from '../../models/expediente.model';
import { ExpedientesStore } from '../../services/expedientes-store.service';
import { ServiciosStore } from '../../services/servicios-store.service';

/** Ficha de un servicio de principio a fin: etapas, tareas, compras e historial. */
@Component({
  selector: 'app-expediente',
  imports: [FormsModule, RouterLink, DialogModule, ComprobanteDialogo],
  templateUrl: './expediente.html',
  styleUrl: './expediente.scss',
})
export class ExpedienteView {
  private readonly ruta = inject(ActivatedRoute);
  private readonly avisos = inject(MessageService);
  private readonly empresa = inject(EmpresaActualService);
  protected readonly sim = inject(ExpedientesStore);
  protected readonly servicios = inject(ServiciosStore);
  private readonly finanzas = inject(FinanzasApi);

  constructor() {
    // Al abrir la ficha: historial completo y cobros registrados en Caja
    effect(() => {
      const id = this.id();
      if (id && this.existe()) {
        untracked(() => {
          void this.sim.cargarHistorial(id);
          void this.sincronizarCobros(id);
        });
      }
    });
  }

  protected readonly etapas = ETAPAS;
  protected readonly estadosCompra = ESTADOS_COMPRA;
  protected readonly estadosOrden = ESTADOS_ORDEN;
  protected readonly dinero = dinero;
  protected readonly hoy = hoy();

  private readonly id = toSignal(this.ruta.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  protected readonly exp = computed(() => this.sim.expediente(this.id()));
  private readonly existe = computed(() => !!this.exp());
  protected readonly cliente = computed(() => this.servicios.cliente(this.exp()?.clienteId ?? ''));
  protected readonly indice = computed(() => (this.exp() ? indiceEtapa(this.exp()!.etapa) : 0));
  protected readonly ordenes = computed(() => (this.exp()?.ordenesTrabajo ?? []).flatMap((id) => this.servicios.orden(id) ?? []));
  protected readonly ordenesCerradas = computed(() => this.ordenes().length > 0 && this.ordenes().every((o) => o.estado === 'cerrada'));

  // Formularios de cada etapa
  protected f = { cotNumero: '', cotMonto: null as number | null, ocNumero: '', fechaIngreso: hoy(), hes: '' };

  // Tareas y compras
  protected nuevaTarea = { texto: '', asignadoA: '', vence: hoy() };
  protected nuevaCompra = { descripcion: '', proveedor: '' };

  // Correo de ingreso
  protected readonly correo = signal(false);

  protected readonly textoCorreo = computed(() => {
    const e = this.exp();
    const c = this.cliente();
    if (!e || !c) return { asunto: '', cuerpo: '' };
    // Quien tiene el SCTR vencido no puede ingresar: no va en el correo
    const personal = e.ingreso.personal
      .flatMap((id) => this.servicios.tecnico(id) ?? [])
      .filter((t) => !t.sctrHasta || t.sctrHasta >= this.hoy)
      .map((t, n) => `${n + 1}. ${t.nombre}${t.sctrHasta ? ` · SCTR vigente hasta ${t.sctrHasta.split('-').reverse().join('/')}` : ''}`);
    const fecha = (e.ingreso.fecha ?? hoy()).split('-').reverse().join('/');
    const empresa = this.empresa.actual()?.razonSocial ?? 'COLD WORK S.A.C.';
    return {
      asunto: `Solicitud de ingreso a planta · ${e.ordenCliente?.numero ?? e.codigo} · ${fecha}`,
      cuerpo:
        `Estimados, ${c.contacto}:\n\n` +
        `Por medio del presente solicitamos el ingreso a ${c.razonSocial} (${c.direccion}) el día ${fecha} ` +
        `para realizar el servicio "${e.titulo}", según su orden ${e.ordenCliente?.numero ?? '(por confirmar)'}.\n\n` +
        `Personal que ingresará:\n${personal.join('\n') || '(sin asignar)'}\n\n` +
        `Adjuntamos las constancias de SCTR (salud y pensión) vigentes${e.ingreso.guiaRemision ? ' y la guía de remisión de los materiales y herramientas' : ''}.\n\n` +
        `Quedamos atentos a su confirmación.\n\nAtentamente,\n${this.sim.persona(e.responsableId)?.nombre ?? ''}\n${empresa}`,
    };
  });

  /** Asignados al ingreso cuyo SCTR ya venció (hay que reemplazarlos o renovar el seguro). */
  protected readonly sctrVencidos = computed(() =>
    (this.exp()?.ingreso.personal ?? []).flatMap((id) => this.servicios.tecnico(id) ?? []).filter((t) => !!t.sctrHasta && t.sctrHasta < this.hoy),
  );

  protected readonly tecnicosIngreso = computed(() =>
    this.servicios.tecnicos().map((t) => ({ ...t, vencido: !!t.sctrHasta && t.sctrHasta < this.hoy, elegido: this.exp()?.ingreso.personal.includes(t.id) ?? false })),
  );

  // ── Forma de pago (adelantos) ──────────────────────────────────
  protected readonly adelantoListo = computed(() => (this.exp() ? this.sim.adelantoListo(this.exp()!) : true));

  protected dineroExp(n: number) {
    return dinero(n, this.exp()?.moneda ?? 'PEN');
  }

  // ── Vínculo con Finanzas · Ventas ──────────────────────────────
  /** Qué se está facturando en el diálogo de Ventas: un hito (adelanto) o la factura final. */
  private readonly facturando = signal<{ tipo: 'hito'; hitoId: string } | { tipo: 'final' } | null>(null);
  protected readonly dialogoVenta = signal(false);
  protected readonly prellenado = signal<PrellenadoComprobante | null>(null);

  /** Abre el registro de la factura en Ventas con los datos del servicio (se revisan antes de guardar). */
  protected facturarHito(hitoId: string) {
    const e = this.exp();
    const h = e?.hitos?.find((x) => x.id === hitoId);
    if (!e || !h) return;
    this.facturando.set({ tipo: 'hito', hitoId });
    this.prellenado.set({
      terceroId: e.clienteId,
      moneda: e.moneda ?? 'PEN',
      total: h.monto,
      glosa: `${h.descripcion} (${h.porcentaje} %) · ${e.codigo} · Cot. ${e.cotizacion?.numero ?? ''} · OC ${e.ordenCliente?.numero ?? ''}`,
      detraccion: 12,
    });
    this.dialogoVenta.set(true);
  }

  /** Factura final: el total menos lo ya facturado en adelantos. */
  protected facturarFinal() {
    const e = this.exp();
    if (!e) return;
    const total = (e.cotizacion?.monto ?? 0) * 1.18;
    const adelantos = (e.hitos ?? []).filter((h) => h.estado !== 'pendiente').reduce((s, h) => s + h.monto, 0);
    this.facturando.set({ tipo: 'final' });
    this.prellenado.set({
      terceroId: e.clienteId,
      moneda: e.moneda ?? 'PEN',
      total: Math.max(0, Math.round((total - adelantos) * 100) / 100),
      glosa: `${e.titulo} · ${e.codigo} · OC ${e.ordenCliente?.numero ?? ''}${e.conformidad?.hes ? ' · HES ' + e.conformidad.hes : ''}`,
      detraccion: 12,
    });
    this.dialogoVenta.set(true);
  }

  protected ventaRegistrada(c: { id: string; serie: string; numero: string }) {
    const e = this.exp();
    const f = this.facturando();
    if (!e || !f) return;
    const numero = `${c.serie}-${c.numero}`;
    if (f.tipo === 'hito') this.sim.vincularHito(e.id, f.hitoId, { id: c.id, numero });
    else this.sim.avanzar(e.id, { factura: { numero, fecha: hoy() }, facturaId: c.id }, `Factura ${numero} registrada en Ventas.`);
    this.facturando.set(null);
    this.avisos.add({ severity: 'success', summary: `Factura ${numero} registrada`, detail: 'Ya está en Ventas, Cuentas por cobrar y en el Libro Diario.', life: 4500 });
  }

  /** Sin vínculo con Ventas (servicios antiguos): se marca a mano. */
  protected cobrarHito(hitoId: string) {
    const e = this.exp();
    if (e) this.sim.cambiarHito(e.id, hitoId, 'cobrado');
  }

  /**
   * Lo cobrado se registra en Finanzas · Caja (una sola vez, con su asiento). Aquí solo se lee:
   * si la factura vinculada ya no tiene saldo pendiente, el hito o el servicio pasan a cobrado.
   */
  private async sincronizarCobros(id: string) {
    const e = this.sim.expediente(id);
    const vinculadas = [...(e?.hitos ?? []).filter((h) => h.estado === 'facturado' && h.comprobanteId), ...(e?.facturaId && e.etapa === 'facturado' ? [e] : [])];
    if (!e || !vinculadas.length) return;
    const pendientes = await this.finanzas.pendientes('venta').catch(() => null);
    if (!pendientes) return;
    const conSaldo = new Set(pendientes.filter((p) => p.pendiente > 0).map((p) => p.id));
    for (const h of e.hitos ?? []) {
      if (h.estado === 'facturado' && h.comprobanteId && !conSaldo.has(h.comprobanteId)) this.sim.cambiarHito(e.id, h.id, 'cobrado');
    }
    if (e.etapa === 'facturado' && e.facturaId && !conSaldo.has(e.facturaId)) this.sim.avanzar(e.id, {}, 'Cobro registrado en Caja. Servicio terminado.');
  }

  private exigirAdelanto(): boolean {
    if (this.adelantoListo()) return true;
    this.aviso(`Falta cobrar "${this.exp()?.hitos?.[0]?.descripcion}" antes de mandar técnicos.`);
    return false;
  }

  // ── Acciones por etapa ─────────────────────────────────────────
  protected registrarCotizacion() {
    const e = this.exp();
    if (!e || !this.f.cotNumero.trim() || !this.f.cotMonto) return this.aviso('Indica el número y el monto de la cotización.');
    this.sim.avanzar(e.id, { cotizacion: { numero: this.f.cotNumero.trim(), monto: this.f.cotMonto, fecha: hoy() } }, `Cotización ${this.f.cotNumero.trim()} enviada por ${dinero(this.f.cotMonto)} + IGV.`);
  }

  protected registrarOrdenCliente() {
    const e = this.exp();
    if (!e || !this.f.ocNumero.trim()) return this.aviso('Indica el número de la orden de compra o de servicio del cliente.');
    this.sim.avanzar(e.id, { ordenCliente: { numero: this.f.ocNumero.trim(), fecha: hoy() } }, `El cliente aprobó: orden ${this.f.ocNumero.trim()}.`);
  }

  protected alternarPersonal(id: string) {
    const e = this.exp();
    if (!e) return;
    const p = e.ingreso.personal.includes(id) ? e.ingreso.personal.filter((x) => x !== id) : [...e.ingreso.personal, id];
    this.sim.actualizar(e.id, { ingreso: { ...e.ingreso, personal: p } });
  }

  protected marcarIngreso(campo: 'sctrEnviado' | 'induccion' | 'guiaRemision', valor: boolean) {
    const e = this.exp();
    if (e) this.sim.actualizar(e.id, { ingreso: { ...e.ingreso, [campo]: valor } });
  }

  protected abrirCorreo() {
    const e = this.exp();
    if (!e) return;
    if (!e.ingreso.personal.length) return this.aviso('Elige primero quiénes ingresan a la planta.');
    this.sim.actualizar(e.id, { ingreso: { ...e.ingreso, fecha: this.f.fechaIngreso } });
    this.correo.set(true);
  }

  protected async copiarCorreo() {
    const t = this.textoCorreo();
    await navigator.clipboard.writeText(`${t.asunto}\n\n${t.cuerpo}`);
    const e = this.exp();
    if (e) this.sim.actualizar(e.id, { ingreso: { ...e.ingreso, correoEnviado: true } }, 'Se preparó el correo de ingreso a planta.');
    this.avisos.add({ severity: 'success', summary: 'Correo copiado', detail: 'Pégalo en tu correo y adjunta los SCTR.', life: 3500 });
    this.correo.set(false);
  }

  protected confirmarIngreso() {
    const e = this.exp();
    if (!e || !this.exigirAdelanto()) return;
    if (this.sctrVencidos().length) return this.aviso(`${this.sctrVencidos().map((t) => t.nombre).join(', ')} tiene el SCTR vencido: quítalo o renueva su seguro.`);
    if (!e.ingreso.personal.length || !e.ingreso.sctrEnviado) return this.aviso('Falta elegir el personal y enviar los SCTR.');
    this.sim.avanzar(e.id, { ingreso: { ...e.ingreso, fecha: this.f.fechaIngreso } }, `Ingreso a planta confirmado para el ${this.f.fechaIngreso.split('-').reverse().join('/')}.`);
  }

  /** Crea la orden de trabajo del técnico con los datos del expediente. */
  protected crearOrden() {
    const e = this.exp();
    if (!e || !this.exigirAdelanto()) return;
    const equipo = this.servicios.equipos().find((x) => x.clienteId === e.clienteId);
    if (!equipo) return this.aviso('El cliente no tiene equipos registrados.');
    const ot = this.servicios.crear({
      clienteId: e.clienteId,
      equipoId: equipo.id,
      expedienteId: e.id,
      tipo: 'correctivo',
      prioridad: 'alta',
      tecnicos: e.ingreso.personal,
      fecha: e.ingreso.fecha ?? hoy(),
      hora: '08:00',
      descripcion: e.titulo,
    });
    // El número de OT lo da el servidor: se anota en el historial cuando llega
    void this.servicios.numeroDe(ot.id).then((numero) =>
      this.sim.avanzar(e.id, { ordenesTrabajo: [...e.ordenesTrabajo, ot.id] }, `Orden de trabajo ${numero} creada y asignada.`),
    );
  }

  protected registrarConformidad() {
    const e = this.exp();
    if (!e) return;
    this.sim.avanzar(e.id, { conformidad: { fecha: hoy(), hes: this.f.hes.trim() || undefined } }, `Conformidad del cliente recibida${this.f.hes.trim() ? ` (HES ${this.f.hes.trim()})` : ''}.`);
  }


  protected registrarCobro() {
    const e = this.exp();
    if (e) this.sim.avanzar(e.id, {}, 'Cobro recibido. Servicio terminado.');
  }

  // ── Tareas y compras ───────────────────────────────────────────
  protected agregarTarea() {
    const e = this.exp();
    if (!e || this.nuevaTarea.texto.trim().length < 3) return;
    const asignadoA = this.nuevaTarea.asignadoA || this.sim.personas()[0]?.id || '';
    this.sim.agregarTarea(e.id, { ...this.nuevaTarea, asignadoA, texto: this.nuevaTarea.texto.trim() });
    this.nuevaTarea = { texto: '', asignadoA: this.nuevaTarea.asignadoA, vence: hoy() };
  }

  protected agregarCompra() {
    const e = this.exp();
    if (!e || this.nuevaCompra.descripcion.trim().length < 3) return;
    this.sim.agregarCompra(e.id, { descripcion: this.nuevaCompra.descripcion.trim(), proveedor: this.nuevaCompra.proveedor.trim() || 'Por definir' });
    this.nuevaCompra = { descripcion: '', proveedor: '' };
  }

  protected avanzarCompra(e: Expediente, c: Compra) {
    const s = ESTADOS_COMPRA[c.estado].siguiente;
    if (s) this.sim.cambiarCompra(e.id, c.id, s);
  }

  protected iniciales(nombre?: string) {
    return (nombre ?? '?').replace('Ing. ', '').split(' ').map((p) => p[0]).slice(0, 2).join('');
  }

  private aviso(texto: string) {
    this.avisos.add({ severity: 'warn', summary: 'Falta un dato', detail: texto, life: 4000 });
  }
}
