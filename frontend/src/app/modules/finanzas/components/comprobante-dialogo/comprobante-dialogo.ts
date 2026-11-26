import { Component, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { CUENTAS_COMPRA, CUENTAS_VENTA, DETRACCIONES, TIPOS_DOC } from '../../data/finanzas';
import type { Moneda, NuevoComprobante, Operacion, Pendiente } from '../../models/finanzas.model';
import { FinanzasApi } from '../../services/finanzas-api.service';
import { FinanzasStore, mensajeError } from '../../services/finanzas-store.service';
import {
  aplicaDetraccion,
  desglosarTotal,
  dinero,
  hoy,
  igvDe,
  montoDetraccion,
  redondear,
  retencionCuarta,
  sumarDias,
} from '../../utils/calculos';
import { TerceroDialogo } from '../tercero-dialogo/tercero-dialogo';

interface LineaVista {
  cuenta: string;
  debe: number;
  haber: number;
}

export interface PrellenadoComprobante {
  terceroId: string;
  moneda: Moneda;
  /** Total con IGV. */
  total: number;
  glosa: string;
  detraccion?: number;
}

/**
 * Registrar un comprobante de venta o de compra.
 * Calcula IGV (18 %), retención de 4.ª (recibos por honorarios), detracción y vencimiento,
 * y muestra cómo quedará el asiento en el Libro Diario antes de guardar.
 */
@Component({
  selector: 'app-comprobante-dialogo',
  imports: [
    FormsModule,
    CheckboxModule,
    DialogModule,
    InputNumberModule,
    InputTextModule,
    SelectModule,
    SelectButtonModule,
    TerceroDialogo,
  ],
  templateUrl: './comprobante-dialogo.html',
  styleUrl: './comprobante-dialogo.scss',
})
export class ComprobanteDialogo {
  private readonly api = inject(FinanzasApi);
  protected readonly store = inject(FinanzasStore);

  readonly visible = model(false);
  readonly operacion = input.required<Operacion>();
  /** Datos que llegan de otro módulo (ej. un adelanto de un servicio): se pueden revisar antes de registrar. */
  readonly prellenar = input<PrellenadoComprobante | null>(null);
  readonly guardado = output<void>();
  /** Comprobante ya registrado (para vincularlo desde otro módulo). */
  readonly registrado = output<{ id: string; serie: string; numero: string }>();

  protected readonly dinero = dinero;
  protected readonly detracciones = DETRACCIONES;
  protected readonly monedas = [
    { etiqueta: 'Soles', valor: 'PEN' },
    { etiqueta: 'Dólares', valor: 'USD' },
  ];

  // ─── Formulario ───────────────────────────────────────────────
  protected readonly terceroId = signal<string | null>(null);
  protected readonly tipoDoc = signal('01');
  protected serie = '';
  protected numero = '';
  protected readonly fechaEmision = signal(hoy());
  protected readonly fechaVencimiento = signal(hoy());
  protected readonly moneda = signal<Moneda>('PEN');
  protected readonly tipoCambio = signal<number | null>(null);
  protected readonly baseGravada = signal(0);
  protected readonly noGravada = signal(0);
  protected readonly retener = signal(true);
  protected readonly detraccion = signal(0);
  protected readonly cuentaContable = signal('7041');
  protected readonly referenciaId = signal<string | null>(null);
  protected glosa = '';
  protected totalConIgv: number | null = null;

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dialogoTercero = signal(false);
  private readonly pendientesTercero = signal<Pendiente[]>([]);

  // ─── Opciones según la operación ─────────────────────────────
  protected readonly esVenta = computed(() => this.operacion() === 'venta');
  protected readonly tiposDoc = computed(() => TIPOS_DOC[this.operacion()]);
  protected readonly cuentas = computed(() =>
    (this.esVenta() ? CUENTAS_VENTA : CUENTAS_COMPRA).map((c) => ({ ...c, etiqueta: `${c.codigo} · ${c.nombre}` })),
  );
  protected readonly terceros = computed(() =>
    (this.esVenta() ? this.store.clientes() : this.store.proveedores()).map((t) => ({
      ...t,
      etiqueta: `${t.razonSocial} · ${t.tipoDocumento} ${t.numeroDocumento}`,
    })),
  );
  protected readonly tercero = computed(() => this.store.terceros().find((t) => t.id === this.terceroId()) ?? null);

  /** Boleta/ticket de compra no da crédito fiscal; recibo por honorarios no lleva IGV. */
  protected readonly sinIgv = computed(
    () => this.tipoDoc() === '02' || (!this.esVenta() && ['03', '12'].includes(this.tipoDoc())),
  );
  protected readonly esNotaCredito = computed(() => this.tipoDoc() === '07');
  protected readonly esHonorarios = computed(() => this.tipoDoc() === '02');

  // ─── Cálculos ─────────────────────────────────────────────────
  protected readonly igv = computed(() => (this.sinIgv() ? 0 : igvDe(this.baseGravada())));
  protected readonly total = computed(() => redondear(this.baseGravada() + this.noGravada() + this.igv()));
  protected readonly retencion = computed(() =>
    this.esHonorarios() && this.retener() ? retencionCuarta(this.total()) : 0,
  );
  protected readonly totalSoles = computed(() =>
    this.moneda() === 'USD' ? this.total() * (this.tipoCambio() ?? 0) : this.total(),
  );
  protected readonly sugerirDetraccion = computed(
    () => this.esVenta() && !this.esNotaCredito() && aplicaDetraccion(this.totalSoles()) && this.detraccion() === 0,
  );
  protected readonly montoDetr = computed(() => montoDetraccion(this.totalSoles(), this.detraccion()));
  protected readonly referencias = computed(() =>
    this.pendientesTercero()
      .filter((p) => p.tipoDoc !== '07')
      .map((p) => ({ ...p, etiqueta: `${p.serie}-${p.numero} · pendiente ${dinero(p.pendiente, p.moneda)}` })),
  );

  /** Vista previa del asiento (lo mismo que genera la base de datos). */
  protected readonly asiento = computed<LineaVista[]>(() => {
    const f = this.moneda() === 'USD' ? (this.tipoCambio() ?? 0) : 1;
    const neto = (this.baseGravada() + this.noGravada()) * f;
    let lineas: LineaVista[];
    if (this.esVenta()) {
      lineas = [
        { cuenta: '1212', debe: this.total() * f, haber: 0 },
        { cuenta: '40111', debe: 0, haber: this.igv() * f },
        { cuenta: this.cuentaContable(), debe: 0, haber: neto },
      ];
    } else {
      lineas = [
        { cuenta: this.cuentaContable(), debe: neto, haber: 0 },
        { cuenta: '40111', debe: this.igv() * f, haber: 0 },
        { cuenta: this.esHonorarios() ? '424' : '4212', debe: 0, haber: (this.total() - this.retencion()) * f },
        { cuenta: '40172', debe: 0, haber: this.retencion() * f },
      ];
    }
    if (this.esNotaCredito()) lineas = lineas.map((l) => ({ ...l, debe: l.haber, haber: l.debe }));
    return lineas
      .map((l) => ({ ...l, debe: redondear(l.debe), haber: redondear(l.haber) }))
      .filter((l) => l.debe > 0 || l.haber > 0);
  });

  constructor() {
    // Al abrir: formulario limpio con valores de la operación
    effect(() => {
      if (!this.visible()) return;
      untracked(() => this.limpiar());
    });

    // Vencimiento = emisión + días de crédito del cliente/proveedor
    effect(() => {
      const t = this.tercero();
      const emision = this.fechaEmision();
      untracked(() => this.fechaVencimiento.set(sumarDias(emision, t?.diasCredito ?? 0)));
    });

    // Recibo por honorarios: sin IGV, todo a no gravado y cuenta de honorarios
    effect(() => {
      if (!this.sinIgv()) return;
      untracked(() => {
        if (this.baseGravada() > 0) {
          this.noGravada.set(redondear(this.noGravada() + this.baseGravada()));
          this.baseGravada.set(0);
        }
        if (this.esHonorarios()) this.cuentaContable.set('632');
      });
    });

    // Nota de crédito: trae los comprobantes del mismo cliente/proveedor
    effect(() => {
      const id = this.terceroId();
      if (!this.esNotaCredito() || !id) return this.pendientesTercero.set([]);
      void this.api
        .pendientes(untracked(() => this.operacion()))
        .then((lista) => this.pendientesTercero.set(lista.filter((p) => p.terceroId === id)))
        .catch(() => this.pendientesTercero.set([]));
    });
  }

  private limpiar() {
    const venta = this.esVenta();
    this.terceroId.set(null);
    this.tipoDoc.set('01');
    this.serie = venta ? 'F001' : '';
    this.numero = '';
    this.fechaEmision.set(hoy());
    this.moneda.set('PEN');
    this.tipoCambio.set(null);
    this.baseGravada.set(0);
    this.noGravada.set(0);
    this.retener.set(true);
    this.detraccion.set(0);
    this.cuentaContable.set(venta ? '7041' : '6033');
    this.referenciaId.set(null);
    this.glosa = '';
    this.totalConIgv = null;
    this.error.set(null);
    void this.store.asegurar();
    const p = this.prellenar();
    if (p) {
      this.terceroId.set(p.terceroId || null);
      this.moneda.set(p.moneda);
      this.desdeTotal(p.total);
      this.totalConIgv = p.total;
      this.glosa = p.glosa.slice(0, 200);
      if (p.detraccion) this.detraccion.set(p.detraccion);
    }
  }

  /** Si tiene el total con IGV a la mano, calcula la base. */
  protected desdeTotal(total: number | null) {
    if (!total) return;
    if (this.sinIgv()) {
      this.noGravada.set(total);
      this.baseGravada.set(0);
      return;
    }
    const { base } = desglosarTotal(total);
    this.baseGravada.set(base);
    this.noGravada.set(0);
  }

  protected cambiarTipoDoc(tipo: string) {
    this.tipoDoc.set(tipo);
    if (this.esVenta()) this.serie = tipo === '03' ? 'B001' : tipo === '07' ? 'FC01' : tipo === '08' ? 'FD01' : 'F001';
  }

  protected async terceroCreado(id: string) {
    await this.store.recargar();
    this.terceroId.set(id);
  }

  protected async guardar() {
    const error = this.validar();
    if (error) return this.error.set(error);

    const datos: NuevoComprobante = {
      operacion: this.operacion(),
      terceroId: this.terceroId()!,
      tipoDoc: this.tipoDoc(),
      serie: this.serie.trim().toUpperCase(),
      numero: this.numero.trim(),
      fechaEmision: this.fechaEmision(),
      fechaVencimiento: this.fechaVencimiento(),
      moneda: this.moneda(),
      tipoCambio: this.moneda() === 'USD' ? (this.tipoCambio() ?? undefined) : undefined,
      baseGravada: this.baseGravada(),
      noGravada: this.noGravada(),
      igv: this.igv(),
      retencionRenta: this.retencion() || undefined,
      detraccionPorcentaje: this.detraccion() || undefined,
      cuentaContable: this.cuentaContable(),
      glosa: this.glosa.trim() || undefined,
      referenciaId: this.esNotaCredito() ? (this.referenciaId() ?? undefined) : undefined,
    };

    this.guardando.set(true);
    this.error.set(null);
    try {
      const r = await this.api.registrarComprobante(datos);
      this.guardado.emit();
      this.registrado.emit({ id: r.id, serie: datos.serie, numero: datos.numero });
      this.visible.set(false);
    } catch (e) {
      this.error.set(mensajeError(e) ?? 'No se pudo registrar.');
    } finally {
      this.guardando.set(false);
    }
  }

  private validar(): string | null {
    if (!this.terceroId()) return this.esVenta() ? 'Elige el cliente.' : 'Elige el proveedor.';
    if (this.esVenta() && this.tipoDoc() === '01' && this.tercero()?.tipoDocumento !== 'RUC') {
      return 'Una factura necesita un cliente con RUC. Para personas usa boleta.';
    }
    if (!/^[A-Z0-9]{1,4}$/i.test(this.serie.trim())) return 'Escribe la serie (ej. F001).';
    if (!/^\d{1,10}$/.test(this.numero.trim())) return 'Escribe el número del comprobante (solo dígitos).';
    if (this.total() <= 0) return 'Indica el importe.';
    if (this.moneda() === 'USD' && !(this.tipoCambio() && this.tipoCambio()! > 0)) return 'Indica el tipo de cambio.';
    if (this.esNotaCredito() && !this.referenciaId()) return 'Elige qué comprobante corrige la nota de crédito.';
    return null;
  }
}
