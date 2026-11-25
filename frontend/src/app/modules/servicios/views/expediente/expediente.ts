import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { DialogModule } from 'primeng/dialog';
import { map } from 'rxjs';
import { EmpresaActualService } from '../../../../core/empresa/services/empresa-actual.service';
import { dinero, hoy } from '../../../finanzas/utils/calculos';
import { ESTADOS_ORDEN } from '../../data/catalogos';
import { ESTADOS_COMPRA, ETAPAS, indiceEtapa } from '../../data/etapas';
import type { Compra, Expediente } from '../../models/expediente.model';
import { ExpedientesSim } from '../../services/expedientes-sim.service';
import { ServiciosSim } from '../../services/servicios-sim.service';

/** Ficha de un servicio de principio a fin: etapas, tareas, compras e historial. */
@Component({
  selector: 'app-expediente',
  imports: [FormsModule, RouterLink, DialogModule],
  templateUrl: './expediente.html',
  styleUrl: './expediente.scss',
})
export class ExpedienteView {
  private readonly ruta = inject(ActivatedRoute);
  private readonly avisos = inject(MessageService);
  private readonly empresa = inject(EmpresaActualService);
  protected readonly sim = inject(ExpedientesSim);
  protected readonly servicios = inject(ServiciosSim);

  protected readonly etapas = ETAPAS;
  protected readonly estadosCompra = ESTADOS_COMPRA;
  protected readonly estadosOrden = ESTADOS_ORDEN;
  protected readonly dinero = dinero;
  protected readonly hoy = hoy();

  private readonly id = toSignal(this.ruta.paramMap.pipe(map((p) => p.get('id') ?? '')), { initialValue: '' });
  protected readonly exp = computed(() => this.sim.expediente(this.id()));
  protected readonly cliente = computed(() => this.servicios.cliente(this.exp()?.clienteId ?? ''));
  protected readonly indice = computed(() => (this.exp() ? indiceEtapa(this.exp()!.etapa) : 0));
  protected readonly ordenes = computed(() => (this.exp()?.ordenesTrabajo ?? []).flatMap((id) => this.servicios.orden(id) ?? []));
  protected readonly ordenesCerradas = computed(() => this.ordenes().length > 0 && this.ordenes().every((o) => o.estado === 'cerrada'));

  // Formularios de cada etapa
  protected f = { cotNumero: '', cotMonto: null as number | null, ocNumero: '', fechaIngreso: hoy(), hes: '', factura: '' };

  // Tareas y compras
  protected nuevaTarea = { texto: '', asignadoA: 'p2', vence: hoy() };
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
      .filter((t) => t.sctrHasta >= this.hoy)
      .map((t, n) => `${n + 1}. ${t.nombre} · ${t.especialidad} · SCTR vigente hasta ${t.sctrHasta.split('-').reverse().join('/')}`);
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
    (this.exp()?.ingreso.personal ?? []).flatMap((id) => this.servicios.tecnico(id) ?? []).filter((t) => t.sctrHasta < this.hoy),
  );

  protected readonly tecnicosIngreso = computed(() =>
    this.servicios.tecnicos().map((t) => ({ ...t, vencido: t.sctrHasta < this.hoy, elegido: this.exp()?.ingreso.personal.includes(t.id) ?? false })),
  );

  // ── Forma de pago (adelantos) ──────────────────────────────────
  protected readonly adelantoListo = computed(() => (this.exp() ? this.sim.adelantoListo(this.exp()!) : true));
  protected facturaHito: Record<string, string> = {};

  protected dineroExp(n: number) {
    return dinero(n, this.exp()?.moneda ?? 'PEN');
  }

  /** Factura de anticipo (con IGV y, si pasa S/ 700, detracción). En la versión real va a Ventas. */
  protected facturarHito(hitoId: string) {
    const e = this.exp();
    const numero = (this.facturaHito[hitoId] ?? '').trim().toUpperCase();
    if (!e || !/^[A-Z0-9]{4}-\d{1,8}$/.test(numero)) return this.aviso('Indica la factura del adelanto (ej. F001-130).');
    this.sim.cambiarHito(e.id, hitoId, 'facturado', numero);
  }

  protected cobrarHito(hitoId: string) {
    const e = this.exp();
    if (e) this.sim.cambiarHito(e.id, hitoId, 'cobrado');
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
      tipo: 'correctivo',
      prioridad: 'alta',
      tecnicos: e.ingreso.personal,
      fecha: e.ingreso.fecha ?? hoy(),
      hora: '08:00',
      descripcion: e.titulo,
    });
    this.sim.avanzar(e.id, { ordenesTrabajo: [...e.ordenesTrabajo, ot.id] }, `Orden de trabajo ${ot.numero} creada y asignada.`);
  }

  protected registrarConformidad() {
    const e = this.exp();
    if (!e) return;
    this.sim.avanzar(e.id, { conformidad: { fecha: hoy(), hes: this.f.hes.trim() || undefined } }, `Conformidad del cliente recibida${this.f.hes.trim() ? ` (HES ${this.f.hes.trim()})` : ''}.`);
  }

  protected registrarFactura() {
    const e = this.exp();
    if (!e || !/^[A-Z0-9]{4}-\d{1,8}$/i.test(this.f.factura.trim())) return this.aviso('Indica la factura (ej. F001-126).');
    this.sim.avanzar(e.id, { factura: { numero: this.f.factura.trim().toUpperCase(), fecha: hoy() } }, `Factura ${this.f.factura.trim().toUpperCase()} emitida.`);
  }

  protected registrarCobro() {
    const e = this.exp();
    if (e) this.sim.avanzar(e.id, {}, 'Cobro recibido. Servicio terminado.');
  }

  // ── Tareas y compras ───────────────────────────────────────────
  protected agregarTarea() {
    const e = this.exp();
    if (!e || this.nuevaTarea.texto.trim().length < 3) return;
    this.sim.agregarTarea(e.id, { ...this.nuevaTarea, texto: this.nuevaTarea.texto.trim() });
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
